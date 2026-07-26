(() => {
  const TOOLTIP_ENABLED_KEY = "selectionTooltipEnabled";
  const CUSTOM_TAGS_KEY = "customTags";
  const PENDING_HIGHLIGHT_KEY = "pendingHighlight";
  const DEFAULT_PLAN = {
    tier: "free",
    label: "Free",
    maxNotes: 25,
    maxNoteCharacters: 700,
    allowedExportFormats: ["pdf"]
  };

  let tooltipElement = null;
  let selectedText = "";
  let tooltipEnabled = true;
  let customTags = [];
  let currentPlan = { ...DEFAULT_PLAN };
  let saveDock = null;
  let dockFadeTimer = null;
  let activeHighlightMarks = [];

  function getStorage(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime.lastError) {
          resolve(undefined);
          return;
        }
        resolve(result ? result[key] : undefined);
      });
    });
  }

  function setStorage(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set(data, () => resolve());
    });
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function clearActiveHighlights() {
    activeHighlightMarks.forEach((mark) => {
      const parent = mark.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
      parent.normalize();
    });
    activeHighlightMarks = [];
  }

  function findTextNodeMatch(searchText) {
    const target = normalizeText(searchText);
    if (!target) return null;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"].includes(tag)) {
          return NodeFilter.FILTER_REJECT;
        }
        return normalizeText(node.textContent).length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });

    let current;
    while ((current = walker.nextNode())) {
      const rawText = current.textContent || "";
      const normalizedNodeText = normalizeText(rawText);
      const normalizedIndex = normalizedNodeText.toLowerCase().indexOf(target.toLowerCase());
      if (normalizedIndex === -1) continue;

      const trimmedLeading = rawText.match(/^\s*/)?.[0].length || 0;
      const start = trimmedLeading + normalizedIndex;
      const end = Math.min(rawText.length, start + target.length);
      return { node: current, start, end };
    }

    return null;
  }

  function highlightPendingText(searchText) {
    clearActiveHighlights();
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }

    if (typeof window.find === "function" && window.find(searchText, false, false, true, false, true, false)) {
      const selectedRange = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
      const selectedNode = selectedRange?.startContainer?.parentElement || null;
      if (selectedNode && typeof selectedNode.scrollIntoView === "function") {
        selectedNode.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return true;
    }

    const match = findTextNodeMatch(searchText);
    if (!match) return false;

    const range = document.createRange();
    range.setStart(match.node, match.start);
    range.setEnd(match.node, match.end);

    const mark = document.createElement("mark");
    mark.style.background = "#fde68a";
    mark.style.color = "#111827";
    mark.style.padding = "0 2px";
    mark.style.borderRadius = "3px";
    mark.style.boxShadow = "0 0 0 1px rgba(245, 158, 11, 0.18)";

    range.surroundContents(mark);
    activeHighlightMarks = [mark];
    mark.scrollIntoView({ behavior: "smooth", block: "center" });
    return true;
  }

  function urlsMatch(candidateUrl) {
    try {
      const current = new URL(window.location.href);
      const target = new URL(candidateUrl);
      return (
        current.origin === target.origin &&
        current.pathname === target.pathname &&
        current.search === target.search
      );
    } catch {
      return false;
    }
  }

  async function tryPendingHighlight() {
    const pending = await getStorage(PENDING_HIGHLIGHT_KEY);
    if (!pending?.url || !pending?.text) return;
    if (!urlsMatch(pending.url)) return;
    if (Date.now() - Number(pending.createdAt || 0) > 2 * 60 * 1000) {
      await setStorage({ [PENDING_HIGHLIGHT_KEY]: null });
      return;
    }

    const apply = () => {
      if (highlightPendingText(pending.text)) {
        setStorage({ [PENDING_HIGHLIGHT_KEY]: null });
        return true;
      }
      return false;
    };

    if (apply()) return;

    let attempts = 0;
    const timer = setInterval(async () => {
      attempts += 1;
      if (apply() || attempts >= 10) {
        clearInterval(timer);
        if (attempts >= 10) {
          await setStorage({ [PENDING_HIGHLIGHT_KEY]: null });
        }
      }
    }, 500);
  }

  async function loadTooltipSetting() {
    const saved = await getStorage(TOOLTIP_ENABLED_KEY);
    tooltipEnabled = saved !== false;
  }

  async function loadCustomTags() {
    const tags = await getStorage(CUSTOM_TAGS_KEY);
    customTags = Array.isArray(tags) ? tags : [];
  }

  async function loadPlan() {
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: "GET_PLAN" }, (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(result);
        });
      });
      currentPlan = response?.plan || { ...DEFAULT_PLAN };
    } catch {
      currentPlan = { ...DEFAULT_PLAN };
    }
  }

  function isDarkTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ||
      document.body.getAttribute("data-theme") === "dark";
  }

  function removeTooltip() {
    if (tooltipElement) {
      tooltipElement.remove();
      tooltipElement = null;
    }
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function alignElementInViewport(element, preferredX, preferredY, padding = 12) {
    const rect = element.getBoundingClientRect();
    const minLeft = window.scrollX + padding;
    const maxLeft = window.scrollX + window.innerWidth - rect.width - padding;
    const minTop = window.scrollY + padding;
    const maxTop = window.scrollY + window.innerHeight - rect.height - padding;

    const left = clamp(preferredX, minLeft, Math.max(minLeft, maxLeft));
    const top = clamp(preferredY, minTop, Math.max(minTop, maxTop));

    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
  }

  function alignSettingsPanel(panel, toolsHost) {
    panel.style.left = "auto";
    panel.style.right = "0";
    panel.style.top = "30px";
    panel.style.bottom = "auto";

    const hostRect = toolsHost.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const padding = 12;

    if (hostRect.right - panelRect.width < padding) {
      panel.style.right = "auto";
      panel.style.left = "0";
    }

    if (hostRect.bottom + panelRect.height + 30 > window.innerHeight - padding) {
      panel.style.top = "auto";
      panel.style.bottom = "30px";
    }
  }

  function ensureSaveDock() {
    if (saveDock) {
      return saveDock;
    }

    saveDock = document.createElement("div");
    saveDock.style.position = "fixed";
    saveDock.style.top = "14px";
    saveDock.style.right = "14px";
    saveDock.style.width = "34px";
    saveDock.style.height = "26px";
    saveDock.style.display = "flex";
    saveDock.style.flexDirection = "column";
    saveDock.style.alignItems = "flex-start";
    saveDock.style.justifyContent = "flex-start";
    saveDock.style.zIndex = "2147483647";
    saveDock.style.opacity = "0.95";
    saveDock.style.transition = "opacity 500ms ease";
    saveDock.style.pointerEvents = "none";

    const folderTab = document.createElement("div");
    folderTab.style.width = "13px";
    folderTab.style.height = "6px";
    folderTab.style.marginLeft = "3px";
    folderTab.style.borderTopLeftRadius = "4px";
    folderTab.style.borderTopRightRadius = "4px";
    folderTab.style.background = "#475569";
    folderTab.style.border = "1px solid #64748b";
    folderTab.style.borderBottom = "none";

    const folderBody = document.createElement("div");
    folderBody.style.width = "100%";
    folderBody.style.height = "20px";
    folderBody.style.borderRadius = "4px";
    folderBody.style.border = "1px solid #64748b";
    folderBody.style.background = "linear-gradient(180deg, #334155 0%, #1f2937 100%)";
    folderBody.style.boxShadow = "0 8px 14px rgba(15, 23, 42, 0.35)";

    saveDock.append(folderTab, folderBody);
    document.body.appendChild(saveDock);
    return saveDock;
  }

  function scheduleDockFade() {
    if (!saveDock) return;
    if (dockFadeTimer) {
      clearTimeout(dockFadeTimer);
    }
    dockFadeTimer = setTimeout(() => {
      if (!saveDock) return;
      saveDock.style.opacity = "0";
      setTimeout(() => {
        if (saveDock) {
          saveDock.remove();
          saveDock = null;
        }
      }, 450);
    }, 2000);
  }

  function playSaveAnimation() {
    if (!tooltipElement) {
      return;
    }
    const dock = ensureSaveDock();
    const source = tooltipElement.getBoundingClientRect();
    const target = dock.getBoundingClientRect();

    const ghost = tooltipElement.cloneNode(true);
    ghost.style.position = "fixed";
    ghost.style.left = `${source.left}px`;
    ghost.style.top = `${source.top}px`;
    ghost.style.width = `${source.width}px`;
    ghost.style.zIndex = "2147483647";
    ghost.style.pointerEvents = "none";
    ghost.style.transition =
      "transform 1250ms cubic-bezier(0.22, 1, 0.36, 1), opacity 1250ms ease-out";
    document.body.appendChild(ghost);

    tooltipElement.style.display = "none";

    requestAnimationFrame(() => {
      const dx = target.left + target.width / 2 - (source.left + source.width / 2);
      const dy = target.top + target.height / 2 - (source.top + source.height / 2);
      ghost.style.transform = `translate(${dx}px, ${dy}px) scale(0.16)`;
      ghost.style.opacity = "0.08";
    });

    setTimeout(() => {
      ghost.remove();
      removeTooltip();
      dock.style.opacity = "1";
      setTimeout(() => {
        dock.style.opacity = "0.9";
      }, 320);
      scheduleDockFade();
    }, 1290);
  }

  async function saveCustomTags(tags) {
    const merged = [...new Set([...customTags, ...tags])].sort((a, b) => a.localeCompare(b));
    customTags = merged;
    await setStorage({ [CUSTOM_TAGS_KEY]: merged });
  }

  function sendSaveMessage(tags = []) {
    if (!selectedText) {
      return;
    }

    const payload = {
      text: selectedText,
      url: window.location.href,
      title: document.title,
      createdAt: new Date().toISOString(),
      tags
    };

    chrome.runtime.sendMessage({ type: "SAVE_NOTE", payload }, (response) => {
      if (!response?.ok) {
        alert(response?.error || "Could not save note.");
        return;
      }
      removeTooltip();
    });
  }

  function createContainer(x, y) {
    removeTooltip();

    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = `${x}px`;
    container.style.top = `${y}px`;
    container.style.zIndex = "2147483647";
    container.style.display = "inline-flex";
    container.style.alignItems = "center";
    container.style.gap = "6px";

    container.addEventListener("mousedown", (event) => {
      event.stopPropagation();
    });

    tooltipElement = container;
    document.body.appendChild(container);
    return container;
  }

  function createPowerButton(compact = false) {
    const powerBtn = document.createElement("button");
    powerBtn.type = "button";
    powerBtn.textContent = "⏻";
    powerBtn.title = "Tooltip settings";
    powerBtn.style.width = compact ? "8px" : "24px";
    powerBtn.style.height = compact ? "8px" : "24px";
    powerBtn.style.borderRadius = "50%";
    powerBtn.style.border = "1px solid #64748b";
    powerBtn.style.background = "#0f172a";
    powerBtn.style.color = "#fff";
    powerBtn.style.fontSize = compact ? "0px" : "13px";
    powerBtn.style.cursor = "pointer";
    powerBtn.style.padding = "0";
    powerBtn.style.boxShadow = "0 6px 14px rgba(0,0,0,0.25)";

    if (compact) {
      powerBtn.addEventListener("mouseenter", () => {
        powerBtn.style.width = "24px";
        powerBtn.style.height = "24px";
        powerBtn.style.fontSize = "13px";
      });
      powerBtn.addEventListener("mouseleave", () => {
        powerBtn.style.width = "8px";
        powerBtn.style.height = "8px";
        powerBtn.style.fontSize = "0px";
      });
    }

    return powerBtn;
  }

  function createSettingsPopup(initialEnabled, onChange) {
    const darkTheme = isDarkTheme();
    const panel = document.createElement("div");
    panel.style.position = "absolute";
    panel.style.top = "30px";
    panel.style.right = "0";
    panel.style.background = darkTheme ? "#111827" : "#0f172a";
    panel.style.border = darkTheme ? "1px solid #334155" : "1px solid #334155";
    panel.style.borderRadius = "8px";
    panel.style.padding = "8px 10px";
    panel.style.minWidth = "210px";
    panel.style.boxShadow = "0 10px 20px rgba(0,0,0,0.18)";
    panel.style.fontSize = "12px";
    panel.style.color = "#ffffff";
    panel.style.display = "none";

    const row = document.createElement("label");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "8px";
    row.style.flexWrap = "nowrap";
    row.style.whiteSpace = "nowrap";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = initialEnabled;
    checkbox.style.margin = "0";
    checkbox.style.accentColor = darkTheme ? "#60a5fa" : "#93c5fd";

    const text = document.createElement("span");
    text.textContent = (currentTranslations && currentTranslations.enableTooltip) || "Enable SnapText tooltip";
    text.style.color = "#ffffff";
    text.style.lineHeight = "1";

    checkbox.addEventListener("change", async () => {
      const enabled = checkbox.checked;
      await onChange(enabled);
    });

    row.append(checkbox, text);
    panel.appendChild(row);
    return panel;
  }

  function renderTooltip(x, y) {
    const container = createContainer(x, y);

    if (tooltipEnabled) {
      const tagSelect = document.createElement("select");
      tagSelect.style.padding = "6px 8px";
      tagSelect.style.borderRadius = "8px";
      tagSelect.style.border = "1px solid #cbd5e1";
      tagSelect.style.fontSize = "12px";
      tagSelect.style.height = "32px";
      tagSelect.style.maxWidth = "170px";
      tagSelect.style.background = "#111827";
      tagSelect.style.color = "#ffffff";

      const emptyOption = document.createElement("option");
      const t = currentTranslations || {};
      emptyOption.value = "";
      emptyOption.textContent = t.noTag || "No tag";
      tagSelect.appendChild(emptyOption);

      customTags.forEach((tag) => {
        const option = document.createElement("option");
        option.value = tag;
        option.textContent = tag;
        tagSelect.appendChild(option);
      });

      const addOption = document.createElement("option");
      addOption.value = "__new__";
      addOption.textContent = t.createTag || "+ Create new tag";
      tagSelect.appendChild(addOption);

      tagSelect.addEventListener("change", async () => {
        if (tagSelect.value !== "__new__") {
          return;
        }
        const newTag = prompt(t.enterNewTag || "Enter new tag name:");
        if (!newTag || !newTag.trim()) {
          tagSelect.value = "";
          return;
        }
        const cleanTag = newTag.trim();
        await saveCustomTags([cleanTag]);
        tagSelect.innerHTML = "";
        const options = [t.noTag || "No tag", ...customTags, t.createTag || "+ Create new tag"];
        options.forEach((label, index) => {
          const opt = document.createElement("option");
          if (index === 0) opt.value = "";
          else if (index === options.length - 1) opt.value = "__new__";
          else opt.value = label;
          opt.textContent = label;
          tagSelect.appendChild(opt);
        });
        tagSelect.value = cleanTag;
      });

      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.textContent = t.saveNoteBtn || "Save Note";
      saveBtn.style.padding = "6px 10px";
      saveBtn.style.borderRadius = "8px";
      saveBtn.style.border = "1px solid #d4d4d8";
      saveBtn.style.background = "#111827";
      saveBtn.style.color = "#ffffff";
      saveBtn.style.fontSize = "12px";
      saveBtn.style.cursor = "pointer";
      saveBtn.style.boxShadow = "0 8px 20px rgba(0,0,0,0.2)";
      saveBtn.style.height = "32px";
      saveBtn.style.minWidth = "86px";

      const charCount = document.createElement("span");
      charCount.style.fontSize = "11px";
      charCount.style.fontWeight = "600";
      charCount.style.minWidth = "78px";
      charCount.style.textAlign = "center";
      charCount.style.padding = "6px 8px";
      charCount.style.borderRadius = "8px";
      charCount.style.border = "1px solid #d4d4d8";
      charCount.style.background = "#111827";
      charCount.style.height = "32px";
      charCount.style.boxSizing = "border-box";
      charCount.style.display = "inline-flex";
      charCount.style.alignItems = "center";
      charCount.style.justifyContent = "center";
      charCount.style.boxShadow = "0 8px 20px rgba(0,0,0,0.2)";
      const selectedLength = selectedText.length;
      const maxCharacters = Number(currentPlan?.maxNoteCharacters) || DEFAULT_PLAN.maxNoteCharacters;
      const overLimit = selectedLength > maxCharacters;
      charCount.textContent = `${selectedLength}/${maxCharacters}`;
      charCount.style.color = overLimit ? "#f87171" : "#93c5fd";
      saveBtn.disabled = overLimit;
      saveBtn.style.opacity = overLimit ? "0.65" : "1";
      saveBtn.title = overLimit
        ? `Selection is ${selectedLength}/${maxCharacters} characters`
        : "Save highlighted text";

      saveBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (selectedLength > maxCharacters) {
          alert(
            `Selected text is ${selectedLength} characters. Maximum allowed is ${maxCharacters}.`
          );
          return;
        }
        const selectedTag = tagSelect.value && tagSelect.value !== "__new__" ? tagSelect.value : "";
        const tags = selectedTag ? [selectedTag] : [];
        playSaveAnimation();
        sendSaveMessage(tags);
      });

      const actionRow = document.createElement("div");
      actionRow.style.display = "flex";
      actionRow.style.alignItems = "center";
      actionRow.style.gap = "6px";
      actionRow.style.flexWrap = "nowrap";

      actionRow.append(saveBtn, tagSelect);
      actionRow.appendChild(charCount);
      container.appendChild(actionRow);
    }

    const toolsHost = document.createElement("div");
    toolsHost.style.position = "relative";

    const powerBtn = createPowerButton(!tooltipEnabled);
    const settingsPanel = createSettingsPopup(tooltipEnabled, async (enabled) => {
      tooltipEnabled = enabled;
      await setStorage({ [TOOLTIP_ENABLED_KEY]: tooltipEnabled });
      renderTooltip(x, y);
    });

    powerBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nextDisplay = settingsPanel.style.display === "none" ? "block" : "none";
      settingsPanel.style.display = nextDisplay;
      if (nextDisplay === "block") {
        alignSettingsPanel(settingsPanel, toolsHost);
      }
    });

    toolsHost.append(powerBtn, settingsPanel);
    container.appendChild(toolsHost);
    alignElementInViewport(container, x, y);
  }

  async function handleSelectionEnd() {
    await loadCustomTags();
    await loadPlan();
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : "";

    if (!text) {
      selectedText = "";
      removeTooltip();
      return;
    }

    selectedText = text;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    const x = window.scrollX + rect.left;
    const y = window.scrollY + rect.bottom + 8;

    renderTooltip(x, y);
  }

  document.addEventListener("mouseup", (event) => {
    if (tooltipElement && tooltipElement.contains(event.target)) {
      return;
    }
    setTimeout(() => {
      handleSelectionEnd();
    }, 10);
  });

  document.addEventListener("mousedown", (event) => {
    if (tooltipElement && !tooltipElement.contains(event.target)) {
      removeTooltip();
    }
  });

  window.addEventListener("scroll", () => {
    if (tooltipElement) {
      removeTooltip();
    }
  });

  loadTooltipSetting();
  loadCustomTags();
  tryPendingHighlight();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (Object.prototype.hasOwnProperty.call(changes, TOOLTIP_ENABLED_KEY)) {
      tooltipEnabled = changes[TOOLTIP_ENABLED_KEY].newValue !== false;
    }
    if (Object.prototype.hasOwnProperty.call(changes, CUSTOM_TAGS_KEY)) {
      const nextTags = changes[CUSTOM_TAGS_KEY].newValue;
      customTags = Array.isArray(nextTags) ? nextTags : [];
    }
    if (Object.prototype.hasOwnProperty.call(changes, PENDING_HIGHLIGHT_KEY)) {
      tryPendingHighlight();
    }
  });
})();

