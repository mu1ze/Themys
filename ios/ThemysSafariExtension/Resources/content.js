const detection = globalThis.ThemysDetection;
if (!detection) throw new Error("ThemysDetection must load before Safari content.js");

const ext = typeof browser !== "undefined" ? browser : chrome;
const TEXT_LIMIT = detection.TEXT_LIMIT;
const DISMISS_MS = detection.DISMISS_MS;

let lastDetectedUrl = null;
let scanInProgress = false;
let detectDebounce = null;
let popupWidgetUrl = null;

function headingTextsFromDocument() {
  const headings = document.querySelectorAll("h1, h2");
  const texts = [];
  for (const h of headings) {
    if (h.querySelector("a") && h.textContent.trim().length < 80) continue;
    texts.push(h.textContent.trim());
  }
  return texts;
}

async function isOriginDismissed() {
  const origin = location.origin;
  const result = await ext.storage.local.get("themys-dismissed");
  const map = result["themys-dismissed"] || {};
  const dismissedAt = map[origin];
  if (!dismissedAt) return false;
  const timestamp = typeof dismissedAt === "number" ? dismissedAt : 0;
  return Date.now() - timestamp < DISMISS_MS;
}

async function dismissOrigin() {
  const origin = location.origin;
  const result = await ext.storage.local.get("themys-dismissed");
  const map = result["themys-dismissed"] || {};
  map[origin] = Date.now();
  await ext.storage.local.set({ "themys-dismissed": map });
}

async function autoDetectEnabled() {
  const local = await ext.storage.local.get("autoDetectEnabled");
  if (typeof local.autoDetectEnabled === "boolean") return local.autoDetectEnabled;
  try {
    const prefs = await ext.runtime.sendMessage({ type: "GET_PREFS" });
    if (typeof prefs?.autoDetectEnabled === "boolean") return prefs.autoDetectEnabled;
  } catch (_) {}
  return true;
}

async function shouldOfferCapture() {
  if (!(await autoDetectEnabled())) return false;
  if (await isOriginDismissed()) return false;
  return true;
}

function hostnameOf(url, fallback) {
  try {
    return new URL(url).hostname;
  } catch {
    return fallback;
  }
}

function showBadge() {
  const overlay = window.__themysOverlay;
  if (!overlay?.showDetectionBadge) return;
  overlay.showDetectionBadge(
    () => {
      startScan({ url: location.href, domain: location.hostname, text: document.body.innerText.slice(0, TEXT_LIMIT) });
    },
    () => {
      dismissOrigin();
    },
  );
}

function startScan({ url, domain, text }) {
  if (scanInProgress) return;
  scanInProgress = true;
  try {
    window.__themysOverlay?.showLoadingOverlay?.();
  } catch (_) {}
  const message = text
    ? { type: "SCAN_PAGE", url, domain, text }
    : { type: "TOS_DETECTED", url, domain };
  ext.runtime
    .sendMessage(message)
    .catch(() => {
      scanInProgress = false;
      window.__themysOverlay?.showError?.("Could not reach Themys.");
    });
}

function startLinkedTermsScan(termsUrl) {
  const url = termsUrl || location.href;
  startScan({
    url,
    domain: hostnameOf(url, location.hostname),
  });
}

function showPopupWidget(payload) {
  const overlay = window.__themysOverlay;
  const termsUrl = typeof payload?.termsUrl === "string" && payload.termsUrl ? payload.termsUrl : null;
  const url = termsUrl || location.href;
  if (popupWidgetUrl === url) return;
  popupWidgetUrl = url;

  if (!overlay?.showInlineWidget) {
    overlay?.showDetectionBadge?.(
      () => startLinkedTermsScan(termsUrl),
      () => dismissOrigin(),
    );
    return;
  }

  overlay.showInlineWidget(
    termsUrl,
    payload?.detectionType,
    (scannedUrl) => {
      popupWidgetUrl = null;
      startLinkedTermsScan(scannedUrl || termsUrl);
    },
    (dismissedUrl) => {
      popupWidgetUrl = null;
      dismissOrigin();
    },
  );
}

async function handlePopupDetected(payload) {
  if (!(await shouldOfferCapture())) return;
  showPopupWidget(payload);
}

async function detectTosPage() {
  if (!document.body) return;
  if (scanInProgress) return;
  if (detection.isExcludedPage({
    hostname: location.hostname,
    pathname: location.pathname,
    search: location.search,
  })) return;

  const url = location.href;
  if (lastDetectedUrl === url) return;

  const scored = detection.scorePage({
    hostname: location.hostname,
    pathname: location.pathname,
    search: location.search,
    title: document.title,
    headingTexts: headingTextsFromDocument(),
    bodyText: document.body.innerText,
  });
  if (!detection.isHighConfidenceLegalPage(scored)) return;
  if (!(await autoDetectEnabled())) return;
  if (await isOriginDismissed()) {
    lastDetectedUrl = url;
    return;
  }

  lastDetectedUrl = url;
  showBadge();
}

function debouncedDetect() {
  if (detectDebounce) clearTimeout(detectDebounce);
  detectDebounce = setTimeout(detectTosPage, 1500);
}

detectTosPage();
window.addEventListener("popstate", () => {
  lastDetectedUrl = null;
  popupWidgetUrl = null;
  setTimeout(detectTosPage, 500);
});
if (document.body) {
  new MutationObserver(debouncedDetect).observe(document.body, { childList: true, subtree: true });
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.type === "THEMYS_POPUP_DETECTED") {
    handlePopupDetected(event.data.payload);
  }
});

ext.runtime.onMessage.addListener((msg) => {
  if (msg.type === "SCAN_RESULT") {
    scanInProgress = false;
    try {
      window.__themysOverlay?.injectOverlay?.(msg.data);
    } catch (_) {}
  }
  if (msg.type === "SCAN_ERROR") {
    scanInProgress = false;
    window.__themysOverlay?.showError?.(msg.error || "Scan failed");
  }
  if (msg.type === "AUTH_REQUIRED") {
    scanInProgress = false;
    window.__themysOverlay?.showAuthRequired?.();
  }
  if (msg.type === "LIMIT_REACHED") {
    scanInProgress = false;
    window.__themysOverlay?.showLimitReached?.(msg.data);
  }
});
