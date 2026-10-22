const PLAYBOOKS = {
  consumer_app: {
    label: "Consumer app",
    topics: ["Data sharing", "Auto-renewal", "Arbitration", "Account termination"],
  },
  saas_vendor: {
    label: "SaaS vendor",
    topics: ["Data processing", "Liability cap", "Indemnification", "Termination for convenience", "Price change", "DPA / audit"],
  },
  contractor: {
    label: "Contractor",
    topics: ["IP assignment", "Non-solicit", "Payment", "Termination"],
  },
};

const SECTION_COPY = {
  overview: {
    title: "Your extension at a glance",
    description: "Choose how Themys finds and reviews terms while you browse.",
  },
  scanning: {
    title: "Scanning preferences",
    description: "Control detection behavior and the jurisdiction used in your reviews.",
  },
  clauses: {
    title: "Tell Themys what matters",
    description: "Choose a playbook and build a clause watch list in your own words.",
  },
  account: {
    title: "Account and plan",
    description: "See your extension session and open secure billing controls.",
  },
};

function getAllPresetTopics() {
  const topics = new Set();
  for (const playbook of Object.values(PLAYBOOKS)) {
    for (const topic of playbook.topics) topics.add(topic);
  }
  return topics;
}

function mergePlaybookTopics(playbookId, existingClauses) {
  const presetSet = getAllPresetTopics();
  const customClauses = existingClauses.filter((clause) => !presetSet.has(clause));
  return [...PLAYBOOKS[playbookId].topics, ...customClauses];
}

const policy = globalThis.ThemysCapturePolicy;
const appOrigin = globalThis.THEMYS_CONFIG?.appOrigin || "https://themys.ca";
const defaultAutoScan = policy ? policy.DEFAULT_AUTO_SCAN_ENABLED : false;

const state = {
  autoScanEnabled: defaultAutoScan,
  targetClauses: [],
  strictMode: false,
  playbookId: "consumer_app",
  isAuthenticated: false,
  country: "",
  stateRegion: "",
  plan: "free",
  subscriptionStatus: null,
};

let hasChanges = false;
let saveResetTimer = null;

const autoScanToggle = document.getElementById("auto-scan-toggle");
const authWarning = document.getElementById("auth-warning");
const signInBtn = document.getElementById("sign-in-btn");
const signOutBtn = document.getElementById("sign-out-btn");
const loadingSpinner = document.getElementById("loading-spinner");
const clausesContainer = document.getElementById("clauses-container");
const tagsList = document.getElementById("tags-list");
const clauseInput = document.getElementById("clause-input");
const strictModeToggle = document.getElementById("strict-mode-toggle");
const playbookSelect = document.getElementById("playbook-select");
const playbookRadios = Array.from(document.querySelectorAll('input[name="playbook"]'));
const saveBtn = document.getElementById("save-btn");
const saveBar = document.getElementById("save-bar");
const saveStatus = document.getElementById("save-status");
const countryInput = document.getElementById("country-input");
const stateInput = document.getElementById("state-input");
const commonClauseBtns = Array.from(document.querySelectorAll(".suggestion-button"));
const menuItems = Array.from(document.querySelectorAll(".menu-item"));
const panels = Array.from(document.querySelectorAll("[data-panel]"));

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response);
    });
  });
}

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(values) {
  return new Promise((resolve) => chrome.storage.local.set(values, resolve));
}

function storageRemove(keys) {
  return new Promise((resolve) => chrome.storage.local.remove(keys, resolve));
}

