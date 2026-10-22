// Auth page for Themys extension
// This page is a fallback. The primary flow is:
// 1. User clicks "Sign in" in the overlay → content sends OPEN_AUTH → background opens extension-auth tab
// 2. User signs in on the web page → page messages the extension service worker directly
//
// This page exists for the extension popup's sign-in button as a fallback.

const API_BASE = globalThis.THEMYS_CONFIG.appOrigin;

document.addEventListener("DOMContentLoaded", () => {
  const signInBtn = document.getElementById("sign-in-btn");
  const statusEl = document.getElementById("status");

  function showStatus(text, type) {
    statusEl.textContent = text;
    statusEl.className = "status " + type;
  }

  signInBtn.addEventListener("click", () => {
    signInBtn.disabled = true;
    signInBtn.textContent = "Opening sign-in...";

    // Navigate this tab directly to the auth page
    window.location.href = `${API_BASE}/extension-auth?extension_id=${encodeURIComponent(chrome.runtime.id)}`;
  });

  // Check if already authenticated
  chrome.runtime.sendMessage({ type: "GET_AUTH_STATUS" }, (response) => {
    if (response && response.authenticated) {
      signInBtn.textContent = "Already signed in";
      signInBtn.disabled = true;
      showStatus("You are already authenticated.", "success");
    }
  });
});

// Listen for auth success from background (in case user signs in via another tab)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "AUTH_SUCCESS") {
    const signInBtn = document.getElementById("sign-in-btn");
    const statusEl = document.getElementById("status");
    if (signInBtn) {
      signInBtn.textContent = "Signed in";
      signInBtn.disabled = true;
    }
    if (statusEl) {
      statusEl.textContent = "Signed in successfully!";
      statusEl.className = "status success";
    }
  }
});
