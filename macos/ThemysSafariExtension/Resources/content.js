const chrome = (() => {
  const api = typeof browser !== "undefined" ? browser : globalThis.chrome;
  if (!api) return api;
  const callbackify = (namespace, method) => (...args) => {
    const callback = typeof args.at(-1) === "function" ? args.pop() : null;
    const result = namespace[method](...args);
    if (callback && result?.then) result.then(callback);
    return result;
  };
  const local = api.storage?.local;
  const storage = local ? { ...api.storage, local: {
    ...local,
    get: callbackify(local, "get"),
    set: callbackify(local, "set"),
    remove: callbackify(local, "remove"),
  } } : api.storage;
  const tabs = api.tabs ? { ...api.tabs,
    create: callbackify(api.tabs, "create"),
    remove: callbackify(api.tabs, "remove"),
    update: callbackify(api.tabs, "update"),
    query: callbackify(api.tabs, "query"),
    sendMessage: callbackify(api.tabs, "sendMessage"),
  } : api.tabs;
  const alarms = api.alarms ? { ...api.alarms,
    create: callbackify(api.alarms, "create"),
    clear: callbackify(api.alarms, "clear"),
  } : api.alarms;
  const adaptMessageEvent = (event) => event ? {
    addListener(listener) {
      event.addListener((message, sender) => {
        let respond;
        const response = new Promise((resolve) => { respond = resolve; });
        const result = listener(message, sender, (value) => respond(value));
        if (result && typeof result.then === "function") return result;
        if (result === true) return response;
        return result;
      });
    },
  } : event;
  const runtime = api.runtime ? {
    ...api.runtime,
    onMessage: adaptMessageEvent(api.runtime.onMessage),
    onMessageExternal: adaptMessageEvent(api.runtime.onMessageExternal),
  } : api.runtime;
  return { ...api, storage, tabs, alarms, runtime };
})();
const detection = globalThis.ThemysDetection;
if (!detection) throw new Error("ThemysDetection must load before content.js");
const policy = globalThis.ThemysCapturePolicy;
if (!policy) throw new Error("ThemysCapturePolicy must load before content.js");

let lastDetectedUrl = null;
let lastDetectedDomain = null;
let scanInProgress = false;
let loadingTimeout = null;
let rateLimited = false;
let detectDebounce = null;
let domainSitemapCache = {};
let pendingScan = null;

const DETECTION_THRESHOLD = detection.DETECTION_THRESHOLD;
const TEXT_LIMIT = detection.TEXT_LIMIT;
const SCAN_TIMEOUT_MS = 45000;
const DISMISS_MS = detection.DISMISS_MS;

function headingTextsFromDocument() {
  const headings = document.querySelectorAll("h1, h2");
  const texts = [];
  for (const h of headings) {
    if (h.querySelector("a") && h.textContent.trim().length < 80) continue;
    texts.push(h.textContent.trim());
  }
  return texts;
}

function isExcludedPage() {
  if (globalThis.THEMYS_CONFIG?.appOrigin && location.origin === globalThis.THEMYS_CONFIG.appOrigin) {
    return true;
  }
  return detection.isExcludedPage({
    hostname: location.hostname,
    pathname: location.pathname,
    search: location.search,
  });
}

function scoreURL() {
  return detection.scoreURL(location.pathname);
}

function scoreDOM() {
  return detection.scoreDomSignals({
    title: document.title,
    headingTexts: headingTextsFromDocument(),
    bodyText: document.body.innerText,
  });
}

// --- Sitemap-based detection ---