function titleCase(value) {
  if (!value) return "Unknown";
  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function planLabel(plan) {
  const labels = { free: "Themys Free", base: "Themys Plus", advanced: "Themys Advanced", lifetime: "Themys Lifetime" };
  return labels[plan] || `Themys ${titleCase(plan)}`;
}

function statusLabel(status) {
  const labels = {
    active: "Active",
    trialing: "Trial",
    past_due: "Past due",
    canceling: "Canceling",
    canceled: "Canceled",
    incomplete: "Incomplete",
  };
  return labels[status] || (status ? titleCase(status) : "Ready");
}

function selectSection(sectionId, { updateHash = true, focus = false } = {}) {
  if (!SECTION_COPY[sectionId]) sectionId = "overview";
  menuItems.forEach((item) => {
    const selected = item.dataset.section === sectionId;
    item.classList.toggle("is-active", selected);
    item.setAttribute("aria-selected", String(selected));
    item.tabIndex = selected ? 0 : -1;
    if (selected && focus) item.focus();
  });
  panels.forEach((panel) => {
    const selected = panel.dataset.panel === sectionId;
    panel.classList.toggle("hidden", !selected);
    panel.hidden = !selected;
  });
  document.getElementById("page-title").textContent = SECTION_COPY[sectionId].title;
  document.getElementById("page-description").textContent = SECTION_COPY[sectionId].description;
  if (updateHash && window.location.hash !== `#${sectionId}`) history.replaceState(null, "", `#${sectionId}`);
  document.title = `${SECTION_COPY[sectionId].title} · Themys`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateBehaviorSummary() {
  const enabled = state.autoScanEnabled;
  document.getElementById("overview-auto-scan").textContent = enabled ? "On" : "Prompt first";
  document.getElementById("behavior-icon").textContent = enabled ? "✓" : "↗";
  document.getElementById("behavior-title").textContent = enabled ? "Scan automatically" : "Ask before scanning";
  document.getElementById("behavior-copy").textContent = enabled
    ? "A review starts when Themys is confident that the current page is legal terms."
    : "Themys shows a small prompt and waits for you to start the scan.";
  document.getElementById("hero-status-title").textContent = enabled
    ? "Automatic reviews are on"
    : "Themys waits for your go-ahead";
  document.getElementById("hero-status-copy").textContent = enabled
    ? "High-confidence Terms and Privacy pages are reviewed automatically. You can switch back to a prompt at any time."
    : "Themys detects likely Terms and Privacy pages on-device, then shows a discreet prompt before using a scan.";
}

function updateClauseSummary() {
  const count = state.targetClauses.length;
  document.getElementById("menu-clause-count").textContent = String(count);
  document.getElementById("overview-clause-count").textContent = String(count);
  document.getElementById("overview-playbook").textContent = PLAYBOOKS[state.playbookId]?.label || "Consumer app";
  document.getElementById("clause-total-badge").textContent = `${count} ${count === 1 ? "clause" : "clauses"}`;
}

function updateAccountSummary() {
  const plan = planLabel(state.plan);
  const subscription = statusLabel(state.subscriptionStatus);
  document.getElementById("overview-plan").textContent = state.isAuthenticated ? plan.replace("Themys ", "") : "Sign in";
  document.getElementById("overview-plan-detail").textContent = state.isAuthenticated ? subscription : "View account";
  document.getElementById("plan-name").textContent = state.isAuthenticated ? plan : "Sign in to Themys";
  document.getElementById("plan-status").textContent = state.isAuthenticated ? subscription : "Signed out";
  document.getElementById("plan-description").textContent = state.isAuthenticated
    ? "Manage plan changes, cancellation, credits, and payment history in your secure Themys account."
    : "Connect your account to see your plan and manage billing.";
  document.getElementById("session-copy").textContent = state.isAuthenticated
    ? "Your extension is connected to your signed-in Themys account."
    : "Sign in to sync clauses, location, history, and subscription details.";

  const chip = document.getElementById("account-chip");
  chip.classList.remove("is-loading");
  chip.classList.toggle("is-signed-out", !state.isAuthenticated);
  document.getElementById("account-chip-label").textContent = state.isAuthenticated ? `${plan} · Connected` : "Not signed in";
  signOutBtn.classList.toggle("hidden", !state.isAuthenticated);
}

function setAuthenticated(authenticated) {
  state.isAuthenticated = authenticated;
  if (!authenticated) {
    state.targetClauses = [];
    state.strictMode = false;
    state.playbookId = "consumer_app";
    state.country = "";
    state.stateRegion = "";
    state.plan = "free";
    state.subscriptionStatus = null;
    strictModeToggle.checked = false;
    playbookSelect.value = state.playbookId;
    playbookRadios.forEach((radio) => { radio.checked = radio.value === state.playbookId; });
    countryInput.value = "";
    stateInput.value = "";
  }
  authWarning.classList.toggle("hidden", authenticated);
  for (const input of [countryInput, stateInput, strictModeToggle, clauseInput, ...playbookRadios]) {
    input.disabled = !authenticated;
  }
  commonClauseBtns.forEach((button) => { button.disabled = !authenticated; });
  clausesContainer.classList.remove("hidden");
  loadingSpinner.classList.add("hidden");
  updateAccountSummary();
  renderTags();
}

function renderTags() {
  tagsList.replaceChildren();
  state.targetClauses.forEach((clause) => {
    const tag = document.createElement("span");
    tag.className = "tag";

    const label = document.createElement("span");
    label.textContent = clause;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${clause}`);
    remove.textContent = "×";
    remove.disabled = !state.isAuthenticated;
    remove.addEventListener("click", () => removeClause(clause));

    tag.append(label, remove);
    tagsList.appendChild(tag);
  });
  updateClauseSummary();
  renderSuggestions();
}

function renderSuggestions() {
  const selected = new Set(state.targetClauses.map((clause) => clause.toLocaleLowerCase()));
  commonClauseBtns.forEach((button) => {
    button.disabled = !state.isAuthenticated || selected.has(button.dataset.clause.toLocaleLowerCase());
  });
}

function addClause(rawClause) {
  if (!state.isAuthenticated) return;
  const clause = rawClause.trim().replace(/\s+/g, " ").slice(0, 120);
  if (!clause) return;
  const exists = state.targetClauses.some((existing) => existing.toLocaleLowerCase() === clause.toLocaleLowerCase());
  if (exists) return;
  state.targetClauses.push(clause);
  renderTags();
  markChanged();
}

function removeClause(clause) {
  state.targetClauses = state.targetClauses.filter((item) => item !== clause);
  renderTags();
  markChanged();
}

function markChanged() {
  if (!state.isAuthenticated) return;
  hasChanges = true;
  saveBar.classList.remove("hidden", "is-success", "is-error");
  saveStatus.textContent = "Your changes will apply to future scans.";
  saveBtn.disabled = false;
  saveBtn.textContent = "Save changes";
}

function applyProfile(profile) {
  state.targetClauses = Array.isArray(profile.targetClauses) ? profile.targetClauses : [];
  state.strictMode = profile.strictMode === true;
  state.playbookId = PLAYBOOKS[profile.playbookId] ? profile.playbookId : "consumer_app";
  state.country = profile.country || "";
  state.stateRegion = profile.state || "";
  state.plan = profile.plan || "free";
  state.subscriptionStatus = profile.subscriptionStatus || null;

  strictModeToggle.checked = state.strictMode;
  playbookSelect.value = state.playbookId;
  playbookRadios.forEach((radio) => { radio.checked = radio.value === state.playbookId; });
  countryInput.value = state.country;
  stateInput.value = state.stateRegion;
  renderTags();
  updateAccountSummary();
}

async function loadProfile() {
  loadingSpinner.classList.remove("hidden");
  clausesContainer.classList.add("hidden");
  const response = await sendMessage({ type: "GET_PROFILE" });
  if (response?.success && response.profile) {
    setAuthenticated(true);
    applyProfile(response.profile);
    return;
  }
  setAuthenticated(false);
}

async function init() {
  const dashboardUrl = `${appOrigin}/dashboard`;
  document.getElementById("dashboard-link").href = dashboardUrl;
  document.getElementById("sidebar-dashboard-link").href = dashboardUrl;
  document.getElementById("manage-plan-link").href = `${appOrigin}/settings#subscription`;

  const stored = await storageGet(["autoScanEnabled"]);
  state.autoScanEnabled = policy
    ? policy.isAutoScanEnabled(stored.autoScanEnabled)
    : stored.autoScanEnabled === true;
  autoScanToggle.checked = state.autoScanEnabled;
  updateBehaviorSummary();
  updateClauseSummary();

  const requestedSection = window.location.hash.slice(1);
  selectSection(SECTION_COPY[requestedSection] ? requestedSection : "overview", { updateHash: false });
  await loadProfile();
}

menuItems.forEach((item) => {
  item.addEventListener("click", () => selectSection(item.dataset.section));
});

document.querySelector(".menu").addEventListener("keydown", (event) => {
  if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const current = Math.max(0, menuItems.findIndex((item) => item.classList.contains("is-active")));
  let next = current;
  if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (current + 1) % menuItems.length;
  if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = (current - 1 + menuItems.length) % menuItems.length;
  if (event.key === "Home") next = 0;
  if (event.key === "End") next = menuItems.length - 1;
  selectSection(menuItems[next].dataset.section, { focus: true });
});

window.addEventListener("hashchange", () => {
  const section = window.location.hash.slice(1);
  if (SECTION_COPY[section]) selectSection(section, { updateHash: false });
});

document.querySelectorAll("[data-go-to]").forEach((button) => {
  button.addEventListener("click", () => selectSection(button.dataset.goTo));
});

autoScanToggle.addEventListener("change", async (event) => {
  state.autoScanEnabled = event.target.checked === true;
  await storageSet({ autoScanEnabled: state.autoScanEnabled });
  updateBehaviorSummary();
});

clauseInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === ",") {
    event.preventDefault();
    addClause(clauseInput.value);
    clauseInput.value = "";
  }
});

clauseInput.addEventListener("blur", () => {
  if (!clauseInput.value.trim()) return;
  addClause(clauseInput.value);
  clauseInput.value = "";
});

commonClauseBtns.forEach((button) => {
  button.addEventListener("click", () => addClause(button.dataset.clause));
});

playbookRadios.forEach((radio) => {
  radio.addEventListener("change", () => {
    if (!radio.checked || !PLAYBOOKS[radio.value]) return;
    state.playbookId = radio.value;
    playbookSelect.value = radio.value;
    state.targetClauses = mergePlaybookTopics(radio.value, state.targetClauses);
    renderTags();
    markChanged();
  });
});

strictModeToggle.addEventListener("change", (event) => {
  state.strictMode = event.target.checked;
  markChanged();
});

countryInput.addEventListener("input", (event) => {
  state.country = event.target.value;
  markChanged();
});

stateInput.addEventListener("input", (event) => {
  state.stateRegion = event.target.value;
  markChanged();
});

document.getElementById("clear-dismissed-btn").addEventListener("click", async () => {
  const status = document.getElementById("dismissed-status");
  await storageRemove("themys-dismissed");
  status.textContent = "Dismissed sites cleared. Detection prompts can appear again.";
  status.classList.remove("hidden");
  window.setTimeout(() => status.classList.add("hidden"), 3500);
});

saveBtn.addEventListener("click", async () => {
  if (clauseInput.value.trim()) {
    addClause(clauseInput.value);
    clauseInput.value = "";
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";
  saveStatus.textContent = "Syncing with your Themys account…";
  saveBar.classList.remove("is-success", "is-error");

  const response = await sendMessage({
    type: "UPDATE_PROFILE",
    targetClauses: state.targetClauses,
    strictMode: state.strictMode,
    playbookId: state.playbookId,
    country: state.country,
    state: state.stateRegion,
  });

  if (response?.success) {
    hasChanges = false;
    if (response.profile) applyProfile(response.profile);
    saveBtn.textContent = "Saved";
    saveStatus.textContent = "Preferences saved. Future scans will use these choices.";
    saveBar.classList.add("is-success");
    clearTimeout(saveResetTimer);
    saveResetTimer = window.setTimeout(() => saveBar.classList.add("hidden"), 2200);
    return;
  }

  saveBtn.disabled = false;
  saveBtn.textContent = "Try again";
  saveStatus.textContent = response?.error || "Could not save your preferences.";
  saveBar.classList.add("is-error");
});

signInBtn.addEventListener("click", () => sendMessage({ type: "OPEN_AUTH" }));

signOutBtn.addEventListener("click", async () => {
  signOutBtn.disabled = true;
  await sendMessage({ type: "SIGN_OUT" });
  hasChanges = false;
  saveBar.classList.add("hidden");
  setAuthenticated(false);
  signOutBtn.disabled = false;
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "AUTH_SUCCESS") loadProfile();
});

window.addEventListener("beforeunload", (event) => {
  if (!hasChanges) return;
  event.preventDefault();
  event.returnValue = "";
});

init();
