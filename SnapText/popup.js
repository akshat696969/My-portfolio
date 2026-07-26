import { locales } from "./locales.js";

const authStatus = document.getElementById("authStatus");
const languageSelect = document.getElementById("languageSelect");
let currentLanguage = "en";
const popupHeader = document.getElementById("popupHeader");
const mainFooterTip = document.getElementById("mainFooterTip");
const planBadge = document.getElementById("planBadge");
const upgradeProBtn = document.getElementById("upgradeProBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const searchInput = document.getElementById("searchInput");
const noteList = document.getElementById("noteList");
const themeToggle = document.getElementById("themeToggle");
const recycleToggleBtn = document.getElementById("recycleToggleBtn");
const recycleCountBadge = document.getElementById("recycleCountBadge");
const recycleBackBtn = document.getElementById("recycleBackBtn");
const mainView = document.getElementById("mainView");
const upgradeView = document.getElementById("upgradeView");
const upgradeBackBtn = document.getElementById("upgradeBackBtn");
const recycleView = document.getElementById("recycleView");
const supportView = document.getElementById("supportView");
const upgradeThemeToggle = document.getElementById("upgradeThemeToggle");
const licenseKeyInput = document.getElementById("licenseKeyInput");
const verifyLicenseBtn = document.getElementById("verifyLicenseBtn");
const recheckLicenseBtn = document.getElementById("recheckLicenseBtn");
const manageSubscriptionBtn = document.getElementById("manageSubscriptionBtn");
const licenseStatus = document.getElementById("licenseStatus");
const pricingCards = Array.from(document.querySelectorAll(".pricing-card"));
const buyProBtn = document.getElementById("buyProBtn");
const upgradeEyebrow = document.getElementById("upgradeEyebrow");
const upgradeTitle = document.getElementById("upgradeTitle");
const upgradeSubtitle = document.getElementById("upgradeSubtitle");
const featuresHeading = document.getElementById("featuresHeading");
const featuresSubtitle = document.getElementById("featuresSubtitle");
const upgradePricing = document.getElementById("upgradePricing");
const upgradeTrust = document.getElementById("upgradeTrust");
const upgradeReminder = document.getElementById("upgradeReminder");
const licensePanel = document.getElementById("licensePanel");
const licenseHeading = document.getElementById("licenseHeading");
const licenseSubtitle = document.getElementById("licenseSubtitle");
const upgradeManageNote = document.getElementById("upgradeManageNote");
const recycleList = document.getElementById("recycleList");
const restoreSelectedBtn = document.getElementById("restoreSelectedBtn");
const deleteSelectedBinBtn = document.getElementById("deleteSelectedBinBtn");
const restoreAllBtn = document.getElementById("restoreAllBtn");
const emptyBinBtn = document.getElementById("emptyBinBtn");
const exportFormat = document.getElementById("exportFormat");
const exportBtn = document.getElementById("exportBtn");

const deleteSelectedBtn = document.getElementById("deleteSelectedBtn");
const selectAllVisible = document.getElementById("selectAllVisible");
const noteLimitText = document.getElementById("noteLimitText");
const noteLimitBar = document.getElementById("noteLimitBar");
const newTagInput = document.getElementById("newTagInput");
const tagFilterSelect = document.getElementById("tagFilterSelect");
const filterTagsBtn = document.getElementById("filterTagsBtn");
const supportCancelBtn = document.getElementById("supportCancelBtn");
const supportSendBtn = document.getElementById("supportSendBtn");
const supportCategory = document.getElementById("supportCategory");
const supportMessage = document.getElementById("supportMessage");
const supportEmail = document.getElementById("supportEmail");
const supportStatus = document.getElementById("supportStatus");
const supportFormPanel = document.getElementById("supportFormPanel");
const supportSuccessPanel = document.getElementById("supportSuccessPanel");
const supportAccountEmail = document.getElementById("supportAccountEmail");
const supportSentAt = document.getElementById("supportSentAt");

const THEME_KEY = "themeMode";
const TAGS_KEY = "customTags";
const PRO_LICENSE_KEY = "proLicense";
const IS_PRO_KEY = "isPro";
const LICENSE_KEY = "licenseKey";
const VIEW_TRANSITION_MS = 260;
const FREE_EXPORT_FORMATS = ["pdf"];
const PRO_OPTION_ICON = "\u2655";
const EMAILJS_PUBLIC_KEY = "cgZ0PhKJUCfCW_Yl6";
const EMAILJS_PRIVATE_KEY = "JaWESTn12CD60Iah3P4GO";
const EMAILJS_SERVICE_ID = "service_skkaz7i";
const EMAILJS_TEMPLATE_ID = "template_txk1jxp";
const EMAILJS_ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send-form";
const DEFAULT_FREE_PLAN = {
  tier: "free",
  label: "Free",
  maxNotes: 25,
  maxNoteCharacters: 700,
  allowedExportFormats: ["pdf"]
};

let allNotes = [];
let visibleNotes = [];
let currentSession = null;
let currentPlan = { ...DEFAULT_FREE_PLAN };
let customTags = [];
let tagFilterActive = false;
const selectedNoteKeys = new Set();
let recycleBinNotes = [];
const selectedBinKeys = new Set();
let loginInProgress = false;
let activeView = "main";
let selectedUpgradePlan = "yearly";
let licenseState = null;
let pdfBrandAssets = null;
const UPGRADE_PLAN_CONFIG = {
  monthly: {
    ctaLabel: "$2.99/month",
    url: "https://erenhq.gumroad.com/l/snaptextpro?wanted=true"
  },
  quarterly: {
    ctaLabel: "$7.99/3 months",
    url: "https://erenhq.gumroad.com/l/snaptextproquarterly?wanted=true"
  },
  yearly: {
    ctaLabel: "$19.99/year",
    url: "https://erenhq.gumroad.com/l/snaptextproyearly?wanted=true"
  }
};
const GUMROAD_MANAGE_URL = "https://gumroad.com/library";

function noteKey(note) {
  return `${note.source}:${note.id}`;
}

function binKey(item) {
  return item.bin_id;
}

function getStorage(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(result);
    });
  });
}

function setStorage(data) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(data, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file data."));
    reader.readAsDataURL(blob);
  });
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

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

function applyTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.body.setAttribute("data-theme", nextTheme);
  themeToggle.textContent = nextTheme === "dark" ? "\u25D0" : "\u2600";
  themeToggle.title = nextTheme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  if (upgradeThemeToggle) {
    upgradeThemeToggle.textContent = themeToggle.textContent;
    upgradeThemeToggle.title = themeToggle.title;
  }
}

function updateLicenseStatus(message = "", state = "") {
  licenseStatus.textContent = message;
  licenseStatus.className = "license-status";
  if (state) {
    licenseStatus.classList.add(`license-status--${state}`);
  }
}

function hydrateLicenseInput() {
  licenseKeyInput.value = licenseState?.licenseKey || "";
  if (licenseState?.activated) {
    updateLicenseStatus("Pro license is active on this signed-in browser.", "success");
  } else {
    updateLicenseStatus("", "");
  }
  syncLicenseActionState();
}

function applyUpgradeSelection(planKey = selectedUpgradePlan) {
  selectedUpgradePlan = UPGRADE_PLAN_CONFIG[planKey] ? planKey : "yearly";

  pricingCards.forEach((card) => {
    const isSelected = card.dataset.plan === selectedUpgradePlan;
    card.classList.toggle("is-selected", isSelected);
    card.setAttribute("aria-pressed", String(isSelected));
  });

  buyProBtn.textContent = `Buy Pro - ${UPGRADE_PLAN_CONFIG[selectedUpgradePlan].ctaLabel}`;
}

function updateSupportStatus(message = "", state = "") {
  supportStatus.textContent = message;
  supportStatus.className = "support-status";
  if (state) {
    supportStatus.classList.add(`support-status--${state}`);
  }
}

