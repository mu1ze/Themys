import assert from "node:assert/strict"
import test from "node:test"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const policy = require("./themys-capture-policy.js")

test("auto-scan is off unless the stored value is exactly true", () => {
  assert.equal(policy.DEFAULT_AUTO_SCAN_ENABLED, false)
  assert.equal(policy.isAutoScanEnabled(undefined), false)
  assert.equal(policy.isAutoScanEnabled(null), false)
  assert.equal(policy.isAutoScanEnabled(false), false)
  assert.equal(policy.isAutoScanEnabled(true), true)
})

test("a detection signal scans only when auto-scan is on", () => {
  assert.equal(policy.detectionAction(false), "badge")
  assert.equal(policy.detectionAction(true), "scan")
})

test("after sign-in, a pending scan resumes and otherwise does not auto-scan", () => {
  assert.equal(
    policy.afterAuthAction({ pendingScan: { url: "https://example.com/terms" }, autoScanEnabled: false }),
    "resume-pending",
  )
  assert.equal(policy.afterAuthAction({ pendingScan: null, autoScanEnabled: false }), "badge")
  assert.equal(policy.afterAuthAction({ pendingScan: null, autoScanEnabled: true }), "detect")
})

test("onboarding step changes never un-complete a finished wizard", () => {
  assert.deepEqual(policy.persistOnboardingStep({ complete: true, step: 3 }, 1), {
    complete: true,
    step: 3,
  })
  assert.deepEqual(policy.persistOnboardingStep({ complete: false, step: 0 }, 1), {
    complete: false,
    step: 1,
  })
})

test("signing in completes onboarding so later sessions skip the wizard", () => {
  assert.deepEqual(policy.completeOnboarding(4), { complete: true, step: 3 })
})

test("first install opens onboarding only when it is not already complete", () => {
  assert.equal(policy.shouldOpenOnboarding({ reason: "install", existing: null }), true)
  assert.equal(
    policy.shouldOpenOnboarding({ reason: "install", existing: { complete: true, step: 3 } }),
    false,
  )
  assert.equal(policy.shouldOpenOnboarding({ reason: "update", existing: null }), false)
})

test("only http(s) page URLs are valid auth return targets", () => {
  assert.equal(policy.isHttpReturnUrl("https://example.com/terms"), true)
  assert.equal(policy.isHttpReturnUrl("http://localhost:3000/privacy"), true)
  assert.equal(policy.isHttpReturnUrl("chrome-extension://abc/onboarding.html"), false)
  assert.equal(policy.isHttpReturnUrl("themys://sign-in"), false)
  assert.equal(policy.isHttpReturnUrl(null), false)
})
