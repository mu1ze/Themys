import assert from "node:assert/strict"
import test from "node:test"

import { buildSecurityHeaders } from "./security-headers.ts"

function getDirectiveSources(policy: string, directive: string): string[] {
  const matchingDirective = policy
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${directive} `))

  return matchingDirective?.split(/\s+/).slice(1) ?? []
}

test("production security headers are enforced on every response", () => {
  const headers = new Map(buildSecurityHeaders(false).map(({ key, value }) => [key, value]))
  const contentSecurityPolicy = headers.get("Content-Security-Policy") ?? ""
  const scriptSources = getDirectiveSources(contentSecurityPolicy, "script-src")

  assert.match(contentSecurityPolicy, /frame-ancestors 'none'/)
  assert.match(contentSecurityPolicy, /upgrade-insecure-requests/)
  assert.match(contentSecurityPolicy, /https:\/\/\*\.ingest\.us\.sentry\.io/)
  assert.match(contentSecurityPolicy, /https:\/\/static\.cloudflareinsights\.com/)
  assert.match(contentSecurityPolicy, /https:\/\/cloudflareinsights\.com/)
  assert.match(
    contentSecurityPolicy,
    /img-src[^;]*https:\/\/\*\.gstatic\.com/,
  )
  assert.match(
    contentSecurityPolicy,
    /script-src[^;]*https:\/\/challenges\.cloudflare\.com/,
  )
  assert.doesNotMatch(contentSecurityPolicy, /analytics-collect\.motorz\.dev/)
  assert.match(
    contentSecurityPolicy,
    /frame-src[^;]*https:\/\/challenges\.cloudflare\.com/,
  )
  assert.ok(scriptSources.includes("'wasm-unsafe-eval'"))
  assert.equal(scriptSources.includes("'unsafe-eval'"), false)
  assert.equal(headers.get("X-Frame-Options"), "DENY")
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff")
  assert.ok(headers.has("Strict-Transport-Security"))
})

test("development keeps production protections without HSTS", () => {
  const headers = new Map(buildSecurityHeaders(true).map(({ key, value }) => [key, value]))
  const contentSecurityPolicy = headers.get("Content-Security-Policy") ?? ""
  const scriptSources = getDirectiveSources(contentSecurityPolicy, "script-src")

  assert.match(contentSecurityPolicy, /frame-ancestors 'none'/)
  assert.ok(scriptSources.includes("'wasm-unsafe-eval'"))
  assert.ok(scriptSources.includes("'unsafe-eval'"))
  assert.equal(headers.has("Strict-Transport-Security"), false)
})