function resetSupportForm({ preserveMessage = true } = {}) {
  supportFormPanel.style.display = "block";
  supportSuccessPanel.style.display = "none";
  supportSendBtn.disabled = false;
  supportSendBtn.textContent = "Send Message";
  supportCategory.value = "Bug";
  if (!preserveMessage) {
    supportMessage.value = "";
  }
  supportEmail.value = currentSession?.user?.email || supportEmail.value || "";
  supportAccountEmail.value = currentSession?.user?.email || "";
  supportSentAt.value = "";
  updateSupportStatus("", "");
}

function prepareSupportView() {
  resetSupportForm();
  if (!supportEmail.value.trim() && currentSession?.user?.email) {
    supportEmail.value = currentSession.user.email;
  }
}

async function submitSupportMessage() {
  supportAccountEmail.value = currentSession?.user?.email || "";
  supportSentAt.value = new Date().toLocaleString();

  const formData = new FormData(supportFormPanel);
  formData.append("service_id", EMAILJS_SERVICE_ID);
  formData.append("template_id", EMAILJS_TEMPLATE_ID);
  formData.append("user_id", EMAILJS_PUBLIC_KEY);
  formData.append("accessToken", EMAILJS_PRIVATE_KEY);

  const response = await fetch(EMAILJS_ENDPOINT, {
    method: "POST",
    body: formData
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || "Could not send your message. Please try again.");
  }

  return text;
}

async function loadLicenseState(prefetchedState = undefined) {
  if (!currentSession?.user?.id) {
    licenseState = null;
    hydrateLicenseInput();
    return;
  }

  if (prefetchedState !== undefined) {
    licenseState = prefetchedState && prefetchedState.userId === currentSession.user.id
      ? prefetchedState
      : null;
  } else {
    try {
      const response = await sendMessage("GET_LICENSE_STATE");
      const remoteState = response?.licenseState;
      if (remoteState && remoteState.userId === currentSession.user.id) {
        licenseState = remoteState;
      } else {
        licenseState = null;
      }
    } catch {
      const storage = await getStorage([PRO_LICENSE_KEY]);
      if (storage[PRO_LICENSE_KEY] && typeof storage[PRO_LICENSE_KEY] === "object") {
        const storedState = storage[PRO_LICENSE_KEY];
        if (storedState.userId === currentSession.user.id) {
          licenseState = storedState;
        } else {
          licenseState = null;
        }
      } else {
        licenseState = null;
      }
    }
  }
  hydrateLicenseInput();
}

function matchesPlaceholderLicenseFormat(licenseKey) {
  return /^[A-Za-z0-9-]{8,}$/.test(licenseKey);
}

async function persistLicenseState(nextState) {
  licenseState = {
    ...nextState,
    userId: nextState?.userId || currentSession?.user?.id || null
  };
  await setStorage({
    [PRO_LICENSE_KEY]: licenseState,
    [IS_PRO_KEY]: Boolean(licenseState?.activated),
    [LICENSE_KEY]: licenseState?.licenseKey || null
  });
  syncLicenseActionState();
}

async function clearLicenseState() {
  licenseState = null;
  await setStorage({
    [PRO_LICENSE_KEY]: null,
    [IS_PRO_KEY]: false,
    [LICENSE_KEY]: null
  });
  licenseKeyInput.value = "";
  syncLicenseActionState();
}

function syncLicenseActionState() {
  const hasLicense = Boolean(isSignedIn() && licenseState?.activated && licenseState?.licenseKey);
  const canManageSubscription = Boolean(isSignedIn() && isCurrentPlanPro());
  verifyLicenseBtn.disabled = !isSignedIn() || hasLicense;
  licenseKeyInput.disabled = !isSignedIn();
  recheckLicenseBtn.disabled = !hasLicense;
  manageSubscriptionBtn.disabled = !canManageSubscription;
}

function proFeatureLabel(label) {
  return `${PRO_OPTION_ICON} ${label}`;
}

function updateFilterUI() {
  const isPro = isCurrentPlanPro();

  if (!isPro && tagFilterActive) {
    tagFilterActive = false;
    Array.from(tagFilterSelect.options).forEach((option) => {
      option.selected = false;
    });
    if (allNotes.length) {
      applySearch();
    }
  }

  filterTagsBtn.textContent = isPro
    ? (tagFilterActive ? "Clear Filter" : "Filter")
    : "Filter";
  filterTagsBtn.classList.toggle("active-filter", isPro && tagFilterActive);
  filterTagsBtn.classList.toggle("locked-pro-feature", !isPro);
}

function applyPlan(plan) {
  currentPlan = {
    tier: plan?.tier || "free",
    label: plan?.label || "Free",
    maxNotes: Number(plan?.maxNotes) || 25,
    maxNoteCharacters: Number(plan?.maxNoteCharacters) || 700,
    allowedExportFormats: Array.isArray(plan?.allowedExportFormats)
      ? plan.allowedExportFormats
      : [...FREE_EXPORT_FORMATS]
  };

  planBadge.textContent = currentPlan.label;
  planBadge.classList.toggle("plan-badge--pro", currentPlan.tier === "pro");
  updateUpgradeAccessUI();

  Array.from(exportFormat.options).forEach((option) => {
    const allowed = currentPlan.allowedExportFormats.includes(option.value);
    option.disabled = !allowed;
    const plainLabel = option.value === "csv"
      ? "CSV"
      : option.value === "excel"
        ? "Excel"
        : option.value === "pdf"
          ? "PDF"
          : option.value === "markdown"
            ? "Markdown"
            : option.textContent;

    option.textContent = currentPlan.tier === "pro" || allowed
      ? plainLabel
      : proFeatureLabel(plainLabel);
  });

  if (!currentPlan.allowedExportFormats.includes(exportFormat.value)) {
    exportFormat.value = currentPlan.allowedExportFormats[0] || "pdf";
  }

  updateFilterUI();
}

async function initTheme() {
  const storage = await getStorage([THEME_KEY]);
  applyTheme(storage[THEME_KEY] || "light");
}

async function loadCustomTags() {
  const storage = await getStorage([TAGS_KEY]);
  customTags = Array.isArray(storage[TAGS_KEY]) ? storage[TAGS_KEY] : [];
  renderTagSelect();
}

function renderTagSelect() {
  tagFilterSelect.innerHTML = "";
  customTags.forEach((tag) => {
    const option = document.createElement("option");
    option.value = tag;
    option.textContent = tag;
    tagFilterSelect.appendChild(option);
  });
}

tagFilterSelect.addEventListener("mousedown", (event) => {
  const option = event.target;
  if (!(option instanceof HTMLOptionElement)) return;
  event.preventDefault();
  option.selected = !option.selected;
});

function updateSelectAllState() {
  if (!visibleNotes.length) {
    selectAllVisible.checked = false;
    selectAllVisible.indeterminate = false;
    return;
  }

  const checkedCount = visibleNotes.filter((note) => selectedNoteKeys.has(noteKey(note))).length;
  selectAllVisible.checked = checkedCount === visibleNotes.length;
  selectAllVisible.indeterminate = checkedCount > 0 && checkedCount < visibleNotes.length;
}

function updateExportButtonState() {
  exportBtn.disabled = selectedNoteKeys.size === 0;
  deleteSelectedBtn.disabled = selectedNoteKeys.size === 0;
}

function setLoginButtonLoading(loading) {
  loginInProgress = loading;
  loginBtn.disabled = loading;
  loginBtn.classList.toggle("is-loading", loading);
  loginBtn.textContent = loading ? "Please wait" : "Login with Google";
}

function isSignedIn() {
  return Boolean(currentSession?.user?.id);
}