async function checkSitemapForTos(domain) {
  if (domainSitemapCache[domain]) return domainSitemapCache[domain];
  const result = { checked: true, tosUrls: [] };
  domainSitemapCache[domain] = result;

  try {
    const res = await fetch(`https://${domain}/sitemap.xml`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return result;
    const text = await res.text();
    const urls = text.match(/<loc>([^<]+)<\/loc>/g) || [];
    for (const urlMatch of urls) {
      const url = urlMatch.replace(/<\/?loc>/g, "").toLowerCase();
      if (detection.sitemapUrlLooksLegal(url)) {
        result.tosUrls.push(url);
      }
    }
  } catch (_) {}

  return result;
}

function checkIfCurrentPageIsSitemapTos(sitemapResult) {
  const currentUrl = location.href.toLowerCase();
  return sitemapResult.tosUrls.some(tosUrl => currentUrl === tosUrl || currentUrl.startsWith(tosUrl));
}

// --- Core detection ---

function startScanTimeout() {
  clearScanTimeout();
  loadingTimeout = setTimeout(() => {
    if (scanInProgress) {
      console.warn("[Themys] Scan timed out");
      scanInProgress = false;
      showErrorOverlay("Scan timed out. Please try again.");
    }
  }, SCAN_TIMEOUT_MS);
}

function clearScanTimeout() {
  if (loadingTimeout) {
    clearTimeout(loadingTimeout);
    loadingTimeout = null;
  }
}

function showErrorOverlay(msg) {
  try {
    if (window.__themysOverlay && window.__themysOverlay.showError) {
      window.__themysOverlay.showError(msg);
    }
  } catch (_) {}
}

async function isOriginDismissed() {
  const origin = location.origin;
  const result = await chrome.storage.local.get("themys-dismissed");
  const map = result["themys-dismissed"] || {};
  const dismissedAt = map[origin];
  if (!dismissedAt) return false;
  const timestamp = typeof dismissedAt === "number"
    ? dismissedAt
    : dismissedAt === true
      ? Date.now()
      : 0;
  return Date.now() - timestamp < DISMISS_MS;
}

async function readAutoScanEnabled() {
  const result = await chrome.storage.local.get(["autoScanEnabled"]);
  return policy.isAutoScanEnabled(result.autoScanEnabled);
}

function dismissCurrentOrigin() {
  chrome.storage.local.get("themys-dismissed", (result) => {
    const map = result["themys-dismissed"] || {};
    map[location.origin] = Date.now();
    chrome.storage.local.set({ "themys-dismissed": map });
  });
}

function showBadgeForCurrentPage() {
  try {
    if (window.__themysOverlay && window.__themysOverlay.showDetectionBadge) {
      // Suppress the popup-detector inline widget for this URL so we don't
      // show two scan buttons simultaneously.
      popupWidgetUrl = location.href;
      window.__themysOverlay.showDetectionBadge(
        () => startManualScan(document.body.innerText.slice(0, TEXT_LIMIT)),
        dismissCurrentOrigin,
      );
    }
  } catch (_) {}
}

function startManualScan(text) {
  if (scanInProgress || rateLimited) return;

  lastDetectedUrl = location.href;
  lastDetectedDomain = location.hostname;
  pendingScan = { url: location.href, title: document.title, text };
  scanInProgress = true;

  try {
    if (window.__themysOverlay && window.__themysOverlay.showLoadingOverlay) {
      window.__themysOverlay.showLoadingOverlay();
    }
  } catch (_) {}

  startScanTimeout();

  chrome.runtime.sendMessage({
    type: "SCAN_TEXT",
    url: location.href,
    title: document.title,
    text,
  }).catch((err) => {
    console.error("[Themys] Failed to send SCAN_TEXT:", err.message);
    scanInProgress = false;
    pendingScan = null;
    clearScanTimeout();
    showErrorOverlay("Could not reach Themys extension.");
  });
}

async function triggerScan(reason) {
  if (scanInProgress || rateLimited) return;
  const url = location.href;
  if (lastDetectedUrl === url) return;

  if (await isOriginDismissed()) {
    lastDetectedUrl = url;
    lastDetectedDomain = location.hostname;
    console.log("[Themys] ToS detected (" + reason + "), dismissed for this origin");
    return;
  }

  const autoScanEnabled = await readAutoScanEnabled();

  if (policy.detectionAction(autoScanEnabled) === "badge") {
    lastDetectedUrl = url;
    lastDetectedDomain = location.hostname;
    console.log("[Themys] ToS detected (" + reason + "), auto-scan disabled");
    showBadgeForCurrentPage();
    return;
  }

  lastDetectedUrl = url;
  lastDetectedDomain = location.hostname;
  pendingScan = {
    url,
    title: document.title,
    text: document.body.innerText.slice(0, TEXT_LIMIT),
  };
  scanInProgress = true;

  console.log("[Themys] ToS detected (" + reason + ")");

  try {
    if (window.__themysOverlay && window.__themysOverlay.showLoadingOverlay) {
      window.__themysOverlay.showLoadingOverlay();
    }
  } catch (_) {}

  startScanTimeout();

  chrome.runtime.sendMessage({
    type: "TOS_DETECTED",
    url: url,
    title: document.title,
    textContent: document.body.innerText.slice(0, TEXT_LIMIT)
  }).catch((err) => {
    console.error("[Themys] Failed to send TOS_DETECTED:", err.message);
    scanInProgress = false;
    pendingScan = null;
    clearScanTimeout();
    showErrorOverlay("Could not reach Themys extension.");
  });
}

async function detectTosPage() {
  if (isExcludedPage()) return;
  if (rateLimited) return;
  if (scanInProgress) return;

  const url = location.href;
  if (lastDetectedUrl === url) return;

  const urlScore = scoreURL();
  const domScore = scoreDOM();
  const combined = urlScore + domScore;
  const pageScore = { urlScore, domScore, combined };

  console.log("[Themys] Scores — url:", urlScore, "dom:", domScore, "combined:", combined);

  // Strong signal: trigger immediately
  if (detection.isHighConfidenceLegalPage(pageScore)) {
    triggerScan("combined " + combined);
    return;
  }

  // Weak signal: URL matches but DOM score is low — check sitemap
  if (urlScore >= 2 && domScore >= 3) {
    const domain = location.hostname;
    checkSitemapForTos(domain).then((sitemapResult) => {
      if (scanInProgress || rateLimited) return;
      if (checkIfCurrentPageIsSitemapTos(sitemapResult)) {
        console.log("[Themys] Sitemap confirms ToS page");
        triggerScan("sitemap");
      }
    });
  }
}

function debouncedDetect() {
  if (detectDebounce) clearTimeout(detectDebounce);
  detectDebounce = setTimeout(detectTosPage, 1500); // 1.5s debounce
}

// Initial detection
detectTosPage();

// SPA navigation detection
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

function onNavigate() {
  lastDetectedUrl = null;
  pendingScan = null;
  scanInProgress = false;
  rateLimited = false;
  clearScanTimeout();
  setTimeout(detectTosPage, 500);
}

history.pushState = function (...args) {
  originalPushState.apply(this, args);
  onNavigate();
};

history.replaceState = function (...args) {
  originalReplaceState.apply(this, args);
  onNavigate();
};

window.addEventListener("popstate", onNavigate);

const observer = new MutationObserver(debouncedDetect);
observer.observe(document.body, { childList: true, subtree: true });

// --- Page events ---
window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  // Popup detection — show inline widget
  if (event.data?.type === "THEMYS_POPUP_DETECTED") {
    const payload = event.data.payload;
    console.log("[Themys] Popup detected:", payload.detectionType, payload.termsUrl);
    showPopupWidget(payload);
  }

  // Popup dismiss
  if (event.data?.type === "THEMYS_POPUP_DISMISS") {
    window.postMessage({ type: "THEMYS_POPUP_DISMISS", payload: event.data.payload }, "*");
  }
});

