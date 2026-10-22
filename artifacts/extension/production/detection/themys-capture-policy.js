/**
 * Chrome/Safari capture product policy: auto-scan gating, onboarding once,
 * and sign-in return targets. Classic script: assigns globalThis.ThemysCapturePolicy.
 * No chrome.*, no network.
 */
(function (root) {
  "use strict";

  var DEFAULT_AUTO_SCAN_ENABLED = false;

  function isAutoScanEnabled(storedValue) {
    return storedValue === true;
  }

  function detectionAction(autoScanEnabled) {
    return autoScanEnabled ? "scan" : "badge";
  }

  function afterAuthAction(input) {
    if (input && input.pendingScan) return "resume-pending";
    return input && input.autoScanEnabled ? "detect" : "badge";
  }

  function persistOnboardingStep(existing, step) {
    if (existing && existing.complete) {
      return { complete: true, step: existing.step };
    }
    return { complete: false, step: step };
  }

  function completeOnboarding(totalSteps) {
    return { complete: true, step: Math.max(0, (totalSteps || 1) - 1) };
  }

  function shouldOpenOnboarding(input) {
    var reason = input && input.reason;
    var existing = input && input.existing;
    if (reason !== "install") return false;
    return !(existing && existing.complete);
  }

  function isHttpReturnUrl(value) {
    if (!value) return false;
    try {
      var parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  var api = {
    DEFAULT_AUTO_SCAN_ENABLED: DEFAULT_AUTO_SCAN_ENABLED,
    isAutoScanEnabled: isAutoScanEnabled,
    detectionAction: detectionAction,
    afterAuthAction: afterAuthAction,
    persistOnboardingStep: persistOnboardingStep,
    completeOnboarding: completeOnboarding,
    shouldOpenOnboarding: shouldOpenOnboarding,
    isHttpReturnUrl: isHttpReturnUrl,
  };

  root.ThemysCapturePolicy = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
