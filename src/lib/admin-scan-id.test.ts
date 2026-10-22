import assert from "node:assert/strict"
import test from "node:test"

import { isAdminScanId } from "./admin-scan-id.ts"

test("admin scan ids accept only bounded hexadecimal hashes", () => {
  assert.equal(isAdminScanId("0123abcd"), true)
  assert.equal(isAdminScanId("%"), false)
  assert.equal(isAdminScanId("0123abcd%"), false)
  assert.equal(isAdminScanId("abc"), false)
})
