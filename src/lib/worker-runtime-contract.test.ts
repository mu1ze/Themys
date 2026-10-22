import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const root = process.cwd()

test("URL scans use Cloudflare public egress instead of Worker DNS subrequests", async () => {
  const [wranglerConfig, urlSecurity] = await Promise.all([
    readFile(join(root, "wrangler.jsonc"), "utf8"),
    readFile(join(root, "src/lib/url-security.ts"), "utf8"),
  ])

  assert.match(wranglerConfig, /["']global_fetch_strictly_public["']/)
  assert.doesNotMatch(urlSecurity, /^\s*import[^\n]*["']node:dns/m)
})

test("monitoring email uses a private Worker service binding", async () => {
  const [wranglerConfig, emailConfig, deliveryClient] = await Promise.all([
    readFile(join(root, "wrangler.jsonc"), "utf8"),
    readFile(join(root, "email-worker/wrangler.jsonc"), "utf8"),
    readFile(join(root, "src/lib/monitoring-email.ts"), "utf8"),
  ])

  assert.match(wranglerConfig, /"binding": "MONITORING_EMAIL_WORKER"/)
  assert.match(wranglerConfig, /"service": "themys-monitoring-email"/)
  assert.match(emailConfig, /"workers_dev": false/)
  assert.doesNotMatch(deliveryClient, /MONITORING_EMAIL_WORKER_URL|MONITORING_EMAIL_WORKER_SECRET/)
})

test("production error reporting uses the Cloudflare SDK at the Worker boundary", async () => {
  const [workerEntry, instrumentation, nextConfig] = await Promise.all([
    readFile(join(root, "custom-worker.ts"), "utf8"),
    readFile(join(root, "src/instrumentation.ts"), "utf8"),
    readFile(join(root, "next.config.ts"), "utf8"),
  ])

  assert.match(workerEntry, /from ["']@sentry\/cloudflare["']/)
  assert.match(workerEntry, /Sentry\.withSentry/)
  assert.match(workerEntry, /skipOpenTelemetrySetup:\s*true/)
  assert.doesNotMatch(instrumentation, /sentry\.server\.config/)
  assert.doesNotMatch(instrumentation, /@sentry\/nextjs/)
  assert.doesNotMatch(instrumentation, /sentry\.edge\.config/)
  assert.match(instrumentation, /await import\(["']@sentry\/cloudflare["']\)/)
  assert.doesNotMatch(nextConfig, /from ["']@sentry\/nextjs["']/)
  assert.doesNotMatch(nextConfig, /withSentryConfig\s*\(/)
})

test("client error reporting does not pull the Next.js build SDK into the Worker", async () => {
  const clientSources = await Promise.all([
    "src/instrumentation-client.ts",
    "src/app/global-error.tsx",
    "src/app/pricing/error.tsx",
    "src/app/scan/results/error.tsx",
  ].map((path) => readFile(join(root, path), "utf8")))

  for (const source of clientSources) {
    assert.doesNotMatch(source, /@sentry\/nextjs/)
  }
  assert.match(clientSources[0], /from ["']@sentry\/browser["']/)
})