function updateUpgradeViewContent() {
  const proMode = isCurrentPlanPro();

  upgradeEyebrow.textContent = proMode ? "Active Plan" : "Premium Access";
  upgradeTitle.textContent = proMode ? "Pro subscription" : "Upgrade to Pro";
  upgradeSubtitle.textContent = proMode
    ? "Your Pro plan is active on this signed-in account."
    : "Turn your browsing into a powerful knowledge system";
  featuresHeading.textContent = proMode ? "Features unlocked" : "What Pro unlocks";
  featuresSubtitle.textContent = proMode
    ? "Everything below is already available for your account."
    : "Built for people who save often, organize deeply, and export their work cleanly.";
  upgradePricing.style.display = proMode ? "none" : "flex";
  buyProBtn.style.display = proMode ? "none" : "block";
  upgradeTrust.style.display = proMode ? "none" : "flex";
  upgradeReminder.style.display = proMode ? "none" : "block";
  licenseHeading.textContent = proMode ? "Manage your Pro subscription" : "Unlock with your license";
  licenseSubtitle.textContent = proMode
    ? "Re-check your active license or manage billing for this signed-in account."
    : "Enter your license key to activate Pro on this browser.";
  upgradeManageNote.textContent = proMode
    ? "Your Pro access stays linked to this signed-in SnapText account. Manage billing anytime on Gumroad."
    : "Billing and cancellation are managed securely on Gumroad.";
}

function updateUpgradeAccessUI() {
  const canOpenUpgrade = isSignedIn();
  const showUpgradeButton = currentPlan.tier !== "pro";
  const proMode = isCurrentPlanPro();

  upgradeProBtn.style.display = showUpgradeButton ? "inline-flex" : "none";
  upgradeProBtn.textContent = "Upgrade to Pro";
  upgradeProBtn.classList.toggle("upgrade-btn--signin-required", !canOpenUpgrade);
  upgradeProBtn.setAttribute("aria-disabled", String(!canOpenUpgrade));
  upgradeProBtn.removeAttribute("title");
  planBadge.classList.toggle("plan-badge--interactive", proMode);
  planBadge.tabIndex = proMode ? 0 : -1;
  planBadge.setAttribute("role", proMode ? "button" : "status");

  buyProBtn.disabled = !canOpenUpgrade;
  buyProBtn.removeAttribute("title");
  updateUpgradeViewContent();
  syncLicenseActionState();

  if (!canOpenUpgrade && activeView === "upgrade") {
    setActiveView("main");
  }
}

function updateRecycleButtons() {
  const hasSelection = selectedBinKeys.size > 0;
  restoreSelectedBtn.disabled = !hasSelection;
  deleteSelectedBinBtn.disabled = !hasSelection;
  restoreAllBtn.disabled = recycleBinNotes.length === 0;
  emptyBinBtn.disabled = recycleBinNotes.length === 0;
}

function updateRecycleCount() {
  if (recycleCountBadge) {
    recycleCountBadge.textContent = String(recycleBinNotes.length);
  }
}

function animateViewTransition(element, direction) {
  if (typeof element.animate !== "function") {
    return;
  }

  element.animate(
    [
      {
        opacity: 0,
        transform: `translateX(${direction === "forward" ? "20px" : "-20px"})`
      },
      {
        opacity: 1,
        transform: "translateX(0)"
      }
    ],
    {
      duration: VIEW_TRANSITION_MS,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "both"
    }
  );
}

function setActiveView(view) {
  const nextView = ["main", "recycle", "upgrade", "support"].includes(view) ? view : "main";
  const viewElements = {
    main: mainView,
    recycle: recycleView,
    upgrade: upgradeView,
    support: supportView
  };
  const nextElement = viewElements[nextView];
  const currentElement = viewElements[activeView] || mainView;
  const isStandaloneView = nextView === "recycle" || nextView === "upgrade" || nextView === "support";

  if (activeView !== nextView) {
    currentElement.style.display = "none";
  }

  mainView.style.display = nextView === "main" ? "block" : "none";
  recycleView.style.display = nextView === "recycle" ? "flex" : "none";
  upgradeView.style.display = nextView === "upgrade" ? "flex" : "none";
  supportView.style.display = nextView === "support" ? "flex" : "none";
  popupHeader.style.display = isStandaloneView ? "none" : "block";
  mainFooterTip.style.display = isStandaloneView ? "none" : "block";

  animateViewTransition(
    nextElement,
    nextView === "main" && activeView !== "main" ? "back" : "forward"
  );

  activeView = nextView;
}

function updateLimitUI() {
  const limit = currentPlan.maxNotes;
  const used = Math.min(allNotes.length, limit);
  const prefix = translate("savedNotesPrefix", "Saved notes:");
  noteLimitText.textContent = `${prefix} ${used} / ${limit}`;
  noteLimitBar.style.width = `${(used / limit) * 100}%`;
  noteLimitBar.style.background = used >= limit ? "#dc2626" : "";
}

function renderNotes(notes) {
  noteList.innerHTML = "";
  visibleNotes = notes;

  if (!notes.length) {
    noteList.innerHTML = '<p class="empty" data-i18n="empty">No notes yet. Highlight text on any page to save one.</p>';
    updateSelectAllState();
    return;
  }

  notes.forEach((note) => {
    const card = document.createElement("article");
    card.className = "note-card";

    const row = document.createElement("div");
    row.className = "note-card-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedNoteKeys.has(noteKey(note));
    checkbox.addEventListener("change", () => {
      const key = noteKey(note);
      if (checkbox.checked) {
        selectedNoteKeys.add(key);
      } else {
        selectedNoteKeys.delete(key);
      }
      updateSelectAllState();
      updateExportButtonState();
    });

    const text = document.createElement("p");
    text.className = "note-text";
    text.textContent = note.text;

    row.append(checkbox, text);

    const meta = document.createElement("p");
    meta.className = "note-meta";
    const domain = note.domain || getDomain(note.url);
    meta.textContent = `${formatTime(note.created_at)} • ${domain} • ${note.source}`;

    const chips = document.createElement("div");
    chips.className = "tag-chips";
    (note.tags || []).forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.textContent = tag;
      chips.appendChild(chip);
    });

    const link = document.createElement("a");
    link.href = note.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open source";
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      await sendMessage("OPEN_NOTE_SOURCE", { note });
    });

    const actions = document.createElement("div");
    actions.className = "note-actions";

    const copyBtn = document.createElement("button");
    copyBtn.textContent = "Copy";
    copyBtn.className = "secondary note-action-btn";
    copyBtn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(note.text);
      copyBtn.textContent = "Copied!";
      setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 1000);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "danger note-action-btn";
    deleteBtn.addEventListener("click", async () => {
      await sendMessage("MOVE_NOTE_TO_BIN", { note });
      selectedNoteKeys.delete(noteKey(note));
      await Promise.all([refreshNotes(), refreshRecycleBin()]);
    });

    actions.append(copyBtn, deleteBtn);
    card.append(row, meta, chips, link, actions);
    noteList.appendChild(card);
  });

  updateSelectAllState();
  updateExportButtonState();
}

function applySearch() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedFilters = tagFilterActive
    ? Array.from(tagFilterSelect.selectedOptions).map((option) => option.value)
    : [];
  if (!query) {
    const filteredByTagOnly = selectedFilters.length
      ? allNotes.filter((note) => selectedFilters.some((tag) => (note.tags || []).includes(tag)))
      : allNotes;
    renderNotes(filteredByTagOnly);
    return;
  }

  const filtered = allNotes.filter((note) => {
    const haystack = `${note.text} ${note.url} ${note.domain}`.toLowerCase();
    const searchMatch = haystack.includes(query);
    const tagMatch = selectedFilters.length
      ? selectedFilters.some((tag) => (note.tags || []).includes(tag))
      : true;
    return searchMatch && tagMatch;
  });

  renderNotes(filtered);
}

async function refreshNotes() {
  const response = await sendMessage("GET_NOTES");
  allNotes = (response.notes || []).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const tagsFromNotes = [
    ...new Set(
      allNotes.flatMap((note) => (Array.isArray(note.tags) ? note.tags : [])).filter(Boolean)
    )
  ];
  const mergedTags = [...new Set([...customTags, ...tagsFromNotes])].sort((a, b) =>
    a.localeCompare(b)
  );
  if (mergedTags.length !== customTags.length || mergedTags.some((tag, idx) => tag !== customTags[idx])) {
    customTags = mergedTags;
    await setStorage({ [TAGS_KEY]: customTags });
    renderTagSelect();
  }

  updateLimitUI();
  applySearch();
}

