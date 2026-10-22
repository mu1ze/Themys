const signInBtn = document.getElementById("sign-in-btn");
const signOutBtn = document.getElementById("sign-out-btn");
const notSignedIn = document.getElementById("not-signed-in");
const historySection = document.getElementById("history-section");
const historyLoading = document.getElementById("history-loading");
const historyEmpty = document.getElementById("history-empty");
const historyList = document.getElementById("history-list");
const historyError = document.getElementById("history-error");
const historyErrorMsg = document.getElementById("history-error-msg");
const refreshBtn = document.getElementById("refresh-btn");
const onboardingBanner = document.getElementById("onboarding-banner");
const settingsBtn = document.getElementById("settings-btn");
const scanPageBtn = document.getElementById("scan-page-btn");
const scanSelectionBtn = document.getElementById("scan-selection-btn");
document.getElementById("new-scan-link").href = `${globalThis.THEMYS_CONFIG.appOrigin}/scan/new`;
document.getElementById("dashboard-link").href = `${globalThis.THEMYS_CONFIG.appOrigin}/dashboard`;
document.getElementById("account-link").href = `${globalThis.THEMYS_CONFIG.appOrigin}/settings`;

function showState(states) {
  [historyLoading, historyEmpty, historyList, historyError].forEach(el => el.classList.add("hidden"));
  states.forEach(el => el && el.classList.remove("hidden"));
}

function formatDate(isoString) {
  if (!isoString) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(isoString));
}

function riskColor(score) {
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  return "low";
}

function attentionLabel(score) {
  if (score >= 7) return "Needs attention";
  if (score >= 4) return "Worth reviewing";
  return "Standard";
}