// --- Popup detection widget ---
// Guard so the inline widget is shown at most once per page URL, regardless of
// which detector fired (ToS-page detection or agreement/checkbox detection).
let popupWidgetUrl = null;

function showPopupWidget(payload) {
  const overlay = window.__themysOverlay;
  if (!overlay?.showInlineWidget) return;

  // Don't show if a scan is already in progress
  if (scanInProgress) return;

  const url = payload.termsUrl || window.location.href;
  if (popupWidgetUrl === url) return;
  popupWidgetUrl = url;

  // Remove any existing detection badge so we don't show two scan buttons
  if (overlay.removeOverlay) overlay.removeOverlay();

  overlay.showInlineWidget(
    payload.termsUrl,
    payload.detectionType,
    // onScan
    (termsUrl) => {
      if (scanInProgress) return;
      popupWidgetUrl = null;
      scanInProgress = true;
      const scanUrl = termsUrl || window.location.href;
      pendingScan = {
        url: scanUrl,
        title: document.title,
        text: document.body.innerText.slice(0, TEXT_LIMIT),
      };
      startScanTimeout();
      const overlayApi = window.__themysOverlay;
      if (overlayApi?.showLoadingOverlay) overlayApi.showLoadingOverlay();
      chrome.runtime.sendMessage({ type: "TOS_DETECTED", url: scanUrl }).catch((err) => {
        console.error("[Themys] Failed to send TOS_DETECTED:", err.message);
        scanInProgress = false;
        pendingScan = null;
        clearScanTimeout();
      });
    },
    // onDismiss
    (termsUrl) => {
      popupWidgetUrl = null;
      window.postMessage({ type: "THEMYS_POPUP_DISMISS", payload: { termsUrl } }, "*");
    }
  );
}