// i18n support for tooltip
let currentTranslations = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "UPDATE_LANGUAGE") {
    currentTranslations = message.translations;
    // Re-render tooltip if it's currently visible
    if (tooltipElement) {
      const rect = tooltipElement.getBoundingClientRect();
      const x = window.scrollX + rect.left;
      const y = window.scrollY + rect.top;
      removeTooltip();
      renderTooltip(x, y);
    }
  }
});

// Initialize language for tooltip directly if popup hasn't opened yet
(async function initLanguageContent() {
  const src = chrome.runtime.getURL("locales.js");
  try {
    const { locales } = await import(src);
    const data = await chrome.storage.local.get("languageCode");
    let lang = data.languageCode;

    if (!lang) {
      const browserLang = navigator.language;
      const supported = ["en", "es", "zh-CN", "zh-TW", "ru", "fr", "de", "pt-BR", "ja", "it", "ko"];
      if (supported.includes(browserLang)) {
        lang = browserLang;
      } else {
        const base = browserLang.split("-")[0];
        if (supported.includes(base)) {
          lang = base;
        } else if (base === "zh") {
          lang = "zh-CN";
        } else if (base === "pt") {
          lang = "pt-BR";
        } else {
          lang = "en";
        }
      }
      // Save it so popup also uses it
      await chrome.storage.local.set({ languageCode: lang });
    }

    currentTranslations = locales[lang] || locales["en"];
  } catch (err) {
    console.error("Error loading locales in content script", err);
  }
})();
