import assert from "node:assert/strict"
import test from "node:test"

import {
  isOverlayCaptureClient,
  parseThemysClientHeader,
  themysClientFromRequest,
} from "./themys-client.ts"

test("parses product clients from X-Themys-Client without treating unknown values as extension", () => {
  assert.equal(parseThemysClientHeader("extension"), "extension")
  assert.equal(parseThemysClientHeader("safari-ios"), "safari-ios")
  assert.equal(parseThemysClientHeader("SAFARI-IOS"), "safari-ios")
  assert.equal(parseThemysClientHeader("web"), "web")
  assert.equal(parseThemysClientHeader(null), "web")
  assert.equal(parseThemysClientHeader("chrome"), "web")
})

test("overlay capture includes Chrome and Safari iOS, not the web dashboard", () => {
  assert.equal(isOverlayCaptureClient("extension"), true)
  assert.equal(isOverlayCaptureClient("safari-ios"), true)
  assert.equal(isOverlayCaptureClient("web"), false)
  assert.equal(isOverlayCaptureClient("api_key"), false)
})

test("API keys stay api_key even when a product header is present", () => {
  const request = new Request("https://themys.ca/api/analyze", {
    headers: { "X-Themys-Client": "safari-ios" },
  })
  assert.equal(themysClientFromRequest(request, { apiKey: true }), "api_key")
  assert.equal(themysClientFromRequest(request), "safari-ios")
})