async function refreshRecycleBin() {
  const response = await sendMessage("GET_RECYCLE_BIN");
  recycleBinNotes = response.notes || [];
  updateRecycleCount();
  renderRecycleBin();
}

function renderRecycleBin() {
  recycleList.innerHTML = "";
  selectedBinKeys.clear();

  if (!recycleBinNotes.length) {
    recycleList.innerHTML = '<p class="empty">No deleted notes. You\'re all clean ✨</p>';
    updateRecycleButtons();
    return;
  }

  recycleBinNotes.forEach((item) => {
    const note = item.note || {};
    const card = document.createElement("article");
    card.className = "note-card";

    const row = document.createElement("div");
    row.className = "note-card-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.addEventListener("change", () => {
      const key = binKey(item);
      if (checkbox.checked) selectedBinKeys.add(key);
      else selectedBinKeys.delete(key);
      updateRecycleButtons();
    });

    const text = document.createElement("p");
    text.className = "note-text";
    text.textContent = note.text || "";
    row.append(checkbox, text);

    const meta = document.createElement("p");
    meta.className = "note-meta";
    meta.textContent = `${note.domain || getDomain(note.url || "")} • deleted ${formatTime(item.deleted_at)}`;

    const actions = document.createElement("div");
    actions.className = "note-actions";

    const restoreBtn = document.createElement("button");
    restoreBtn.className = "secondary note-action-btn";
    restoreBtn.textContent = "Restore";
    restoreBtn.addEventListener("click", async () => {
      await sendMessage("RESTORE_BIN_NOTES", { binIds: [item.bin_id] });
      await Promise.all([refreshNotes(), refreshRecycleBin()]);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "danger note-action-btn";
    deleteBtn.textContent = "Delete permanently";
    deleteBtn.addEventListener("click", async () => {
      await sendMessage("DELETE_BIN_NOTES", { binIds: [item.bin_id] });
      await refreshRecycleBin();
    });

    actions.append(restoreBtn, deleteBtn);
    card.append(row, meta, actions);
    recycleList.appendChild(card);
  });

  updateRecycleButtons();
}

function updateAuthStatus() {
  const loggedIn = isSignedIn();

  if (loggedIn) {
    const loggedInAs = translate("loggedInAs", "Logged in as");
    authStatus.textContent = currentSession?.user?.email
      ? `Logged in as '${currentSession.user.email}'`
      : "Logged in";
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    logoutBtn.classList.add("compact-btn");
  } else {
    authStatus.textContent = translate("notLoggedIn", "Not logged in");
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    logoutBtn.classList.remove("compact-btn");
  }

  updateUpgradeAccessUI();
}

function isCurrentPlanPro() {
  return currentPlan.tier === "pro";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function notesForExport() {
  return allNotes.filter((note) => selectedNoteKeys.has(noteKey(note)));
}

function escapePdfString(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function formatTagsForExport(note) {
  const tags = Array.isArray(note?.tags) ? note.tags.filter(Boolean) : [];
  return tags.length ? tags.join(", ") : "-";
}

function shouldIncludeTagColumn(notes) {
  return notes.some((note) => Array.isArray(note?.tags) && note.tags.some(Boolean));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCsv(notes) {
  const includeTags = shouldIncludeTagColumn(notes);
  const rows = [
    includeTags
      ? ["Content", "Timestamp", "Source", "Source Link", "Domain", "Tags"]
      : ["Content", "Timestamp", "Source", "Source Link", "Domain"],
    ...notes.map((note) => [
      note.text,
      formatTime(note.created_at),
      note.source,
      note.url,
      note.domain || getDomain(note.url),
      ...(includeTags ? [formatTagsForExport(note)] : [])
    ])
  ];

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "snaptext-notes.csv");
}

function exportExcel(notes) {
  const includeTags = shouldIncludeTagColumn(notes);
  const tableRows = notes
    .map(
      (note) => `
        <tr>
          <td>${escapeHtml(note.text)}</td>
          <td>${escapeHtml(formatTime(note.created_at))}</td>
          <td>${escapeHtml(note.source)}</td>
          <td>${escapeHtml(note.url)}</td>
          <td>${escapeHtml(note.domain || getDomain(note.url))}</td>
          ${includeTags ? `<td>${escapeHtml(formatTagsForExport(note))}</td>` : ""}
        </tr>`
    )
    .join("");

  const html = `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body {
            font-family: Segoe UI, Arial, sans-serif;
            margin: 20px;
            color: #0f172a;
          }
          .sheet-header {
            margin-bottom: 16px;
          }
          .sheet-title {
            margin: 0;
            font-size: 22px;
            color: #0f172a;
          }
          .sheet-subtitle {
            margin-top: 4px;
            font-size: 12px;
            color: #64748b;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          th, td {
            border: 1px solid #dbe3ef;
            padding: 10px;
            vertical-align: top;
            font-size: 12px;
            line-height: 1.4;
            word-break: break-word;
          }
          th {
            background: #dbeafe;
            color: #1e3a8a;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }
          tr:nth-child(even) td {
            background: #f8fafc;
          }
          .col-content { width: 42%; }
          .col-time { width: 18%; }
          .col-source { width: 10%; }
          .col-link { width: 20%; }
          .col-domain { width: ${includeTags ? "10%" : "10%" }; }
          .col-tags { width: 14%; }
        </style>
      </head>
      <body>
        <div class="sheet-header">
          <h1 class="sheet-title">Notes</h1>
          <div class="sheet-subtitle">Generated on ${escapeHtml(new Date().toLocaleString())}</div>
        </div>
        <table>
          <tr>
            <th class="col-content">Content</th>
            <th class="col-time">Timestamp</th>
            <th class="col-source">Source</th>
            <th class="col-link">Source Link</th>
            <th class="col-domain">Domain</th>
            ${includeTags ? '<th class="col-tags">Tags</th>' : ""}
          </tr>
          ${tableRows}
        </table>
      </body>
    </html>`;

  downloadBlob(new Blob([html], { type: "application/vnd.ms-excel" }), "snaptext-notes.xls");
}

function measurePdfTextWidth(text, fontSize) {
  return String(text).length * fontSize * 0.52;
}

function wrapPdfText(text, maxWidth, fontSize) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return [""];

  const words = normalized.split(" ");
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (measurePdfTextWidth(next, fontSize) <= maxWidth) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
      current = "";
    }

    if (measurePdfTextWidth(word, fontSize) <= maxWidth) {
      current = word;
      continue;
    }

    let slice = "";
    for (const char of word) {
      const candidate = `${slice}${char}`;
      if (measurePdfTextWidth(candidate, fontSize) > maxWidth && slice) {
        lines.push(slice);
        slice = char;
      } else {
        slice = candidate;
      }
    }
    current = slice;
  }

  if (current) {
    lines.push(current);
  }

  return lines.length ? lines : [""];
}

function createPdfDocument() {
  const objects = [];

  function addObject(content) {
    objects.push(content);
    return objects.length;
  }

  function build() {
    let pdf = "%PDF-1.4\n";
    const offsets = [0];

    objects.forEach((content, index) => {
      offsets[index + 1] = pdf.length;
      pdf += `${index + 1} 0 obj\n${content}\nendobj\n`;
    });

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";

    for (let i = 1; i <= objects.length; i += 1) {
      pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }

    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return new Blob([pdf], { type: "application/pdf" });
  }

  return { addObject, build };
}

function exportMarkdown(notes) {
  const markdown = notes
    .map((note) => `- ${note.text}\nSource: ${note.url}`)
    .join("\n\n");

  downloadBlob(
    new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
    "snaptext-notes.md"
  );
}

