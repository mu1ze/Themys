import assert from "node:assert/strict"
import test from "node:test"

import {
  assertContractUploadAllowed,
  shouldUsePublicScanCache,
} from "./contract-upload.ts"

test("shouldUsePublicScanCache is true only for web URL scans", () => {
  assert.equal(shouldUsePublicScanCache("web"), true)
  assert.equal(shouldUsePublicScanCache("paste"), false)
  assert.equal(shouldUsePublicScanCache("extension"), false)
  assert.equal(shouldUsePublicScanCache("upload"), false)
})

test("assertContractUploadAllowed allows Free users with no prior contract uploads", () => {
  assert.deepEqual(assertContractUploadAllowed("free", 0), { ok: true })
})

test("assertContractUploadAllowed denies Free users after the one-time trial", () => {
  assert.deepEqual(assertContractUploadAllowed("free", 1), {
    ok: false,
    code: "upgrade_founder",
  })
})

test("assertContractUploadAllowed always denies Personal", () => {
  assert.deepEqual(assertContractUploadAllowed("base", 0), {
    ok: false,
    code: "upgrade_founder",
  })
})

test("assertContractUploadAllowed always allows Founder and Lifetime", () => {
  assert.deepEqual(assertContractUploadAllowed("advanced", 0), { ok: true })
  assert.deepEqual(assertContractUploadAllowed("advanced", 99), { ok: true })
  assert.deepEqual(assertContractUploadAllowed("lifetime", 0), { ok: true })
})
