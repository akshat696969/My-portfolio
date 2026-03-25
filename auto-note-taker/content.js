(() => {
  let floatingButton = null;
  let selectedText = "";

  function removeButton() {
    if (floatingButton) {
      floatingButton.remove();
      floatingButton = null;
    }
  }

  function createButton(x, y) {
    removeButton();

    floatingButton = document.createElement("button");
    floatingButton.textContent = "Save Note";
    floatingButton.setAttribute("type", "button");
    floatingButton.style.position = "absolute";
    floatingButton.style.left = `${x}px`;
    floatingButton.style.top = `${y}px`;
    floatingButton.style.zIndex = "2147483647";
    floatingButton.style.padding = "6px 10px";
    floatingButton.style.borderRadius = "8px";
    floatingButton.style.border = "1px solid #d4d4d8";
    floatingButton.style.background = "#111827";
    floatingButton.style.color = "#ffffff";
    floatingButton.style.fontSize = "12px";
    floatingButton.style.cursor = "pointer";
    floatingButton.style.boxShadow = "0 8px 20px rgba(0,0,0,0.2)";

    floatingButton.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    floatingButton.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (!selectedText) {
        return;
      }

      const payload = {
        text: selectedText,
        url: window.location.href,
        title: document.title,
        createdAt: new Date().toISOString()
      };

      chrome.runtime.sendMessage({ type: "SAVE_NOTE", payload }, () => {
        removeButton();
      });
    });

    document.body.appendChild(floatingButton);
  }

  function handleSelectionEnd() {
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : "";

    if (!text) {
      selectedText = "";
      removeButton();
      return;
    }

    selectedText = text;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    const x = window.scrollX + rect.left;
    const y = window.scrollY + rect.bottom + 8;

    createButton(x, y);
  }

  document.addEventListener("mouseup", () => {
    // Delay so browser selection state is fully updated.
    setTimeout(handleSelectionEnd, 10);
  });

  document.addEventListener("mousedown", (event) => {
    if (floatingButton && event.target !== floatingButton) {
      removeButton();
    }
  });

  window.addEventListener("scroll", () => {
    // Hide the button while scrolling to avoid odd positioning.
    if (floatingButton) {
      removeButton();
    }
  });
})();