// --- Messages from background ---
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "SCAN_PAGE_TEXT") {
    startManualScan(document.body.innerText.slice(0, TEXT_LIMIT));
    return;
  }

  if (msg.type === "SCAN_SELECTION") {
    const selection = window.getSelection().toString();
    if (!selection.trim()) {
      showErrorOverlay("Select text first.");
      return;
    }
    startManualScan(selection.slice(0, TEXT_LIMIT));
    return;
  }

  if (msg.type === "SCAN_RESULT") {
    scanInProgress = false;
    rateLimited = false;
    pendingScan = null;
    clearScanTimeout();
    console.log("[Themys] Scan result, attention level:", msg.data?.riskScore);
    try {
      if (window.__themysOverlay && window.__themysOverlay.injectOverlay) {
        window.__themysOverlay.injectOverlay(msg.data);
      }
    } catch (e) {
      console.error("[Themys] Failed to inject overlay:", e);
    }
  }

  if (msg.type === "SCAN_ERROR") {
    scanInProgress = false;
    pendingScan = null;
    clearScanTimeout();
    console.error("[Themys] Scan error:", msg.error);
    showErrorOverlay(msg.error || "Scan failed");
  }

  if (msg.type === "AUTH_REQUIRED") {
    scanInProgress = false;
    clearScanTimeout();
    try {
      if (window.__themysOverlay && window.__themysOverlay.showAuthRequired) {
        window.__themysOverlay.showAuthRequired();
      }
    } catch (_) {}
  }

  if (msg.type === "LIMIT_REACHED") {
    scanInProgress = false;
    rateLimited = true;
    pendingScan = null;
    clearScanTimeout();
    try {
      if (window.__themysOverlay && window.__themysOverlay.showLimitReached) {
        window.__themysOverlay.showLimitReached(msg.data);
      }
    } catch (_) {}
  }

  if (msg.type === "AUTH_SUCCESS") {
    scanInProgress = false;
    rateLimited = false;
    clearScanTimeout();
    readAutoScanEnabled().then((autoScanEnabled) => {
      const action = policy.afterAuthAction({ pendingScan, autoScanEnabled });
      if (action === "resume-pending" && pendingScan) {
        const scan = pendingScan;
        pendingScan = null;
        startManualScan(scan.text);
        return;
      }
      pendingScan = null;
      lastDetectedUrl = null;
      setTimeout(detectTosPage, 500);
    });
  }
});
