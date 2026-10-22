import assert from "node:assert/strict"
import test from "node:test"

import { CANONICAL_PRODUCTION_ORIGIN, getAppOrigin } from "./app-origin.ts"

test("production requires an explicit HTTPS application origin", () => {
  assert.throws(() => getAppOrigin({ NODE_ENV: "production" }), /APP_URL is required/)
  assert.throws(
    () => getAppOrigin({ NODE_ENV: "production", APP_URL: "http://localhost:3000" }),
    /HTTPS|loopback/,
  )
  assert.equal(
    getAppOrigin({ NODE_ENV: "production", APP_URL: CANONICAL_PRODUCTION_ORIGIN }),
    CANONICAL_PRODUCTION_ORIGIN,
  )
})

test("preview origins are configurable without source changes", () => {
  assert.equal(
    getAppOrigin({ NODE_ENV: "production", APP_URL: "https://preview-123.themys.workers.dev/" }),
    "https://preview-123.themys.workers.dev",
  )
})

test("development keeps a safe local default", () => {
  assert.equal(getAppOrigin({ NODE_ENV: "development" }), "http://localhost:3000")
})