async function preloadPdfLogo() {
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = chrome.runtime.getURL("snaptext-header-logo.png");
    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Logo failed to load."));
    });

    function canvasToPdfJpegAsset(canvas) {
      const dataUrl = canvas.toDataURL("image/jpeg", 0.94);
      const base64 = dataUrl.split(",")[1] || "";
      const binary = atob(base64);
      let hex = "";
      for (let i = 0; i < binary.length; i += 1) {
        hex += binary.charCodeAt(i).toString(16).padStart(2, "0").toUpperCase();
      }
      return {
        width: canvas.width,
        height: canvas.height,
        hexStream: `${hex}>`
      };
    }

    const headerCanvas = document.createElement("canvas");
    headerCanvas.width = 280;
    headerCanvas.height = 56;
    const headerCtx = headerCanvas.getContext("2d");
    if (!headerCtx) {
      pdfBrandAssets = null;
      return;
    }
    headerCtx.fillStyle = "#f0f7ff";
    headerCtx.fillRect(0, 0, headerCanvas.width, headerCanvas.height);
    headerCtx.drawImage(img, 0, 8, 40, 40);
    headerCtx.fillStyle = "#3b82f6";
    headerCtx.font = "bold 28px Segoe UI, Arial, sans-serif";
    headerCtx.textBaseline = "middle";
    headerCtx.fillText("SnapText", 54, 28);

    const footerCanvas = document.createElement("canvas");
    footerCanvas.width = 190;
    footerCanvas.height = 24;
    const footerCtx = footerCanvas.getContext("2d");
    if (!footerCtx) {
      pdfBrandAssets = null;
      return;
    }
    footerCtx.fillStyle = "#ffffff";
    footerCtx.fillRect(0, 0, footerCanvas.width, footerCanvas.height);
    footerCtx.fillStyle = "#3b82f6";
    footerCtx.font = "14px Segoe UI, Arial, sans-serif";
    footerCtx.textBaseline = "middle";
    const footerLabel = "Made with SnapText";
    footerCtx.fillText(footerLabel, 0, 12);
    footerCtx.font = "15px Segoe UI Symbol, Segoe UI Emoji, Arial, sans-serif";
    const footerTextWidth = footerCtx.measureText(footerLabel).width;
    footerCtx.fillText("\u2665", footerTextWidth + 2, 12);

    pdfBrandAssets = {
      header: canvasToPdfJpegAsset(headerCanvas),
      footer: canvasToPdfJpegAsset(footerCanvas)
    };
  } catch {
    pdfBrandAssets = null;
  }
}

function exportPdf(notes) {
  const includeTags = shouldIncludeTagColumn(notes);
  const brandedFreePdf = !isCurrentPlanPro();
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 40;
  const bottomMargin = 44;
  const contentWidth = pageWidth - margin * 2;
  const rowFontSize = 9;
  const headerFontSize = 10;
  const rowLineHeight = 12;
  const cellPadding = 5;
  const generatedAt = new Date().toLocaleString();
  const columns = includeTags
    ? [
        { key: "text", title: "Content", width: 0.38 },
        { key: "createdAt", title: "Timestamp", width: 0.16 },
        { key: "source", title: "Source", width: 0.11 },
        { key: "url", title: "Source Link", width: 0.21 },
        { key: "tags", title: "Tags", width: 0.14 }
      ]
    : [
        { key: "text", title: "Content", width: 0.44 },
        { key: "createdAt", title: "Timestamp", width: 0.18 },
        { key: "source", title: "Source", width: 0.12 },
        { key: "url", title: "Source Link", width: 0.26 }
      ];

  const rows = notes.map((note) => ({
    text: note.text,
    createdAt: formatTime(note.created_at),
    source: note.source,
    url: note.url,
    tags: formatTagsForExport(note)
  }));

  function drawRect(x, y, width, height, fillColor) {
    return `${fillColor} rg\n${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f\n`;
  }

  function drawText(text, x, y, size, font = "/F1", color = "0 0 0") {
    return `BT\n${color} rg\n${font} ${size} Tf\n1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm\n(${escapePdfString(text)}) Tj\nET\n`;
  }

  function drawCenteredText(text, centerX, y, size, font = "/F1", color = "0 0 0") {
    const width = measurePdfTextWidth(text, size);
    return drawText(text, centerX - width / 2, y, size, font, color);
  }

  const pages = [];
  let currentPageRows = [];
  let usedHeight = 0;
  const usableHeight = pageHeight - margin - bottomMargin - 86 - 24;

  rows.forEach((row, index) => {
    const estimatedHeight = Math.max(
      24,
      ...columns.map((column) => {
        const width = contentWidth * column.width - cellPadding * 2;
        const lines = wrapPdfText(row[column.key], width, rowFontSize);
        return lines.length * rowLineHeight + cellPadding * 2;
      })
    );

    if (currentPageRows.length && usedHeight + estimatedHeight > usableHeight) {
      pages.push(currentPageRows);
      currentPageRows = [];
      usedHeight = 0;
    }

    currentPageRows.push(row);
    usedHeight += estimatedHeight;

    if (index === rows.length - 1 && currentPageRows.length) {
      pages.push(currentPageRows);
    }
  });

  if (!pages.length) {
    pages.push([]);
  }

  const pdf = createPdfDocument();
  const imageCount = brandedFreePdf && pdfBrandAssets ? 2 : 0;
  const firstStreamRef = 5 + imageCount;
  const firstPageRef = firstStreamRef + pages.length;

  pdf.addObject("<< /Type /Catalog /Pages 2 0 R >>");
  pdf.addObject(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, idx) => `${firstPageRef + idx} 0 R`).join(" ")}] >>`);
  pdf.addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  pdf.addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  let headerImageRef = null;
  let footerImageRef = null;
  if (brandedFreePdf && pdfBrandAssets) {
    headerImageRef = pdf.addObject(
      `<< /Type /XObject /Subtype /Image /Width ${pdfBrandAssets.header.width} /Height ${pdfBrandAssets.header.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${pdfBrandAssets.header.hexStream.length} >>\nstream\n${pdfBrandAssets.header.hexStream}\nendstream`
    );
    footerImageRef = pdf.addObject(
      `<< /Type /XObject /Subtype /Image /Width ${pdfBrandAssets.footer.width} /Height ${pdfBrandAssets.footer.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${pdfBrandAssets.footer.hexStream.length} >>\nstream\n${pdfBrandAssets.footer.hexStream}\nendstream`
    );
  }

  const streamRefs = pages.map((pageRows, index) => {
    let stream = "";
    let y = pageHeight - margin;

    stream += drawRect(margin, y - 64, contentWidth, 64, brandedFreePdf ? "0.94 0.97 1" : "0.97 0.98 0.99");
    stream += drawText("Notes", margin + 16, y - 26, 20, "/F2", "0.06 0.09 0.16");
    stream += drawText(`Generated on ${generatedAt}`, margin + 16, y - 42, 9, "/F1", "0.39 0.45 0.56");

    if (brandedFreePdf && headerImageRef && pdfBrandAssets) {
      const drawWidth = 150;
      const drawHeight = (pdfBrandAssets.header.height / pdfBrandAssets.header.width) * drawWidth;
      const imageX = margin + contentWidth - drawWidth - 12;
      const imageY = y - 50;
      stream += `q\n${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${imageX.toFixed(2)} ${imageY.toFixed(2)} cm\n/ImHeader Do\nQ\n`;
    }

    y -= 86;

    let x = margin;
    columns.forEach((column) => {
      const width = contentWidth * column.width;
      stream += drawRect(x, y - 24, width, 24, "0.86 0.92 0.99");
      stream += drawText(column.title, x + cellPadding, y - 16, headerFontSize, "/F2", "0.12 0.23 0.54");
      x += width;
    });
    y -= 24;

    pageRows.forEach((row, rowIndex) => {
      const prepared = columns.map((column) => {
        const width = contentWidth * column.width - cellPadding * 2;
        const lines = wrapPdfText(row[column.key], width, rowFontSize);
        return { width: contentWidth * column.width, lines };
      });
      const rowHeight = Math.max(
        24,
        ...prepared.map((cell) => cell.lines.length * rowLineHeight + cellPadding * 2)
      );
      const bgColor = rowIndex % 2 === 0 ? "1 1 1" : "0.97 0.98 0.99";

      x = margin;
      prepared.forEach((cell) => {
        stream += drawRect(x, y - rowHeight, cell.width, rowHeight, bgColor);
        cell.lines.forEach((line, lineIndex) => {
          stream += drawText(line, x + cellPadding, y - 14 - lineIndex * rowLineHeight, rowFontSize, "/F1", "0.1 0.14 0.2");
        });
        x += cell.width;
      });
      y -= rowHeight;
    });

    if (brandedFreePdf && footerImageRef && pdfBrandAssets) {
      const drawWidth = 120;
      const drawHeight = (pdfBrandAssets.footer.height / pdfBrandAssets.footer.width) * drawWidth;
      const imageX = pageWidth / 2 - drawWidth / 2;
      const imageY = 14;
      stream += `q\n${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${imageX.toFixed(2)} ${imageY.toFixed(2)} cm\n/ImFooter Do\nQ\n`;
    } else {
      stream += drawCenteredText(`Page ${index + 1} of ${pages.length}`, pageWidth / 2, 22, 9, "/F1", "0.39 0.45 0.56");
    }

    return pdf.addObject(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
  });

  streamRefs.forEach((streamRef) => {
    const xObjects = [];
    if (headerImageRef) xObjects.push(`/ImHeader ${headerImageRef} 0 R`);
    if (footerImageRef) xObjects.push(`/ImFooter ${footerImageRef} 0 R`);
    const xObjectSection = xObjects.length ? ` /XObject << ${xObjects.join(" ")} >>` : "";
    pdf.addObject(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xObjectSection} >> /Contents ${streamRef} 0 R >>`
    );
  });

  downloadBlob(pdf.build(), "notes.pdf");
}

