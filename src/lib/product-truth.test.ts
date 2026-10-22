import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

const root = process.cwd()

test("landing pages do not publish unsupported statistics", async () => {
  const [primary, alternate, features] = await Promise.all([
    readFile(join(root, "src/app/page.tsx"), "utf8"),
    readFile(join(root, "src/app/landing-v2/page.tsx"), "utf8"),
    readFile(join(root, "src/app/features/page.tsx"), "utf8"),
  ])

  for (const source of [primary, alternate, features]) {
    assert.doesNotMatch(source, /97%|18 min|70\+/)
    assert.doesNotMatch(source, /users accept ToS without reading|average time to read a single ToS|clauses hidden in typical agreements/)
    assert.match(source, /NEXT_PUBLIC_CHROME_STORE_URL/)
    assert.doesNotMatch(source, /chrome\.google\.com\/webstore|chromewebstore\.google\.com/)
  }
})

test("features page describes the app surfaces without overclaiming", async () => {
  const features = await readFile(join(root, "src/app/features/page.tsx"), "utf8")

  // The page exists to describe the Clerk-protected surfaces in public prose.
  for (const surface of ["Dashboard", "Monitoring", "History", "Settings", "Developer API"]) {
    assert.match(features, new RegExp(surface))
  }

  // Availability stays honest: extension gated behind the store URL env var,
  // API marked experimental, and the legal-advice disclaimer kept.
  assert.match(features, /coming soon/)
  assert.match(features, /experimental/i)
  assert.match(features, /not legal advice/)
})

test("production smoke expects the live homepage heading", async () => {
  const [landing, smoke] = await Promise.all([
    readFile(join(root, "src/components/landing/marketing.tsx"), "utf8"),
    readFile(join(root, "e2e/production-smoke.spec.ts"), "utf8"),
  ])
  assert.match(landing, /All your fine print, <em>one clear briefing<\/em>\./)
  assert.match(
    smoke,
    /path: "\/", heading: "All your fine print, one clear briefing\."/,
  )
})

test("pricing does not publish unsupported social proof", async () => {
  const pricing = await readFile(join(root, "src/app/pricing/pricing-content.tsx"), "utf8")
  assert.doesNotMatch(pricing, /Trusted by|userCount/)
})

test("legal disclosure names the active processing surfaces and required links", async () => {
  const legal = await readFile(join(root, "docs/src/app/legal/page.tsx"), "utf8")
  assert.match(legal, /Clerk/)
  assert.match(legal, /Cloudflare D1/)
  assert.match(legal, /Cloudflare R2/)
  assert.match(legal, /Stripe/)
  assert.match(legal, /TypeSafe AI/)
  assert.match(legal, /OpenRouter/)
  assert.match(legal, /Jina Reader/)
  assert.match(legal, /ToS;DR/)
  assert.match(legal, /Google favicon service/)
  assert.match(legal, /Cloudflare/)
  assert.match(legal, /Sentry/)
  assert.match(legal, /seven-day TTL/)
  assert.match(legal, /thirty-day TTL/)
  assert.match(legal, /zero-data-retention \(ZDR\) routing for OpenRouter requests/)
  assert.match(legal, /This OpenRouter routing setting does not apply to TypeSafe AI/)
  assert.doesNotMatch(legal, /Google Gemini is also configured as a fallback/)
  assert.match(legal, /qualified counsel/)
})
