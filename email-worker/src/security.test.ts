import assert from "node:assert/strict"
import test from "node:test"
import { isSafeEmail, safeHeader } from "./security.ts"

test("safe email validation accepts normal addresses and rejects header injection", () => {
  assert.equal(isSafeEmail("person@example.com"), true)
  assert.equal(isSafeEmail("person@example.com\nBcc: attacker@example.com"), false)
  assert.equal(isSafeEmail("not-an-email"), false)
})

test("safe headers strip line breaks and enforce length", () => {
  assert.equal(safeHeader(" Subject\r\nBcc: attacker@example.com "), "Subject  Bcc: attacker@example.com")
  assert.equal(safeHeader("x".repeat(301)), null)
})