async function init() {
  await initLanguage();
  await initTheme();
  await preloadPdfLogo();
  await loadCustomTags();
  await loadLicenseState();
  prepareSupportView();
  applyUpgradeSelection("yearly");
  setActiveView("main");

  const [authResponse] = await Promise.all([
    sendMessage("GET_AUTH"),
    sendMessage("SYNC_NOW").catch(() => null)
  ]);
  currentSession = authResponse.session || null;
  await loadLicenseState(authResponse.licenseState);
  applyPlan(authResponse.plan);
  prepareSupportView();
  updateAuthStatus();

  await refreshNotes();
  await refreshRecycleBin();
}

loginBtn.addEventListener("click", async () => {
  if (loginInProgress) return;
  setLoginButtonLoading(true);
  try {
    await new Promise((resolve) => setTimeout(resolve, 40));
    const response = await sendMessage("LOGIN_GOOGLE");
    currentSession = response.session;
    await loadLicenseState(response.licenseState);
    applyPlan(response.plan);
    prepareSupportView();
    updateAuthStatus();
    await Promise.all([refreshNotes(), refreshRecycleBin()]);
  } catch (error) {
    const msg = error.message || "Unknown login error";
    authStatus.textContent = msg.startsWith("Login failed:")
      ? msg
      : `Login failed: ${msg}`;
  } finally {
    setLoginButtonLoading(false);
  }
});

logoutBtn.addEventListener("click", async () => {
  await sendMessage("LOGOUT");
  currentSession = null;
  const planResponse = await sendMessage("GET_PLAN");
  await loadLicenseState(null);
  applyPlan(planResponse.plan);
  prepareSupportView();
  updateAuthStatus();
  await Promise.all([refreshNotes(), refreshRecycleBin()]);
});

searchInput.addEventListener("input", applySearch);

themeToggle.addEventListener("click", async () => {
  const nextTheme = document.body.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  await setStorage({ [THEME_KEY]: nextTheme });
});

upgradeThemeToggle.addEventListener("click", async () => {
  const nextTheme = document.body.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  await setStorage({ [THEME_KEY]: nextTheme });
});

selectAllVisible.addEventListener("change", () => {
  visibleNotes.forEach((note) => {
    const key = noteKey(note);
    if (selectAllVisible.checked) {
      selectedNoteKeys.add(key);
    } else {
      selectedNoteKeys.delete(key);
    }
  });
  applySearch();
  updateExportButtonState();
});

addTagBtn.addEventListener("click", async () => {
  const value = newTagInput.value.trim();
  if (!value) return;
  if (!customTags.includes(value)) {
    customTags.push(value);
    customTags.sort((a, b) => a.localeCompare(b));
    await setStorage({ [TAGS_KEY]: customTags });
    renderTagSelect();
  }
  newTagInput.value = "";
});

removeTagBtn.addEventListener("click", async () => {
  const tagsToRemove = Array.from(tagFilterSelect.selectedOptions).map((option) => option.value);
  if (!tagsToRemove.length) {
    authStatus.textContent = "Select one or more tags first.";
    return;
  }
  customTags = customTags.filter((tag) => !tagsToRemove.includes(tag));
  await setStorage({ [TAGS_KEY]: customTags });
  renderTagSelect();

  for (const tag of tagsToRemove) {
    await sendMessage("REMOVE_TAG_FROM_NOTES", { tag });
  }

  await refreshNotes();
});

filterTagsBtn.addEventListener("click", () => {
  if (!isCurrentPlanPro()) {
    authStatus.textContent = "Upgrade to Pro to unlock tag filtering.";
    updateFilterUI();
    return;
  }

  tagFilterActive = !tagFilterActive;
  updateFilterUI();
  applySearch();
});

exportBtn.addEventListener("click", async () => {
  const notes = notesForExport();
  if (!notes.length || exportBtn.disabled) {
    authStatus.textContent = "Select at least one note to export.";
    return;
  }

  if (!currentPlan.allowedExportFormats.includes(exportFormat.value)) {
    authStatus.textContent = "Upgrade to Pro to unlock CSV, Excel, and Markdown export.";
    return;
  }

  try {
    if (exportFormat.value === "csv") {
      exportCsv(notes);
    } else if (exportFormat.value === "excel") {
      exportExcel(notes);
    } else if (exportFormat.value === "markdown") {
      exportMarkdown(notes);
    } else {
      exportPdf(notes);
    }
  } catch (error) {
    authStatus.textContent = `Export failed: ${error.message}`;
  }
});

upgradeProBtn.addEventListener("click", () => {
  if (!isSignedIn()) {
    authStatus.textContent = "Sign in first to upgrade to Pro.";
    return;
  }
  applyUpgradeSelection(selectedUpgradePlan);
  setActiveView("upgrade");
});

planBadge.addEventListener("click", () => {
  if (!isCurrentPlanPro()) return;
  applyUpgradeSelection(selectedUpgradePlan);
  setActiveView("upgrade");
});

planBadge.addEventListener("keydown", (event) => {
  if (!isCurrentPlanPro()) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    applyUpgradeSelection(selectedUpgradePlan);
    setActiveView("upgrade");
  }
});

upgradeBackBtn.addEventListener("click", () => {
  setActiveView("main");
});

pricingCards.forEach((card) => {
  card.addEventListener("click", () => {
    applyUpgradeSelection(card.dataset.plan);
  });
});

buyProBtn.addEventListener("click", () => {
  if (!isSignedIn()) {
    authStatus.textContent = "Sign in first to upgrade to Pro.";
    return;
  }
  const targetUrl = UPGRADE_PLAN_CONFIG[selectedUpgradePlan]?.url;
  if (!targetUrl) return;
  chrome.tabs.create({ url: targetUrl });
});

manageSubscriptionBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: GUMROAD_MANAGE_URL });
});

verifyLicenseBtn.addEventListener("click", async () => {
  const licenseKey = licenseKeyInput.value.trim();

  if (!licenseKey || !matchesPlaceholderLicenseFormat(licenseKey)) {
    updateLicenseStatus("Please enter a valid license key.", "error");
    return;
  }

  verifyLicenseBtn.disabled = true;
  const originalVerifyLabel = verifyLicenseBtn.textContent;
  verifyLicenseBtn.textContent = "Verifying...";

  try {
    const response = await sendMessage("VERIFY_LICENSE", { licenseKey });
    if (response.success === true) {
      await persistLicenseState(response.licenseState);
      applyPlan(response.plan);
      updateLimitUI();
      updateLicenseStatus("Pro activated successfully!", "success");
      return;
    }

    await clearLicenseState();
    applyPlan(response.plan);
    updateLimitUI();
    updateLicenseStatus("Please enter a valid license key.", "error");
  } catch (error) {
    updateLicenseStatus(error?.message || "Something went wrong. Please try again.", "error");
  } finally {
    verifyLicenseBtn.textContent = originalVerifyLabel;
    syncLicenseActionState();
  }
});