function buildLogoUrl(domain) {
  if (!domain) return null;
  try {
    const hostname = domain.includes(".") ? domain : domain + ".com";
    return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(hostname)}`;
  } catch { return null; }
}

function formatName(scan) {
  const domain = scan.domain || "";
  const hostname = domain.replace(/^www\./, "");
  const parts = hostname.split(".");
  const base = parts.length >= 2 ? parts[parts.length - 2] : parts[0] || "Unknown";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function renderHistory(scans) {
  if (!scans || scans.length === 0) {
    showState([historyEmpty]);
    return;
  }

  historyList.innerHTML = "";

  scans.forEach(scan => {
    const card = document.createElement("div");
    card.className = "scan-card";

    const logoUrl = buildLogoUrl(scan.domain);
    const name = formatName(scan);
    const score = scan.riskScore != null ? Math.round(scan.riskScore) : 0;
    const color = riskColor(score);

    card.innerHTML = `
      <div class="scan-logo">
        ${logoUrl ? `<img src="${logoUrl}" alt="${name}" width="24" height="24" referrerpolicy="no-referrer" />` : `<div class="logo-placeholder">${name.charAt(0)}</div>`}
      </div>
      <div class="scan-info">
        <span class="scan-name">${escapeHtml(name)}</span>
        <span class="scan-meta">${scan.flaggedCount || 0} flags &middot; ${formatDate(scan.createdAt)}</span>
      </div>
      <span class="scan-score ${color}">${attentionLabel(score)}</span>
    `;

    card.addEventListener("click", () => loadScan(scan));
    historyList.appendChild(card);
  });

  showState([historyList]);
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function loadScan(scan) {
  // Store as last scan and show in overlay on active tab
  chrome.storage.local.set({ "themys-last-scan": scan });

  // Fetch full scan data and show in overlay
  chrome.runtime.sendMessage({ type: "LOAD_SCAN", scanId: scan.id }, (response) => {
    if (response && response.error) {
      console.error("Failed to load scan:", response.error);
      return;
    }
    if (response && response.scan) {
      const tagsByClause = (response.complianceTags || []).reduce((grouped, tag) => {
        if (!grouped[tag.clauseId]) grouped[tag.clauseId] = [];
        grouped[tag.clauseId].push({
          regulationCode: tag.regulationCode,
          articleId: tag.articleId,
          articleTitle: tag.articleTitle || "",
          relevance: tag.relevance,
          quote: tag.quote || undefined,
        });
        return grouped;
      }, {});
      const flaggedClauses = (response.clauses || []).filter(c => c.isFlagged);
      // Transform to overlay format
      const overlayData = {
        riskScore: response.scan.riskScore || 0,
        summary: `Scan of ${formatName(response.scan)} — ${response.scan.flaggedCount || 0} flagged clauses`,
        flags: flaggedClauses.map(c => ({
            id: c.id,
            category: c.category || "other",
            severity: c.riskLevel === "red" ? "high" : c.riskLevel === "yellow" ? "medium" : "low",
            text: c.text || "",
            fullClauseText: c.text || "",
            explanation: c.explanation || "",
            whyItMatters: c.whyItMatters || "",
            recommendedAction: c.recommendedAction || "",
            isTargetClause: Boolean(c.isTargetClause),
            isStandardPractice: Boolean(c.isStandardPractice),
            complianceTags: tagsByClause[c.id] || [],
          })),
        pushback: flaggedClauses
          .filter(c => c.recommendedAction && c.whyItMatters)
          .map(c => ({
            clauseId: c.id,
            quote: c.text || "",
            whyItMatters: c.whyItMatters,
            suggestedAsk: c.recommendedAction,
            title: c.category ? c.category.replace(/_/g, " ") : "Review this term",
            category: c.category || undefined,
            isDirectAction: c.riskLevel === "green" || !c.isFlagged,
          })),
        fullExtraction: response.fullExtraction || [],
        model: "",
        tier: "",
        wordCount: 0,
        source: response.scan.source || "web",
      };

      chrome.runtime.sendMessage({ type: "SHOW_SCAN_IN_OVERLAY", scanData: overlayData });
      window.close();
    }
  });
}

function loadHistory() {
  showState([historyLoading]);

  chrome.runtime.sendMessage({ type: "FETCH_HISTORY" }, (response) => {
    if (response && response.error) {
      historyErrorMsg.textContent = response.error;
      showState([historyError]);
      return;
    }
    renderHistory(response?.scans || []);
  });
}

// Onboarding check
chrome.storage.local.get("themys-onboarding", (result) => {
  const state = result["themys-onboarding"];
  if (!state || !state.complete) {
    onboardingBanner.classList.remove("hidden");
    document.getElementById("onboarding-link").addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("onboarding/onboarding.html") });
      window.close();
    });
  }
});

function sendScanMessage(type) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;
    if (!tabId) return;
    chrome.tabs.sendMessage(tabId, { type }, () => {
      const err = chrome.runtime.lastError;
      if (err) console.error("Failed to start scan:", err.message);
    });
    window.close();
  });
}

if (settingsBtn) {
  settingsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });
}

if (scanPageBtn) {
  scanPageBtn.addEventListener("click", () => sendScanMessage("SCAN_PAGE_TEXT"));
}

if (scanSelectionBtn) {
  scanSelectionBtn.addEventListener("click", () => sendScanMessage("SCAN_SELECTION"));
}

// Init
chrome.runtime.sendMessage({ type: "GET_AUTH_STATUS" }, (response) => {
  if (response && response.authenticated) {
    notSignedIn.classList.add("hidden");
    historySection.classList.remove("hidden");
    signOutBtn.classList.remove("hidden");
    loadHistory();
  }
});

// React to live sign-in from any context (onboarding, auth page, refresh)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "AUTH_SUCCESS") {
    notSignedIn.classList.add("hidden");
    historySection.classList.remove("hidden");
    signOutBtn.classList.remove("hidden");
    onboardingBanner.classList.add("hidden");
    loadHistory();
  }
});

signInBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "OPEN_AUTH" });
  window.close();
});

signOutBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "SIGN_OUT" }, () => {
    notSignedIn.classList.remove("hidden");
    historySection.classList.add("hidden");
    signOutBtn.classList.add("hidden");
  });
});

refreshBtn.addEventListener("click", loadHistory);
