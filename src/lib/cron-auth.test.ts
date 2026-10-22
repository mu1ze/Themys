import assert from "node:assert/strict"
import test from "node:test"

import { verifyCronAuthorization } from "./cron-auth.ts"

test("cron authentication rejects missing configuration", () => {
  assert.equal(verifyCronAuthorization(new Request("https://themys.ca"), undefined), "misconfigured")
})

test("cron authentication rejects missing and invalid credentials", () => {
  assert.equal(verifyCronAuthorization(new Request("https://themys.ca"), "expected"), "unauthorized")
  assert.equal(verifyCronAuthorization(new Request("https://themys.ca", {
    headers: { Authorization: "Bearer wrong" },
  }), "expected"), "unauthorized")
})

test("cron authentication accepts the configured bearer secret", () => {
  assert.equal(verifyCronAuthorization(new Request("https://themys.ca", {
    headers: { Authorization: "Bearer expected" },
  }), "expected"), "authorized")
})

test("cron authentication accepts the dedicated header without invoking JWT middleware", () => {
  assert.equal(verifyCronAuthorization(new Request("https://themys.ca", {
    headers: { "x-cron-secret": "expected" },
  }), "expected"), "authorized")
})
