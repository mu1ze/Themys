import assert from "node:assert/strict"
import test from "node:test"

import {
  EXTENSION_API_VERSION,
  THEMYS_SAFARI_IOS_CLIENT,
  parseExtensionExtractRequest,
  parseExtensionHistoryRequest,
  parseExtensionMonitorSubscribeRequest,
  parseExtensionMonitorUnsubscribeRequest,
  parseExtensionProfileUpdateRequest,
} from "./extension.ts"

test("extension contract accepts only documented request fields", () => {
  assert.equal(EXTENSION_API_VERSION, "2026-07-15")
  assert.equal(THEMYS_SAFARI_IOS_CLIENT, "safari-ios")
  assert.deepEqual(parseExtensionExtractRequest({ url: "https://example.com/terms" }), {
    url: "https://example.com/terms",
  })
  assert.equal(parseExtensionExtractRequest({ url: 2 }), null)
  assert.deepEqual(parseExtensionHistoryRequest({ limit: 12 }), { limit: 12 })
  assert.deepEqual(parseExtensionProfileUpdateRequest({ strictMode: true, targetClauses: ["refund", 2] }), {
    strictMode: true,
    targetClauses: ["refund"],
  })
  assert.deepEqual(parseExtensionProfileUpdateRequest({ playbookId: "saas_vendor" }), {
    playbookId: "saas_vendor",
  })
  assert.deepEqual(
    parseExtensionMonitorSubscribeRequest({ url: "https://example.com/terms", frequency: "daily" }),
    { url: "https://example.com/terms", frequency: "daily" },
  )
  assert.deepEqual(parseExtensionMonitorUnsubscribeRequest({ subscriptionId: "sub_123" }), {
    subscriptionId: "sub_123",
  })
  assert.equal(parseExtensionMonitorUnsubscribeRequest({ subscriptionId: 1 }), null)
})
