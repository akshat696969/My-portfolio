const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
const STORAGE_KEYS = {
  NOTES: "localNotes",
  AUTH: "authSession"
};

function isSupabaseConfigured() {
  return (
    SUPABASE_URL.startsWith("https://") &&
    SUPABASE_ANON_KEY &&
    SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY"
  );
}

function getStorage(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => resolve(result[key]));
  });
}

function setStorage(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, () => resolve());
  });
}

function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

async function supabaseRequest(path, { method = "GET", token, body } = {}) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: token ? `Bearer ${token}` : `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json"
  };

  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Supabase error (${response.status})`);
  }

  return response.status === 204 ? null : response.json();
}

async function getAuthSession() {
  return (await getStorage(STORAGE_KEYS.AUTH)) || null;
}

async function saveLocalNote(note) {
  const notes = (await getStorage(STORAGE_KEYS.NOTES)) || [];
  const newNote = {
    id: crypto.randomUUID(),
    text: note.text,
    url: note.url,
    title: note.title,
    domain: extractDomain(note.url),
    created_at: note.createdAt || new Date().toISOString(),
    source: "local"
  };

  notes.unshift(newNote);
  await setStorage({ [STORAGE_KEYS.NOTES]: notes });

  return newNote;
}

async function syncNoteToCloud(localNote) {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const session = await getAuthSession();
  if (!session?.access_token || !session?.user?.id) {
    return null;
  }

  return supabaseRequest("/rest/v1/notes", {
    method: "POST",
    token: session.access_token,
    body: [
      {
        user_id: session.user.id,
        text: localNote.text,
        url: localNote.url,
        created_at: localNote.created_at
      }
    ]
  });
}

async function fetchCloudNotes() {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const session = await getAuthSession();
  if (!session?.access_token || !session?.user?.id) {
    return [];
  }

  const query = `/rest/v1/notes?select=id,user_id,text,url,created_at&user_id=eq.${session.user.id}&order=created_at.desc`;

  const rows = await supabaseRequest(query, {
    method: "GET",
    token: session.access_token
  });

  return rows.map((row) => ({
    id: row.id,
    text: row.text,
    url: row.url,
    title: "",
    domain: extractDomain(row.url),
    created_at: row.created_at,
    source: "cloud"
  }));
}

async function beginGoogleLogin() {
  if (!isSupabaseConfigured()) {
    throw new Error("Set SUPABASE_URL and SUPABASE_ANON_KEY in background.js first.");
  }

  const redirectUri = chrome.identity.getRedirectURL("supabase-auth");
  const authUrl = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
  authUrl.searchParams.set("provider", "google");
  authUrl.searchParams.set("redirect_to", redirectUri);
  authUrl.searchParams.set("response_type", "token");

  const callbackUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      {
        url: authUrl.toString(),
        interactive: true
      },
      (redirectedTo) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(redirectedTo);
      }
    );
  });

  if (!callbackUrl) {
    throw new Error("Login failed: no callback URL.");
  }

  const fragment = callbackUrl.split("#")[1] || "";
  const params = new URLSearchParams(fragment);
  const accessToken = params.get("access_token");

  if (!accessToken) {
    throw new Error("Login failed: access token missing.");
  }

  const user = await supabaseRequest("/auth/v1/user", {
    method: "GET",
    token: accessToken
  });

  const session = {
    access_token: accessToken,
    user: {
      id: user.id,
      email: user.email || ""
    }
  };

  await setStorage({ [STORAGE_KEYS.AUTH]: session });
  return session;
}

async function logout() {
  await setStorage({ [STORAGE_KEYS.AUTH]: null });
}

async function getCombinedNotes() {
  const local = (await getStorage(STORAGE_KEYS.NOTES)) || [];
  const cloud = await fetchCloudNotes();

  const merged = [...cloud, ...local];
  merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return merged;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case "SAVE_NOTE": {
        const localNote = await saveLocalNote(message.payload);
        await syncNoteToCloud(localNote).catch(() => null);
        sendResponse({ ok: true, note: localNote });
        break;
      }
      case "GET_NOTES": {
        const notes = await getCombinedNotes();
        sendResponse({ ok: true, notes });
        break;
      }
      case "DELETE_NOTE": {
        const { id, source } = message.payload;

        if (source === "cloud") {
          const session = await getAuthSession();
          if (session?.access_token && isSupabaseConfigured()) {
            await supabaseRequest(`/rest/v1/notes?id=eq.${encodeURIComponent(id)}`, {
              method: "DELETE",
              token: session.access_token
            });
          }
        } else {
          const notes = (await getStorage(STORAGE_KEYS.NOTES)) || [];
          const filtered = notes.filter((note) => note.id !== id);
          await setStorage({ [STORAGE_KEYS.NOTES]: filtered });
        }

        sendResponse({ ok: true });
        break;
      }
      case "LOGIN_GOOGLE": {
        const session = await beginGoogleLogin();
        sendResponse({ ok: true, session });
        break;
      }
      case "LOGOUT": {
        await logout();
        sendResponse({ ok: true });
        break;
      }
      case "GET_AUTH": {
        const session = await getAuthSession();
        sendResponse({ ok: true, session });
        break;
      }
      default:
        sendResponse({ ok: false, error: "Unsupported message type." });
    }
  })().catch((error) => {
    sendResponse({ ok: false, error: error.message || "Unknown error." });
  });

  return true;
});