licenseKeyInput.addEventListener("input", () => {
  if (licenseStatus.textContent) {
    updateLicenseStatus("", "");
  }
});

licenseKeyInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    verifyLicenseBtn.click();
  }
});

recheckLicenseBtn.addEventListener("click", async () => {
  if (!licenseState?.licenseKey) return;

  recheckLicenseBtn.disabled = true;
  const originalLabel = recheckLicenseBtn.textContent;
  recheckLicenseBtn.textContent = "Checking...";

  try {
    const response = await sendMessage("RECHECK_LICENSE");
    if (response.success === true) {
      await persistLicenseState(response.licenseState);
      applyPlan(response.plan);
      updateLimitUI();
      updateLicenseStatus("License still valid \u2705", "success");
      return;
    }

    await clearLicenseState();
    applyPlan(response.plan);
    updateLimitUI();
    updateLicenseStatus("License is no longer valid. Switched back to Free.", "error");
  } catch (error) {
    updateLicenseStatus(error?.message || "Something went wrong. Please try again.", "error");
  } finally {
    recheckLicenseBtn.textContent = originalLabel;
    syncLicenseActionState();
  }
});

deleteSelectedBtn.addEventListener("click", async () => {
  const notes = allNotes.filter((note) => selectedNoteKeys.has(noteKey(note)));
  if (!notes.length) {
    authStatus.textContent = "Select at least one note to delete.";
    return;
  }

  await Promise.all(notes.map((note) =>
    sendMessage("MOVE_NOTE_TO_BIN", { note })
  ));

  for (const note of notes) {
    selectedNoteKeys.delete(noteKey(note));
  }

  await Promise.all([refreshNotes(), refreshRecycleBin()]);
});

recycleToggleBtn.addEventListener("click", async () => {
  setActiveView("recycle");
  await refreshRecycleBin();
});

recycleBackBtn.addEventListener("click", () => {
  setActiveView("main");
});

supportFloatBtn.addEventListener("click", () => {
  prepareSupportView();
  setActiveView("support");
});

supportBackBtn.addEventListener("click", () => {
  setActiveView("main");
});

supportCancelBtn.addEventListener("click", () => {
  resetSupportForm({ preserveMessage: false });
  setActiveView("main");
});

supportFormPanel.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = supportMessage.value.trim();
  const email = supportEmail.value.trim();

  if (!message) {
    updateSupportStatus("Please enter a message before sending.", "error");
    supportMessage.focus();
    return;
  }

  if (!isValidEmail(email)) {
    updateSupportStatus("Please enter a valid email address.", "error");
    supportEmail.focus();
    return;
  }

  supportSendBtn.disabled = true;
  supportSendBtn.textContent = "Sending...";
  updateSupportStatus("", "");

  try {
    await submitSupportMessage();
    supportFormPanel.style.display = "none";
    supportSuccessPanel.style.display = "flex";
    supportMessage.value = "";
    updateSupportStatus("", "");
  } catch (error) {
    updateSupportStatus(error?.message || "Could not send your message. Please try again.", "error");
    supportSendBtn.disabled = false;
    supportSendBtn.textContent = "Send Message";
  }
});

restoreSelectedBtn.addEventListener("click", async () => {
  const binIds = Array.from(selectedBinKeys);
  if (!binIds.length) return;
  await sendMessage("RESTORE_BIN_NOTES", { binIds });
  await Promise.all([refreshNotes(), refreshRecycleBin()]);
});

deleteSelectedBinBtn.addEventListener("click", async () => {
  const binIds = Array.from(selectedBinKeys);
  if (!binIds.length) return;
  await sendMessage("DELETE_BIN_NOTES", { binIds });
  await refreshRecycleBin();
});

restoreAllBtn.addEventListener("click", async () => {
  const binIds = recycleBinNotes.map((item) => item.bin_id);
  if (!binIds.length) return;
  await sendMessage("RESTORE_BIN_NOTES", { binIds });
  await Promise.all([refreshNotes(), refreshRecycleBin()]);
});

emptyBinBtn.addEventListener("click", async () => {
  await sendMessage("EMPTY_BIN");
  await refreshRecycleBin();
});

init().catch((error) => {
  noteList.innerHTML = `<p class="empty">Error: ${error.message}</p>`;
});


// --- i18n logic ---
function getBestLanguage(browserLang) {
  const supported = ["en", "es", "zh-CN", "zh-TW", "ru", "fr", "de", "pt-BR", "ja", "it", "ko"];
  if (supported.includes(browserLang)) return browserLang;
  const base = browserLang.split("-")[0];
  if (supported.includes(base)) return base;
  if (base === "zh") return "zh-CN";
  if (base === "pt") return "pt-BR";
  return "en";
}

function translate(key, defaultText) {
  if (typeof currentLanguage === "undefined" || typeof locales === "undefined") return defaultText;
  const l = locales[currentLanguage] || locales["en"];
  return l[key] || defaultText;
}

async function initLanguage() {
  const data = await new Promise(res => chrome.storage.local.get("languageCode", res));
  if (data.languageCode) {
    currentLanguage = data.languageCode;
  } else {
    currentLanguage = getBestLanguage(navigator.language);
    await new Promise(res => chrome.storage.local.set({ languageCode: currentLanguage }, res));
  }

  if (languageSelect) {
    languageSelect.value = currentLanguage;
    languageSelect.addEventListener("change", async (e) => {
      currentLanguage = e.target.value;
      await new Promise(res => chrome.storage.local.set({ languageCode: currentLanguage }, res));
      translateUI();
    });
  }
  translateUI();
}



