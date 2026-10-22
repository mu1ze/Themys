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
importScripts("config.js");
importScripts("detection/themys-capture-policy.js");

const API_BASE = globalThis.THEMYS_CONFIG.appOrigin;
const policy = globalThis.ThemysCapturePolicy;
const SCAN_TIMEOUT_MS = 60000;
const REFRESH_TIMEOUT_MS = 15000;
const AUTH_REFRESH_LEAD_MS = 60000;
let activeScanTabId = null;
let scanTimeout = null;
let authTabId = null;
let authReturnTabId = null;
let refreshPromise = null;
let finishRefresh = null;
let refreshInteractive = true;

// --- Auth management ---

function extensionAuthUrl({ refresh = false, returnUrl = null } = {}) {
  const url = new URL("/extension-auth", API_BASE);
  url.searchParams.set("extension_id", chrome.runtime.id);
  if (refresh) url.searchParams.set("extension_refresh", "1");
  if (policy.isHttpReturnUrl(returnUrl)) url.searchParams.set("return", returnUrl);
  return url.toString();
}

function tokenExpiresAt(token) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return Number(JSON.parse(atob(payload)).exp || 0) * 1000;
  } catch {
    return 0;
  }
}

async function readStoredAuth() {
  const result = await chrome.storage.local.get(["themys-auth-token", "themys-clerk-id", "themys-auth-expires-at"]);
  return {
    token: result["themys-auth-token"] || null,
    clerkId: result["themys-clerk-id"] || null,
    expiresAt: Number(result["themys-auth-expires-at"] || 0),
  };
}

async function setAuthToken(token, clerkId) {
  const expiresAt = tokenExpiresAt(token);
  if (!expiresAt || expiresAt <= Date.now()) throw new Error("Invalid or expired auth token");
  await chrome.storage.local.set({
    "themys-auth-token": token,
    "themys-clerk-id": clerkId,
    "themys-auth-expires-at": expiresAt,
  });
  await chrome.alarms.create("auth-expiry", {
    when: Math.max(Date.now() + 1000, expiresAt - AUTH_REFRESH_LEAD_MS),
  });
}

async function clearAuthToken() {
  await chrome.storage.local.remove(["themys-auth-token", "themys-clerk-id", "themys-auth-expires-at"]);
  await chrome.alarms.clear("auth-expiry");
}

// Open a visible sign-in tab so the user can re-authenticate when the Clerk web
// session has expired. Returns the created tab id (or null).
function openVisibleSignIn() {
  chrome.tabs.create({ url: extensionAuthUrl(), active: true }, (tab) => {
    authTabId = tab?.id || null;
  });
}

async function refreshAuthToken({ interactive = true } = {}) {
  if (refreshPromise) return refreshPromise;
  refreshInteractive = interactive;
  refreshPromise = new Promise((resolve) => {
    let completed = false;
    let needsSignIn = false;
    const complete = (auth) => {
      if (completed) return;
      completed = true;
      finishRefresh = null;
      refreshPromise = null;
      resolve(auth);
    };
    finishRefresh = complete;
    chrome.tabs.create({ url: extensionAuthUrl({ refresh: true }), active: false }, (tab) => {
      authTabId = tab?.id || null;
      if (!authTabId) complete({ token: null, clerkId: null, expiresAt: 0, needsSignIn: false });
    });
    setTimeout(async () => {
      if (authTabId) await chrome.tabs.remove(authTabId).catch(() => undefined);
      authTabId = null;
      complete({ token: null, clerkId: null, expiresAt: 0, needsSignIn });
    }, REFRESH_TIMEOUT_MS);
  });
  return refreshPromise;
}

async function getAuthToken({ refresh = true, interactive = true } = {}) {
  const auth = await readStoredAuth();
  // Refresh on demand only. If the mirror is stale, clear it and refresh now;
  // the refresh either restores it (web session still valid) or triggers a
  // visible sign-in (web session gone).
  if (auth.token && auth.expiresAt > Date.now() + AUTH_REFRESH_LEAD_MS) return auth;
  if (auth.token && auth.expiresAt > Date.now()) {
    if (!refresh) return auth;
    const refreshed = await refreshAuthToken({ interactive });
    return refreshed.token ? refreshed : auth;
  }
  if (auth.token) await clearAuthToken();
  if (!refresh) return { token: null, clerkId: null, expiresAt: 0, needsSignIn: false };
  return refreshAuthToken({ interactive });
}

// --- API calls ---

