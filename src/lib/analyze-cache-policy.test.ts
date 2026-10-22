import assert from "node:assert/strict"
import test from "node:test"

import { shouldUsePublicScanCache } from "./contract-upload.ts"

test("analyze cache policy skips public KV for private paste and upload sources", () => {
  assert.equal(shouldUsePublicScanCache("paste"), false)
  assert.equal(shouldUsePublicScanCache("upload"), false)
  assert.equal(shouldUsePublicScanCache("extension"), false)
})

test("analyze cache policy allows public KV for web URL scans only", () => {
  assert.equal(shouldUsePublicScanCache("web"), true)
})
