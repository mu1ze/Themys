import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

const root = process.cwd()

test("production server logs do not include document bodies or customer identifiers", async () => {
  const [llm, monitoring, stripe, account, checkout, admin, settings, pricing, developerKeys] = await Promise.all([
    readFile(join(root, "src/lib/llm.ts"), "utf8"),
    readFile(join(root, "src/lib/monitoring-job.ts"), "utf8"),
    readFile(join(root, "src/app/api/webhooks/stripe/route.ts"), "utf8"),
    readFile(join(root, "src/app/actions/account.ts"), "utf8"),
    readFile(join(root, "src/app/actions/checkout.ts"), "utf8"),
    readFile(join(root, "src/lib/admin-queries.ts"), "utf8"),
    readFile(join(root, "src/app/settings/page.tsx"), "utf8"),
    readFile(join(root, "src/app/pricing/page.tsx"), "utf8"),
    readFile(join(root, "src/app/api/developer/keys/route.ts"), "utf8"),
  ])

  assert.doesNotMatch(llm, /\[JSON Parse Error\] (?:Raw|Repaired) text/)
  assert.doesNotMatch(monitoring, /console\.(?:log|warn|error)[^\n]*sub\.id/)
  assert.doesNotMatch(
    stripe,
    /console\.(?:log|warn|error)[^\n]*(?:event\.id|session\.(?:customer|metadata)|customerId|paymentId|clerk_id)/,
  )
  assert.doesNotMatch(account, /console\.(?:log|warn|error)\([^\n]*,\s*err\s*\)/)
  assert.doesNotMatch(checkout, /console\.(?:log|warn|error)\([^\n]*,\s*error\s*\)/)
  assert.doesNotMatch(checkout, /error\.message\s*\?\s*error\.message/)
  assert.doesNotMatch(admin, /console\.(?:log|warn|error)[^\n]*scanId/)
  assert.doesNotMatch(settings, /console\.(?:log|warn|error)\([^\n]*,\s*(?:error|e)\s*\)/)
  assert.doesNotMatch(pricing, /console\.(?:log|warn|error)\([^\n]*priceResult\.reason\s*\)/)
  assert.doesNotMatch(developerKeys, /NextResponse\.json\(\{ error: message \}, \{ status: 500 \}\)/)
})