async function apiPost(path, body, token, idempotencyKey) {
  const headers = { "Content-Type": "application/json", "X-Themys-Client": "extension" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const url = `${API_BASE}${path}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) await clearAuthToken();
      // Return the error data along with status for callers to inspect
      const err = new Error(data.error || `API error: ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  } catch (err) {
    if (!err.status) console.error("[Themys bg] API request failed:", path);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function checkLimits(token) {
  return apiPost("/api/extension/limit-check", {}, token);
}

async function extractText(url, token) {
  return apiPost("/api/extract", { url }, token);
}

async function analyzeText(text, url, domain, token, idempotencyKey) {
  return apiPost("/api/analyze", { text, sourceUrl: url, domain }, token, idempotencyKey);
}

async function apiGet(path, token) {
  const headers = { "X-Themys-Client": "extension" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const url = `${API_BASE}${path}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) await clearAuthToken();
      const err = new Error(data.error || `API error: ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

// --- Helpers ---

function sendToTab(tabId, msg) {
  if (!tabId) return;
  console.log("[Themys bg] Sending to tab", tabId, ":", msg.type);
  chrome.tabs.sendMessage(tabId, msg).catch((err) => {
    console.error("[Themys bg] Failed to send to tab:", err.message);
  });
}

function clearScanTimeout() {
  if (scanTimeout) {
    clearTimeout(scanTimeout);
    scanTimeout = null;
  }
  activeScanTabId = null;
}

// --- Scan flow ---

function beginScan(tabId) {
  clearScanTimeout();
  activeScanTabId = tabId;
  scanTimeout = setTimeout(() => {
    console.error("[Themys bg] Scan timed out");
    sendToTab(activeScanTabId, { type: "SCAN_ERROR", error: "Scan timed out. Please try again." });
    clearScanTimeout();
  }, SCAN_TIMEOUT_MS);
}

function finishScan(tabId, scanData) {
  clearScanTimeout();
  sendToTab(tabId, { type: "SCAN_RESULT", data: scanData });
  chrome.storage.local.set({ "themys-last-scan": scanData });
}

function handleScanError(tabId, err) {
  const message = err instanceof Error ? err.message : "Unknown error";
  console.error("[Themys bg] Scan failed");
  clearScanTimeout();
  if (err.status === 402) {
    sendToTab(tabId, { type: "LIMIT_REACHED", data: err.data || { tier: "free" } });
  } else {
    sendToTab(tabId, { type: "SCAN_ERROR", error: message });
  }
}

async function handleScan(msg, sender) {
  const tabId = sender.tab?.id;
  if (!tabId) return;

  beginScan(tabId);

  try {
    const { token } = await getAuthToken();
    if (!token) {
      clearScanTimeout();
      sendToTab(tabId, { type: "AUTH_REQUIRED" });
      return;
    }
    await checkLimits(token);

    let extracted = await extractText(msg.url, token);

    if (!extracted.text || extracted.text.length < 50) {
      if (msg.textContent && msg.textContent.length > 100) {
        extracted = { text: msg.textContent, source: "fallback", wordCount: msg.textContent.split(/\s+/).length };
      } else {
        clearScanTimeout();
        const detail = extracted.text ? `${extracted.text.length} chars` : "empty response";
        sendToTab(tabId, { type: "SCAN_ERROR", error: `Could not extract text (${detail}). Try refreshing the page.` });
        return;
      }
    }

    const urlObj = new URL(msg.url);
    const domain = urlObj.hostname.replace(/^www\./, "");
    const analysis = await analyzeText(extracted.text, msg.url, domain, token, crypto.randomUUID());

    finishScan(tabId, {
      riskScore: analysis.riskScore,
      summary: analysis.summary,
      flags: analysis.flags || [],
      pushback: analysis.pushback || [],
      scanId: analysis.scanId || null,
      fullExtraction: analysis.fullExtraction || [],
      model: analysis.model,
      tier: analysis.tier,
      wordCount: extracted.wordCount,
      source: extracted.source,
    });
  } catch (err) {
    handleScanError(tabId, err);
  }
}

async function handleTextScan(msg, sender) {
  const tabId = sender.tab?.id;
  if (!tabId) return;

  beginScan(tabId);

  try {
    const { token } = await getAuthToken();
    if (!token) {
      clearScanTimeout();
      sendToTab(tabId, { type: "AUTH_REQUIRED" });
      return;
    }

    const text = typeof msg.text === "string" ? msg.text.trim() : "";
    if (!text) {
      clearScanTimeout();
      sendToTab(tabId, { type: "SCAN_ERROR", error: "Select text first." });
      return;
    }

    await checkLimits(token);

    const urlObj = new URL(msg.url);
    const domain = urlObj.hostname.replace(/^www\./, "");
    const analysis = await analyzeText(text, msg.url, domain, token, crypto.randomUUID());

    finishScan(tabId, {
      riskScore: analysis.riskScore,
      summary: analysis.summary,
      flags: analysis.flags || [],
      pushback: analysis.pushback || [],
      scanId: analysis.scanId || null,
      fullExtraction: analysis.fullExtraction || [],
      model: analysis.model,
      tier: analysis.tier,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      source: "extension",
    });
  } catch (err) {
    handleScanError(tabId, err);
  }
}

// --- Message listener ---

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "TOS_DETECTED") {
    handleScan(msg, sender)
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg.type === "SCAN_TEXT") {
    handleTextScan(msg, sender)
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg.type === "SIGN_OUT") {
    clearAuthToken()
      .then(() => sendResponse({ success: true }))
      .catch(() => sendResponse({ success: false, error: "Could not sign out" }));
    return true;
  }

  // Monitor toggle — subscribe/unsubscribe to monitoring
  if (msg.type === "MONITOR_TOGGLE") {
    getAuthToken().then(async ({ token }) => {
      if (!token) { sendResponse({ ok: false, error: "Not authenticated" }); return; }
      try {
        const method = msg.action === "unsubscribe" ? "DELETE" : "POST";
        const body = msg.action === "unsubscribe"
          ? { subscriptionId: msg.subscriptionId }
          : { url: msg.url, domain: msg.domain, title: msg.title, frequency: "weekly" };
        const resp = await fetch(`${API_BASE}/api/monitor`, {
          method,
          headers: { "Content-Type": "application/json", "X-Themys-Client": "extension", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        const data = await resp.json();
        sendResponse({ ok: resp.ok, data });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    });
    return true; // async sendResponse
  }

  // Monitor check — is this URL already monitored?
  if (msg.type === "MONITOR_CHECK") {
    getAuthToken().then(async ({ token }) => {
      if (!token) { sendResponse({ monitored: false, subscriptionId: null }); return; }
      try {
        const resp = await fetch(`${API_BASE}/api/monitor`, {
          headers: { "X-Themys-Client": "extension", Authorization: `Bearer ${token}` },
        });
        const data = await resp.json();
        const subs = data.subscriptions || [];
        const hostname = new URL(msg.url).hostname.replace(/^www\./, "");
        const match = subs.find((s) => s.url === msg.url || s.domain === hostname || s.domain === new URL(msg.url).hostname);
        sendResponse({
          monitored: Boolean(match),
          subscriptionId: match?.id ?? null,
        });
      } catch {
        sendResponse({ monitored: false, subscriptionId: null });
      }
    });
    return true;
  }

  if (msg.type === "GET_AUTH_STATUS") {
    // Reconcile with an already-authenticated web session without opening a
    // visible sign-in tab. This lets the popup adopt the web session on first use.
    getAuthToken({ refresh: true, interactive: false })
      .then(({ token }) => sendResponse({ authenticated: !!token }))
      .catch(() => sendResponse({ authenticated: false }));
    return true;
  }

  if (msg.type === "GET_LAST_SCAN") {
    chrome.storage.local.get("themys-last-scan", (result) => {
      sendResponse(result["themys-last-scan"] || null);
    });
    return true;
  }

  // Open the auth page in a new tab, remember which tab to return to
  if (msg.type === "OPEN_AUTH") {
    const openAuthTab = (returnUrl, returnTabId) => {
      chrome.tabs.create({ url: extensionAuthUrl({ returnUrl }), active: true }, (tab) => {
        authTabId = tab?.id || null;
        authReturnTabId = returnTabId || null;
      });
    };
    if (sender.tab?.id) {
      openAuthTab(msg.returnUrl || sender.tab.url || null, sender.tab.id);
      return false;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      const returnUrl = msg.returnUrl || tab?.url || null;
      openAuthTab(returnUrl, tab?.id || null);
    });
    return false;
  }

  if (msg.type === "FETCH_HISTORY") {
    getAuthToken().then(({ token }) => {
      if (!token) { sendResponse({ error: "Not authenticated" }); return; }
      apiPost("/api/scans/history", {}, token)
        .then(data => sendResponse({ scans: data.scans || [] }))
        .catch(err => sendResponse({ error: err instanceof Error ? err.message : "Failed" }));
    });
    return true;
  }

  if (msg.type === "LOAD_SCAN") {
    getAuthToken().then(({ token }) => {
      if (!token) { sendResponse({ error: "Not authenticated" }); return; }
      apiGet(`/api/scans/${encodeURIComponent(msg.scanId)}`, token)
        .then(data => sendResponse(data))
        .catch(err => sendResponse({ error: err instanceof Error ? err.message : "Failed" }));
    });
    return true;
  }

  if (msg.type === "SHOW_SCAN_IN_OVERLAY") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) sendToTab(tabs[0].id, { type: "SCAN_RESULT", data: msg.scanData });
    });
    return false;
  }

  if (msg.type === "GET_PROFILE") {
    getAuthToken().then(({ token }) => {
      if (!token) { sendResponse({ success: false, error: "Not authenticated" }); return; }
      apiGet("/api/profile", token)
        .then(data => sendResponse({ success: true, profile: data.profile }))
        .catch(err => sendResponse({ success: false, error: err instanceof Error ? err.message : "Failed" }));
    });
    return true;
  }

  if (msg.type === "UPDATE_PROFILE") {
    getAuthToken().then(({ token }) => {
      if (!token) { sendResponse({ success: false, error: "Not authenticated" }); return; }
      apiPost("/api/profile", { targetClauses: msg.targetClauses, strictMode: msg.strictMode, playbookId: msg.playbookId, country: msg.country, state: msg.state }, token)
        .then(data => sendResponse({ success: true, profile: data.profile }))
        .catch(err => sendResponse({ success: false, error: err instanceof Error ? err.message : "Failed" }));
    });
    return true;
  }

  return false;
});


