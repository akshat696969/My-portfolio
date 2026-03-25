const SUPABASE_URL = "https://bowwduxdrtauyawamzad.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvd3dkdXhkcnRhdXlhd2FtemFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMzY0NDIsImV4cCI6MjA4OTYxMjQ0Mn0.z18Y8cC9CvbTnOLsSw7tGj04xEdYBM2MCbFYeG8tA74";

const authStatus = document.getElementById("authStatus");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const searchInput = document.getElementById("searchInput");
const noteList = document.getElementById("noteList");

let allNotes = [];
let currentSession = null;

/**
 * Optional helper: loads supabase-js from a CDN import.
 * This keeps the extension dependency-light while still demonstrating
 * a Supabase client initialization pattern for extension projects.
 */
async function initSupabaseClientFromCdn() {
  if (!SUPABASE_URL.startsWith("https://") || SUPABASE_ANON_KEY === "YOUR_SUPABASE_ANON_KEY") {
    return null;
  }

  try {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm");
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (error) {
    console.warn("Supabase CDN import failed in this environment:", error);
    return null;
  }
}

function sendMessage(type, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error || "Request failed"));
        return;
      }

      resolve(response);
    });
  });
}

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString();
}

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

function renderNotes(notes) {
  noteList.innerHTML = "";

  if (!notes.length) {
    noteList.innerHTML = '<p class="empty">No notes yet. Highlight text on any page to save one.</p>';
    return;
  }

  const grouped = notes.reduce((acc, note) => {
    const domain = note.domain || getDomain(note.url);
    if (!acc[domain]) {
      acc[domain] = [];
    }
    acc[domain].push(note);
    return acc;
  }, {});

  Object.entries(grouped).forEach(([domain, domainNotes]) => {
    const group = document.createElement("section");
    group.className = "domain-group";

    const heading = document.createElement("h2");
    heading.textContent = domain;
    group.appendChild(heading);

    domainNotes.forEach((note) => {
      const card = document.createElement("article");
      card.className = "note-card";

      const text = document.createElement("p");
      text.className = "note-text";
      text.textContent = note.text;

      const meta = document.createElement("p");
      meta.className = "note-meta";
      meta.textContent = `${formatTime(note.created_at)} • ${note.source}`;

      const link = document.createElement("a");
      link.href = note.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Open source";

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.className = "danger";
      deleteBtn.addEventListener("click", async () => {
        await sendMessage("DELETE_NOTE", { id: note.id, source: note.source });
        await refreshNotes();
      });

      card.append(text, meta, link, deleteBtn);
      group.appendChild(card);
    });

    noteList.appendChild(group);
  });
}

function applySearch() {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) {
    renderNotes(allNotes);
    return;
  }

  const filtered = allNotes.filter((note) => {
    const haystack = `${note.text} ${note.url} ${note.domain}`.toLowerCase();
    return haystack.includes(query);
  });

  renderNotes(filtered);
}

async function refreshNotes() {
  const response = await sendMessage("GET_NOTES");
  allNotes = response.notes || [];
  applySearch();
}

function updateAuthStatus() {
  const loggedIn = Boolean(currentSession?.user?.id);

  if (loggedIn) {
    authStatus.textContent = currentSession?.user?.email
      ? `Logged in as ${currentSession.user.email}`
      : "Logged in";
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
  } else {
    authStatus.textContent = "Not logged in";
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
  }
}

async function init() {
  // Optional Supabase client init via CDN import as requested.
  await initSupabaseClientFromCdn();

  const authResponse = await sendMessage("GET_AUTH");
  currentSession = authResponse.session || null;
  updateAuthStatus();

  await refreshNotes();
}

loginBtn.addEventListener("click", async () => {
  try {
    const response = await sendMessage("LOGIN_GOOGLE");
    currentSession = response.session;
    updateAuthStatus();
    await refreshNotes();
  } catch (error) {
    authStatus.textContent = `Login failed: ${error.message}`;
  }
});

logoutBtn.addEventListener("click", async () => {
  await sendMessage("LOGOUT");
  currentSession = null;
  updateAuthStatus();
  await refreshNotes();
});

searchInput.addEventListener("input", applySearch);

init().catch((error) => {
  noteList.innerHTML = `<p class="empty">Error: ${error.message}</p>`;
});
