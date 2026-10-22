const ext = typeof browser !== "undefined" ? browser : chrome;
const API_BASE = globalThis.THEMYS_CONFIG?.appOrigin || "https://themys.ca";
const CLIENT = "safari-ios";
const NATIVE_APPLICATION_ID = "ca.themys.app";
const SCAN_TIMEOUT_MS = 60000;

function tokenExpiresAt(token) {
  try {
    let payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = (4 - (payload.length % 4)) % 4;
    payload += "=".repeat(pad);
    return Number(JSON.parse(atob(payload)).exp || 0) * 1000;
  } catch {
    return 0;
  }
}

function unwrapNativeResponse(response) {
  if (!response || typeof response !== "object") return {};
  if (response.message && typeof response.message === "object" && !("type" in response)) {
    return response.message;
  }
  return response;
}

async function nativeMessage(payload) {
  if (!ext.runtime.sendNativeMessage) return {};
  try {
    return unwrapNativeResponse(await ext.runtime.sendNativeMessage(NATIVE_APPLICATION_ID, payload));
  } catch (error) {
    console.error("[Themys Safari] native message failed");
    return { error: error && error.message ? error.message : "native_failed" };
  }
}

async function getSession() {
  const native = await nativeMessage({ type: "GET_SESSION" });
  if (native.error || native.ok === false) throw new Error("Could not refresh your session. Try again.");
  const token = typeof native?.token === "string" ? native.token : null;
  const expiresAt = tokenExpiresAt(token || "");
  if (!token || expiresAt <= Date.now()) return { token: null };
  return { token };
}

async function apiPost(path, body, token, idempotencyKey) {
  const headers = {
    "Content-Type": "application/json",
    "X-Themys-Client": CLIENT,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
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

async function sendToTab(tabId, message) {
  if (tabId == null) return;
  try {
    await ext.tabs.sendMessage(tabId, message);
  } catch (_) {}
}

ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  if (msg?.type === "SCAN_PAGE" || msg?.type === "TOS_DETECTED" || msg?.type === "SCAN_TEXT") {
    const url = msg.url || sender.tab?.url;
    const text = msg.text || msg.textContent || "";
    const domain = msg.domain || (url ? new URL(url).hostname : "");
    ;(async () => {
      try {
        const { token } = await getSession();
        if (!token) {
          await sendToTab(tabId, { type: "AUTH_REQUIRED" });
          return;
        }
        const limits = await apiPost("/api/extension/limit-check", {}, token);
        if (limits.upgradeRequired || limits.ok === false) {
          await sendToTab(tabId, { type: "LIMIT_REACHED", data: limits.usage || limits });
          return;
        }
        const idempotencyKey = crypto.randomUUID();
        const payload = text
          ? { text, sourceUrl: url, domain }
          : { url };
        const data = await apiPost("/api/analyze", payload, token, idempotencyKey);
        await sendToTab(tabId, { type: "SCAN_RESULT", data });
      } catch (error) {
        if (error.status === 401) {
          await sendToTab(tabId, { type: "AUTH_REQUIRED" });
          return;
        }
        if (error.status === 402) {
          await sendToTab(tabId, { type: "LIMIT_REACHED", data: error.data || {} });
          return;
        }
        await sendToTab(tabId, { type: "SCAN_ERROR", error: error.message || "Scan failed" });
      }
    })();
    sendResponse({ ok: true });
    return true;
  }

  if (msg?.type === "GET_PREFS") {
    nativeMessage({ type: "GET_PREFS" }).then((prefs) => sendResponse(prefs || { autoDetectEnabled: true }));
    return true;
  }

  return undefined;
});
