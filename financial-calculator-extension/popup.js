const authButton = document.getElementById('authButton');
const notesContainer = document.getElementById('notesContainer');
const searchInput = document.getElementById('searchInput');
const statusText = document.getElementById('statusText');

let allNotes = [];
let currentUser = null;

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function groupByDomain(notes) {
  return notes.reduce((groups, note) => {
    const key = note.domain || 'unknown';
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(note);
    return groups;
  }, {});
}

function renderEmptyState(message) {
  notesContainer.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function renderNotes(notes) {
  if (!notes.length) {
    renderEmptyState('No notes yet. Highlight text on a page and click “Save Note”.');
    return;
  }

  const groupedNotes = groupByDomain(notes);
  const sections = Object.entries(groupedNotes)
    .map(([domain, domainNotes]) => {
      const items = domainNotes
        .map(
          (note) => `
            <article class="note-card" data-note-id="${note.id}">
              <p class="note-text">${escapeHtml(note.text)}</p>
              <a class="note-url" href="${escapeHtml(note.url)}" target="_blank">${escapeHtml(note.url)}</a>
              <div class="note-meta">
                <span>${formatDate(note.created_at)}</span>
                <span class="note-source ${note.source === 'cloud' ? 'is-cloud' : 'is-local'}">${note.source}</span>
              </div>
              <button class="delete-button" data-note-id="${note.id}">Delete</button>
            </article>
          `,
        )
        .join('');

      return `
        <section class="domain-group">
          <h2>${escapeHtml(domain)}</h2>
          ${items}
        </section>
      `;
    })
    .join('');

  notesContainer.innerHTML = sections;
}

function applySearchFilter() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = allNotes.filter((note) => {
    const haystack = `${note.text} ${note.url} ${note.domain || ''}`.toLowerCase();
    return haystack.includes(query);
  });

  renderNotes(filtered);
}

async function loadNotes() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_NOTES' });
  allNotes = response.notes || [];
  currentUser = response.user || null;

  statusText.textContent = currentUser
    ? `Signed in as ${currentUser.email}. Local notes and Supabase sync are active.`
    : 'Local notes are ready. Sign in to sync with Supabase.';

  authButton.textContent = currentUser ? 'Logout' : 'Login with Google';
  applySearchFilter();
}

async function handleDelete(noteId) {
  await chrome.runtime.sendMessage({
    type: 'DELETE_NOTE',
    noteId,
  });

  await loadNotes();
}

async function handleAuthClick() {
  if (currentUser) {
    await chrome.runtime.sendMessage({ type: 'LOGOUT' });
    await loadNotes();
    return;
  }

  authButton.disabled = true;
  authButton.textContent = 'Connecting...';

  const response = await chrome.runtime.sendMessage({ type: 'LOGIN' });
  authButton.disabled = false;

  if (!response.success) {
    statusText.textContent = response.error || 'Google login failed. Check your Supabase setup.';
    authButton.textContent = 'Login with Google';
    return;
  }

  await loadNotes();
}

authButton.addEventListener('click', handleAuthClick);
searchInput.addEventListener('input', applySearchFilter);

notesContainer.addEventListener('click', async (event) => {
  const deleteButton = event.target.closest('.delete-button');
  if (!deleteButton) {
    return;
  }

  const { noteId } = deleteButton.dataset;
  await handleDelete(noteId);
});

loadNotes().catch((error) => {
  console.error('Failed to load notes:', error);
  renderEmptyState('Unable to load notes. Open the background page console for details.');
});
