const FLOATING_BUTTON_ID = 'auto-note-taker-save-button';
let floatingButton = null;
let latestSelection = '';

function removeFloatingButton() {
  if (floatingButton) {
    floatingButton.remove();
    floatingButton = null;
  }
}

function createFloatingButton() {
  const button = document.createElement('button');
  button.id = FLOATING_BUTTON_ID;
  button.type = 'button';
  button.textContent = 'Save Note';

  button.addEventListener('mousedown', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });

  button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const noteText = latestSelection.trim();
    if (!noteText) {
      removeFloatingButton();
      return;
    }

    const payload = {
      text: noteText,
      url: window.location.href,
      pageTitle: document.title,
    };

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_NOTE',
        payload,
      });

      if (response?.success) {
        button.textContent = 'Saved';
        setTimeout(removeFloatingButton, 600);
      } else {
        button.textContent = 'Retry';
      }
    } catch (error) {
      console.error('Unable to save note:', error);
      button.textContent = 'Retry';
    }
  });

  document.body.appendChild(button);
  return button;
}

function showFloatingButton() {
  const selection = window.getSelection();
  const selectedText = selection ? selection.toString().trim() : '';

  if (!selection || !selectedText) {
    removeFloatingButton();
    return;
  }

  const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  const rect = range ? range.getBoundingClientRect() : null;

  if (!rect || (rect.width === 0 && rect.height === 0)) {
    removeFloatingButton();
    return;
  }

  latestSelection = selectedText;
  floatingButton = floatingButton || createFloatingButton();

  const top = window.scrollY + rect.top - 42;
  const left = window.scrollX + rect.left + rect.width / 2;

  floatingButton.style.top = `${Math.max(8, top)}px`;
  floatingButton.style.left = `${Math.max(8, left)}px`;
  floatingButton.style.display = 'block';
}

function handleSelectionChange() {
  window.setTimeout(showFloatingButton, 10);
}

document.addEventListener('selectionchange', handleSelectionChange);

document.addEventListener('mousedown', (event) => {
  if (floatingButton && !floatingButton.contains(event.target)) {
    removeFloatingButton();
  }
});

window.addEventListener('scroll', () => {
  if (floatingButton) {
    showFloatingButton();
  }
});
