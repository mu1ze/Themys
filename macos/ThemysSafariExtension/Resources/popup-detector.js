/**
 * Themys Popup Detector
 * Detects ToS acceptance moments: checkboxes, inline agreements, consent modals.
 * Does NOT auto-accept — offers to scan the agreement before the user commits.
 */

(function () {
  "use strict";

  const LOG_PREFIX = "[Themys popup]";
  const DEBOUNCE_MS = 800;
  const detection = globalThis.ThemysDetection;
  const MIN_CONFIDENCE = detection ? detection.POPUP_MIN_CONFIDENCE : 5;
  const DISMISSED_KEY = "themys_popup_dismissed";
  const extApi = typeof browser !== "undefined" && browser.storage ? browser : chrome;

  // ── Cookie consent platform selectors (SKIP these) ──
  const CONSENT_SELECTORS = [
    "#onetrust-consent-sdk", "#onetrust-banner-sdk",
    "#CybotCookiebotDialog", "[id^='CybotCookiebot']",
    "#cookie-law-info-bar", ".cc-window", ".cc-banner",
    "#gdpr-cookie-notice", ".js-cookie-consent",
    "[data-cookieconsent]", "#usercentrics-root",
    "#didomi-notice", "#qc-cmp2-ui", ".osano-cm-window",
    "[class*='cookieconsent']", "[class*='cookie-banner']",
    "[class*='cookie-notice']", "[id*='cookie-law']",
    "[id*='gdpr-']", "[class*='gdpr-']",
  ];

  // ── Footer selectors (SKIP these — informational links, not agreement moments) ──
  const FOOTER_SELECTORS = [
    "footer", "[role='contentinfo']",
    "[class*='footer']", "[id*='footer']",
    "[class*='Footer']",
  ];

  // ── Terms link patterns ──
  const TERMS_HREF = detection && detection.TERMS_HREF
    ? detection.TERMS_HREF
    : /\/terms|\/tos|\/legal|\/privacy|\/policy|\/eula|\/agreement|\/conditions/i;

  // ── Agreement text patterns (flexible) ──
  const AGREEMENT_PATTERNS = [
    /by\s+(?:clicking|tapping|selecting|continuing|signing\s+up|creating|registering|proceeding|using)/i,
    /(?:i|you)\s+(?:agree|accept|consent|acknowledge)\s+to/i,
    /(?:agree|accept|consent)\s+to\s+(?:the|our|these)/i,
    /(?:terms|conditions|policy)\s+(?:of\s+)?(?:service|use|sale)/i,
  ];

  const TERMS_KEYWORDS = [
    "terms of service", "terms and conditions", "terms & conditions",
    "terms of use", "terms of sale", "privacy policy",
    "privacy notice", "user agreement", "end user license",
  ];

  // ── State ──
  const detectedElements = new WeakSet();
  const dismissedUrls = new Set();
  let observer = null;
  let debounceTimer = null;

  // ── Load dismissed URLs ──
  function loadDismissed() {
    try {
      Promise.resolve(extApi.storage.local.get(DISMISSED_KEY)).then((result) => {
        (result[DISMISSED_KEY] || []).forEach((url) => dismissedUrls.add(url));
      }).catch(() => {});
    } catch (e) {}
  }

  function dismissUrl(url) {
    dismissedUrls.add(url || "no-link");
    try {
      Promise.resolve(extApi.storage.local.get(DISMISSED_KEY)).then((result) => {
        const list = result[DISMISSED_KEY] || [];
        list.push(url || "no-link");
        if (list.length > 100) list.splice(0, list.length - 100);
        return extApi.storage.local.set({ [DISMISSED_KEY]: list });
      }).catch(() => {});
    } catch (e) {}
  }

  // ── Helpers ──
  function isInsideSelector(el, selectors) {
    let current = el;
    for (let i = 0; i < 20 && current; i++) {
      for (const sel of selectors) {
        try { if (current.matches(sel)) return true; } catch (e) {}
      }
      current = current.parentElement;
    }
    return false;
  }

  function isInsideConsentPlatform(el) {
    return isInsideSelector(el, CONSENT_SELECTORS);
  }

  function isInsideFooter(el) {
    return isInsideSelector(el, FOOTER_SELECTORS);
  }

  function getTextContent(el) {
    return (el.textContent || "").toLowerCase().trim();
  }

  function isTermsLink(href) {
    return href && TERMS_HREF.test(href);
  }

  function findTermsLink(el) {
    let current = el;
    for (let i = 0; i < 8 && current; i++) {
      const links = current.querySelectorAll("a[href]");
      for (const link of links) {
        if (isTermsLink(link.href)) return link;
      }
      current = current.parentElement;
    }
    return null;
  }

  function hasNearbyButton(el) {
    let current = el;
    for (let i = 0; i < 6 && current; i++) {
      if (current.querySelector("button, [type='submit'], input[type='submit']")) return true;
      if (current.tagName === "FORM") return true;
      current = current.parentElement;
    }
    return false;
  }

  function isAlreadyDetected(el) {
    return detectedElements.has(el);
  }

  function markDetected(el) {
    detectedElements.add(el);
  }

  // ── Scoring ──
  function scoreDetection(input) {
    if (detection && detection.scorePopupDetection) {
      return detection.scorePopupDetection(input);
    }
    return 0;
  }

  function isHighConfidenceDetection(input) {
    if (detection && detection.isHighConfidencePopupDetection) {
      return detection.isHighConfidencePopupDetection(input);
    }
    return Boolean(input.linkHref && input.hasButton) && scoreDetection(input) >= MIN_CONFIDENCE;
  }

  // ── Detection: Checkboxes ──
  function scanCheckboxes() {
    const results = [];
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');

    for (const checkbox of checkboxes) {
      if (isAlreadyDetected(checkbox)) continue;
      if (isInsideConsentPlatform(checkbox)) continue;
      if (isInsideFooter(checkbox)) continue;

      // Find label
      let label = "";
      let labelEl = null;

      if (checkbox.id) {
        labelEl = document.querySelector(`label[for="${checkbox.id}"]`);
        if (labelEl) label = getTextContent(labelEl);
      }
      if (!labelEl) {
        labelEl = checkbox.closest("label");
        if (labelEl) label = getTextContent(labelEl);
      }
      if (!label) {
        const parent = checkbox.parentElement;
        if (parent) { label = getTextContent(parent); labelEl = parent; }
      }

      // Must contain terms-related text
      const hasTerms = /terms|conditions|policy|agreement|eula/i.test(label);
      if (!hasTerms) continue;

      const link = findTermsLink(labelEl || checkbox.parentElement);
      const linkHref = link ? link.href : null;
      const hasBtn = hasNearbyButton(checkbox.parentElement);

      const score = scoreDetection({
        text: label,
        linkHref,
        hasButton: hasBtn,
        inDialog: !!checkbox.closest('[role="dialog"], .modal, [class*="modal"]'),
        isInline: false,
      });

      if (isHighConfidenceDetection({
        text: label,
        linkHref,
        hasButton: hasBtn,
        inDialog: !!checkbox.closest('[role="dialog"], .modal, [class*="modal"]'),
        isInline: false,
      })) {
        markDetected(checkbox);
        results.push({
          type: "checkbox",
          element: labelEl || checkbox.parentElement || checkbox,
          termsUrl: linkHref,
          label: label.substring(0, 200),
          score,
        });
      }
    }

    return results;
  }

  // ── Detection: Inline Agreement Text ──
  function scanInlineAgreements() {
    const results = [];

    // Walk all elements looking for agreement patterns
    const allElements = document.querySelectorAll("p, span, div, label, li, td, h1, h2, h3, h4, h5, h6");

    for (const el of allElements) {
      if (isAlreadyDetected(el)) continue;
      if (isInsideConsentPlatform(el)) continue;
      if (isInsideFooter(el)) continue;

      const text = getTextContent(el);
      if (text.length > 500) continue;  // Skip huge blocks
      if (text.length < 10) continue;   // Skip tiny fragments

      // Must match an agreement pattern
      const matchesAgreement = AGREEMENT_PATTERNS.some((p) => p.test(text));
      if (!matchesAgreement) continue;

      // Must have a terms link nearby
      const link = findTermsLink(el);
      if (!link) continue;

      const hasBtn = hasNearbyButton(el.parentElement || el);

      const score = scoreDetection({
        text,
        linkHref: link.href,
        hasButton: hasBtn,
        inDialog: !!el.closest('[role="dialog"], .modal, [class*="modal"]'),
        isInline: true,
      });

      if (isHighConfidenceDetection({
        text,
        linkHref: link.href,
        hasButton: hasBtn,
        inDialog: !!el.closest('[role="dialog"], .modal, [class*="modal"]'),
        isInline: true,
      })) {
        markDetected(el);
        results.push({
          type: "inline",
          element: el,
          termsUrl: link.href,
          label: text.substring(0, 200),
          score,
        });
      }
    }

    return results;
  }

  // ── Detection: Modals/Dialogs ──
  function scanModals() {
    const results = [];
    const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"], .modal, [class*="modal"], [class*="Modal"], [class*="dialog"], [class*="Dialog"]');

    for (const dialog of dialogs) {
      if (isAlreadyDetected(dialog)) continue;
      if (isInsideConsentPlatform(dialog)) continue;

      const text = getTextContent(dialog);
      if (text.length > 2000) continue;

      // Must contain terms/agreement language
      const hasTerms = /terms|conditions|policy|agreement/i.test(text);
      const hasAgreement = /agree|accept|consent/i.test(text);
      if (!hasTerms || !hasAgreement) continue;

      const link = findTermsLink(dialog);
      const button = dialog.querySelector("button, [type='submit']");

      const score = scoreDetection({
        text: text.substring(0, 500),
        linkHref: link?.href,
        hasButton: !!button,
        inDialog: true,
        isInline: false,
      });

      if (isHighConfidenceDetection({
        text: text.substring(0, 500),
        linkHref: link?.href,
        hasButton: !!button,
        inDialog: true,
        isInline: false,
      })) {
        markDetected(dialog);
        results.push({
          type: "modal",
          element: button || dialog,
          termsUrl: link?.href || null,
          label: text.substring(0, 200),
          score,
        });
      }
    }

    return results;
  }

  // ── Main scan ──
  function scan() {
    const results = [
      ...scanCheckboxes(),
      ...scanInlineAgreements(),
      ...scanModals(),
    ];

    for (const result of results) {
      const dismissKey = result.termsUrl || "no-link";
      if (dismissedUrls.has(dismissKey)) continue;

      console.log(LOG_PREFIX, `Detected ${result.type} (score ${result.score}):`, result.termsUrl || "(no link)", result.label.substring(0, 60));

      window.postMessage({
        type: "THEMYS_POPUP_DETECTED",
        payload: {
          detectionType: result.type,
          termsUrl: result.termsUrl,
          label: result.label,
          score: result.score,
        },
      }, "*");
    }

    return results;
  }

  function debouncedScan() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scan, DEBOUNCE_MS);
  }

  // ── Init ──
  function init() {
    if (globalThis.THEMYS_CONFIG?.appOrigin && location.origin === globalThis.THEMYS_CONFIG.appOrigin) {
      return;
    }
    loadDismissed();

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => setTimeout(scan, 1500));
    } else {
      setTimeout(scan, 1500);
    }

    observer = new MutationObserver(debouncedScan);
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("message", (event) => {
      if (event.data?.type === "THEMYS_POPUP_DISMISS") {
        dismissUrl(event.data.payload?.termsUrl);
      }
    });

    console.log(LOG_PREFIX, "Initialized");
  }

  init();
})();
