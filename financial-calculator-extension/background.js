import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
const NOTES_STORAGE_KEY = 'autoNoteTaker.localNotes';
const SESSION_STORAGE_KEY = 'autoNoteTaker.supabaseSession';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

async function getStoredNotes() {
  const stored = await chrome.storage.local.get([NOTES_STORAGE_KEY]);
  return stored[NOTES_STORAGE_KEY] || [];
}

async function setStoredNotes(notes) {
  await chrome.storage.local.set({ [NOTES_STORAGE_KEY]: notes });
}

async function getStoredSession() {
  const stored = await chrome.storage.local.get([SESSION_STORAGE_KEY]);
  return stored[SESSION_STORAGE_KEY] || null;
}

async function setStoredSession(session) {
  await chrome.storage.local.set({ [SESSION_STORAGE_KEY]: session });
}

async function clearStoredSession() {
  await chrome.storage.local.remove(SESSION_STORAGE_KEY);
}

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

function createLocalNote(payload) {
  return {
    id: crypto.randomUUID(),
    text: payload.text.trim(),
    url: payload.url,
    pageTitle: payload.pageTitle || '',
    domain: getDomain(payload.url),
    created_at: new Date().toISOString(),
    source: 'local',
  };
}

function mergeNotes(localNotes, cloudNotes) {
  const merged = new Map();

  [...cloudNotes, ...localNotes].forEach((note) => {
    const key = `${note.text}__${note.url}`;
    if (!merged.has(key)) {
      merged.set(key, note);
    }
  });

  return Array.from(merged.values()).sort(
    (first, second) =>
      new Date(second.created_at).getTime() - new Date(first.created_at).getTime(),
  );
}

async function saveNoteLocally(note) {
  const existingNotes = await getStoredNotes();
  const duplicate = existingNotes.find(
    (existing) => existing.text === note.text && existing.url === note.url,
  );

  if (duplicate) {
    return duplicate;
  }

  const nextNotes = [note, ...existingNotes].sort(
    (first, second) =>
      new Date(second.created_at).getTime() - new Date(first.created_at).getTime(),
  );

  await setStoredNotes(nextNotes);
  return note;
}

async function getCurrentUser() {
  const session = await getStoredSession();
  if (!session?.access_token || SUPABASE_URL.includes('YOUR_SUPABASE')) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser(session.access_token);
  if (error || !data?.user) {
    return null;
  }

  return data.user;
}

async function fetchCloudNotes() {
  const user = await getCurrentUser();
  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase fetch failed:', error.message);
    return [];
  }

  return data.map((note) => ({
    ...note,
    domain: getDomain(note.url),
    source: 'cloud',
  }));
}

async function saveNoteToSupabase(note) {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const existingCloudNotes = await fetchCloudNotes();
  const duplicate = existingCloudNotes.find(
    (existing) => existing.text === note.text && existing.url === note.url,
  );

  if (duplicate) {
    return duplicate;
  }

  const { data, error } = await supabase
    .from('notes')
    .insert([
      {
        user_id: user.id,
        text: note.text,
        url: note.url,
        created_at: note.created_at,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Supabase insert failed:', error.message);
    return null;
  }

  return {
    ...note,
    id: data.id,
    user_id: data.user_id,
    source: 'cloud',
  };
}

async function syncLocalNotesToCloud() {
  const localNotes = await getStoredNotes();

  for (const note of localNotes) {
    await saveNoteToSupabase(note);
  }
}

async function deleteNote(noteId) {
  const localNotes = await getStoredNotes();
  const noteToDelete = localNotes.find((note) => note.id === noteId);
  await setStoredNotes(localNotes.filter((note) => note.id !== noteId));

  const user = await getCurrentUser();
  if (!user) {
    return;
  }

  const cloudNotes = await fetchCloudNotes();
  const cloudMatch = cloudNotes.find(
    (note) =>
      note.id === noteId ||
      (noteToDelete && note.text === noteToDelete.text && note.url === noteToDelete.url),
  );

  if (cloudMatch) {
    await supabase.from('notes').delete().eq('id', cloudMatch.id).eq('user_id', user.id);
  }
}

async function beginGoogleLogin() {
  if (
    SUPABASE_URL.includes('YOUR_SUPABASE') ||
    SUPABASE_ANON_KEY.includes('YOUR_SUPABASE')
  ) {
    throw new Error('Add your Supabase URL and anon key before using Google login.');
  }

  const redirectTo = chrome.identity.getRedirectURL('supabase-auth');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    throw error;
  }

  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: data.url,
    interactive: true,
  });

  const response = new URL(responseUrl);
  const accessToken = response.hash.match(/access_token=([^&]+)/)?.[1];
  const refreshToken = response.hash.match(/refresh_token=([^&]+)/)?.[1];

  if (!accessToken || !refreshToken) {
    throw new Error('Login did not return a valid Supabase session.');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: decodeURIComponent(accessToken),
    refresh_token: decodeURIComponent(refreshToken),
  });

  if (sessionError) {
    throw sessionError;
  }

  await setStoredSession(sessionData.session);
  await syncLocalNotesToCloud();
  return sessionData.session;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === 'SAVE_NOTE') {
        const localNote = await saveNoteLocally(createLocalNote(message.payload));
        const cloudNote = await saveNoteToSupabase(localNote);
        sendResponse({ success: true, note: cloudNote || localNote });
        return;
      }

      if (message.type === 'GET_NOTES') {
        const localNotes = await getStoredNotes();
        const cloudNotes = await fetchCloudNotes();
        const user = await getCurrentUser();

        sendResponse({
          success: true,
          notes: mergeNotes(localNotes, cloudNotes),
          user,
        });
        return;
      }

      if (message.type === 'DELETE_NOTE') {
        await deleteNote(message.noteId);
        sendResponse({ success: true });
        return;
      }

      if (message.type === 'LOGIN') {
        const session = await beginGoogleLogin();
        const { data } = await supabase.auth.getUser(session.access_token);
        sendResponse({ success: true, user: data.user });
        return;
      }

      if (message.type === 'LOGOUT') {
        await clearStoredSession();
        await supabase.auth.signOut();
        sendResponse({ success: true });
        return;
      }

      if (message.type === 'GET_USER') {
        const user = await getCurrentUser();
        sendResponse({ success: true, user });
        return;
      }

      sendResponse({ success: false, error: 'Unsupported message type.' });
    } catch (error) {
      console.error('Background message error:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true;
});