// Placeholder for translateUI, to be implemented next
function translateUI() {
  const t = locales[currentLanguage] || locales["en"];

  // Header
  const planBadge = document.getElementById("planBadge");
  if (planBadge && planBadge.textContent === "Free") {
    planBadge.textContent = t.freePlan;
  }
  const upgradeProBtn = document.getElementById("upgradeProBtn");
  if (upgradeProBtn) upgradeProBtn.textContent = t.upgradeToPro;

  const authStatus = document.getElementById("authStatus");
  if (authStatus && authStatus.textContent === "Not logged in") {
    authStatus.textContent = t.notLoggedIn;
  }

  // Main View
  const loginBtn = document.getElementById("loginBtn");
  if (loginBtn) loginBtn.textContent = t.loginGoogle;

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.textContent = t.logout;

  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.placeholder = t.searchNotesPlaceholder;



  const exportBtn = document.getElementById("exportBtn");

// Fix the selector for selectAll
  const selectAllLabel = document.querySelector('.select-all-check span');
  if (selectAllLabel) selectAllLabel.textContent = t.selectAll;

// Fix the selector for export label (since there is no empty option, we add one dynamically if needed or just replace the first option?)
// No, the export format is just the values. We can ignore the "exportLabel" entirely since they are formats.
// Let's remove the broken `exportLabel` line.

  const addTagBtn = document.getElementById("addTagBtn");
  if (addTagBtn) addTagBtn.textContent = "+";

  if (exportBtn) exportBtn.textContent = t.exportBtn;

  const deleteSelectedBtn = document.getElementById("deleteSelectedBtn");
  if (deleteSelectedBtn) deleteSelectedBtn.textContent = t.deleteSelected;


  const newTagInput = document.getElementById("newTagInput");
  if (newTagInput) newTagInput.placeholder = t.addTagPlaceholder;

  const filterTagsBtn = document.getElementById("filterTagsBtn");
  if (filterTagsBtn) filterTagsBtn.title = t.filterPlaceholder;

  const tagFilterSelectOption = document.querySelector('#tagFilterSelect option[value=""]');
  if (tagFilterSelectOption) tagFilterSelectOption.textContent = t.filterPlaceholder;


  const mainFooterTip = document.getElementById("mainFooterTip");
    let supportFloatBtn = document.getElementById("supportFloatBtn");
  if (supportFloatBtn) {
    const textNode = Array.from(supportFloatBtn.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== "");
    if (textNode) {
        textNode.nodeValue = " " + t.supportBtn;
    } else {
        supportFloatBtn.innerHTML = `<span class="support-float-btn__icon">❓</span> ${t.supportBtn}`;
    }
  }

  const emptyMsg = document.querySelector('.empty');
  if (emptyMsg) {
      emptyMsg.textContent = t.emptyNotes;
  }
  if (mainFooterTip) mainFooterTip.textContent = t.mainFooterTip;


  // Upgrade View
  const upgradeBackBtn = document.getElementById("upgradeBackBtn");
  if (upgradeBackBtn) upgradeBackBtn.textContent = t.backBtn;

  const upgradeEyebrow = document.getElementById("upgradeEyebrow");
  if (upgradeEyebrow) upgradeEyebrow.textContent = t.premiumAccess;

  const upgradeTitle = document.getElementById("upgradeTitle");
  if (upgradeTitle) upgradeTitle.textContent = t.upgradeTitle;

  const upgradeSubtitle = document.getElementById("upgradeSubtitle");
  if (upgradeSubtitle) upgradeSubtitle.textContent = t.upgradeSubtitle;

  const featuresHeading = document.getElementById("featuresHeading");
  if (featuresHeading) featuresHeading.textContent = t.featuresHeading;

  const featuresSubtitle = document.getElementById("featuresSubtitle");
  if (featuresSubtitle) featuresSubtitle.textContent = t.featuresSubtitle;

  const featureItems = document.querySelectorAll('.pro-feature-item span:not(.pro-feature-item__icon)');
  if (featureItems.length >= 5) {
    featureItems[0].textContent = t.feature1;
    featureItems[1].textContent = t.feature2;
    featureItems[2].textContent = t.feature3;
    featureItems[3].textContent = t.feature4;
    featureItems[4].textContent = t.feature5;
  }

  const pricingNames = document.querySelectorAll('.pricing-card__name');
  if (pricingNames.length >= 3) {
    pricingNames[0].textContent = t.monthly;
    pricingNames[1].textContent = t.quarterly;
    pricingNames[2].textContent = t.yearly;
  }

  const mostPopular = document.querySelector('.pricing-card__badge');
  if (mostPopular) mostPopular.textContent = t.mostPopular;

  const savings = document.querySelector('.pricing-card__savings');
  if (savings) savings.textContent = t.save44;

  const buyProBtn = document.getElementById("buyProBtn");
  if (buyProBtn && buyProBtn.textContent.includes("$19.99")) buyProBtn.textContent = t.buyProBtn; // It changes dynamically sometimes, but base text is this

  const upgradeTrust = document.getElementById("upgradeTrust");
  if (upgradeTrust && upgradeTrust.children.length >= 2) {
    upgradeTrust.children[0].textContent = t.cancelAnytime;
    upgradeTrust.children[1].textContent = t.lessThan2;
  }

  const upgradeReminder = document.getElementById("upgradeReminder");
  if (upgradeReminder) upgradeReminder.textContent = t.upgradeReminder;

  const licenseHeading = document.getElementById("licenseHeading");
  if (licenseHeading) licenseHeading.textContent = t.licenseHeading;

  const licenseSubtitle = document.getElementById("licenseSubtitle");
  if (licenseSubtitle) licenseSubtitle.textContent = t.licenseSubtitle;

  const licenseKeyInput = document.getElementById("licenseKeyInput");
  if (licenseKeyInput) licenseKeyInput.placeholder = t.licensePlaceholder;

  const verifyLicenseBtn = document.getElementById("verifyLicenseBtn");
  if (verifyLicenseBtn) verifyLicenseBtn.textContent = t.verifyBtn;

  const recheckLicenseBtn = document.getElementById("recheckLicenseBtn");
  if (recheckLicenseBtn) recheckLicenseBtn.textContent = t.recheckBtn;

  const manageSubscriptionBtn = document.getElementById("manageSubscriptionBtn");
  if (manageSubscriptionBtn) manageSubscriptionBtn.textContent = t.manageSubBtn;

  const upgradeManageNote = document.getElementById("upgradeManageNote");
  if (upgradeManageNote) upgradeManageNote.textContent = t.upgradeManageNote;

  const upgradeFooter = document.querySelector('.upgrade-footer');
  if (upgradeFooter) upgradeFooter.textContent = t.upgradeFooter;

  // Recycle View
  const recycleBackBtn = document.getElementById("recycleBackBtn");
  if (recycleBackBtn) recycleBackBtn.textContent = t.backBtn;

  const recycleTitle = document.querySelector('.recycle-title');
  if (recycleTitle) recycleTitle.textContent = t.recycleBinTitle;

  const restoreSelectedBtn = document.getElementById("restoreSelectedBtn");
  if (restoreSelectedBtn) restoreSelectedBtn.textContent = t.restoreSelected;

  const deleteSelectedBinBtn = document.getElementById("deleteSelectedBinBtn");
  if (deleteSelectedBinBtn) deleteSelectedBinBtn.textContent = t.deleteSelectedBin;

  const restoreAllBtn = document.getElementById("restoreAllBtn");
  if (restoreAllBtn) restoreAllBtn.textContent = t.restoreAll;

  const emptyBinBtn = document.getElementById("emptyBinBtn");
  if (emptyBinBtn) emptyBinBtn.textContent = t.emptyBin;

  const recycleTip = document.querySelector('.recycle-view .tip');
  if (recycleTip) recycleTip.textContent = t.recycleTip;

  // Support View
  const supportBackBtn = document.getElementById("supportBackBtn");
  if (supportBackBtn) supportBackBtn.textContent = t.backBtn;

  const supportTitle = document.querySelector('.support-title');
  if (supportTitle) supportTitle.textContent = t.supportTitle;

  const supportCopy = document.querySelector('.support-copy');
  if (supportCopy) supportCopy.textContent = t.supportCopy;

  const supportFields = document.querySelectorAll('.support-field > span');
  if (supportFields.length >= 3) {
    supportFields[0].textContent = t.categoryLabel;
    supportFields[1].textContent = t.messageLabel;
    supportFields[2].textContent = t.emailLabel;
  }

  const supportCategory = document.getElementById("supportCategory");
  if (supportCategory && supportCategory.options.length >= 5) {
    supportCategory.options[0].textContent = t.categoryBug;
    supportCategory.options[1].textContent = t.categoryFeature;
    supportCategory.options[2].textContent = t.categoryAccount;
    supportCategory.options[3].textContent = t.categorySub;
    supportCategory.options[4].textContent = t.categoryOther;
  }

  const supportMessage = document.getElementById("supportMessage");
  if (supportMessage) supportMessage.placeholder = t.messagePlaceholder;

  const supportEmail = document.getElementById("supportEmail");
  if (supportEmail) supportEmail.placeholder = t.emailPlaceholder;

  const supportCancelBtn = document.getElementById("supportCancelBtn");
  if (supportCancelBtn) supportCancelBtn.textContent = t.cancelBtn;

  const supportSendBtn = document.getElementById("supportSendBtn");
  if (supportSendBtn) supportSendBtn.textContent = t.sendBtn;

  const supportFootnote = document.querySelector('.support-footnote');
  if (supportFootnote) supportFootnote.textContent = t.supportFootnote;

  const successTitle = document.querySelector('.support-success h4');
  if (successTitle) successTitle.textContent = t.messageSentTitle;

  const successDesc = document.querySelector('.support-success p');
  if (successDesc) successDesc.textContent = t.messageSentDesc;

  // Send message to content script to update tooltip if it's active
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: "UPDATE_LANGUAGE",
        language: currentLanguage,
        translations: t
      }).catch(() => {}); // ignore errors if content script is not running
    }
  });
}