// Keep service alive
chrome.alarms.create("keepalive", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "auth-expiry") {
    refreshAuthToken({ interactive: false }).catch(() => undefined);
  }
});

// Authentication messages come straight from the allowlisted Themys web
// origin. Session tokens never cross the page-wide postMessage bus.
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  let senderUrl = null;
  try { senderUrl = sender.url ? new URL(sender.url) : null; } catch { senderUrl = null; }
  const allowed = senderUrl?.origin === API_BASE && senderUrl.pathname === "/extension-auth";
  if (!allowed) return false;

  if (msg.type === "SET_AUTH_TOKEN") {
    if (typeof msg.token !== "string" || typeof msg.clerkId !== "string") return false;
    setAuthToken(msg.token, msg.clerkId).then(async () => {
      const auth = await readStoredAuth();
      if (msg.mode !== "refresh") {
        await chrome.storage.local.set({ "themys-onboarding": policy.completeOnboarding(4) });
      }
      if (authTabId && sender.tab?.id === authTabId) {
        await chrome.tabs.remove(authTabId).catch(() => undefined);
        authTabId = null;
      }
      if (authReturnTabId) {
        chrome.tabs.update(authReturnTabId, { active: true }).catch(() => undefined);
        sendToTab(authReturnTabId, { type: "AUTH_SUCCESS" });
        authReturnTabId = null;
      }
      finishRefresh?.(auth);
      sendResponse({ ok: true, expiresAt: auth.expiresAt });
    }).catch(async (error) => {
      await clearAuthToken();
      sendResponse({ ok: false, error: error instanceof Error ? error.message : "Could not persist auth token" });
    });
    return true;
  }

  if (msg.type === "AUTH_NEEDS_SIGNIN") {
    if (!refreshInteractive && authTabId) {
      chrome.tabs.remove(authTabId).catch(() => undefined);
      authTabId = null;
    } else if (authTabId) {
      chrome.tabs.update(authTabId, { active: true }).catch(() => undefined);
    } else {
      openVisibleSignIn();
    }
    finishRefresh?.({ token: null, clerkId: null, expiresAt: 0, needsSignIn: true });
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

// Reconcile the extension with an already-authenticated web session after a
// service-worker restart. This is intentionally best-effort: if the web
// session is signed out, scans will show the normal sign-in state.
readStoredAuth().then((auth) => {
  if (auth.token && auth.expiresAt <= Date.now() + AUTH_REFRESH_LEAD_MS) {
    refreshAuthToken({ interactive: false }).catch(() => undefined);
  }
}).catch(() => undefined);

// Onboarding: first install only, and never reopen after it is complete
chrome.runtime.onInstalled.addListener((details) => {
  chrome.storage.local.get("themys-onboarding", (result) => {
    const existing = result["themys-onboarding"] || null;
    if (!policy.shouldOpenOnboarding({ reason: details.reason, existing })) return;
    chrome.storage.local.set({ "themys-onboarding": { complete: false, step: 0 } });
    chrome.tabs.create({ url: chrome.runtime.getURL("onboarding/onboarding.html") });
  });
});

console.log("[Themys bg] Service worker started");
