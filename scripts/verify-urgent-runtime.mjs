import "dotenv/config"
import assert from "node:assert/strict"
import { createHash, randomBytes } from "node:crypto"
import { createCloudflareD1AdminClient } from "./lib/cloudflare-admin.mjs"

const baseUrl = (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "")
const expectCronConfigured = process.env.EXPECT_CRON_CONFIGURED === "1"
const database = createCloudflareD1AdminClient()
const marker = randomBytes(8).toString("hex")
const clerkId = `user_runtime_${marker}`
const rawKey = `tmys_${randomBytes(32).toString("base64url")}`
const rawExtractKey = `tmys_${randomBytes(32).toString("base64url")}`
let userId
let apiKeyIds = []

function hashKey(raw) { return createHash("sha256").update(raw).digest("hex") }
async function call(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, init)
  const body = await response.json().catch(() => ({}))
  return { response, body }
}

try {
  const userInsert = await database.from("users").insert({
    clerk_id: clerkId,
    email: `${marker}@example.invalid`,
    plan: "advanced",
  }).select("id").single()
  if (userInsert.error) throw userInsert.error
  userId = userInsert.data.id
  const keyInsert = await database.from("api_keys").insert([
    { user_id: userId, key_hash: hashKey(rawKey), key_prefix: rawKey.slice(0, 12), name: "Runtime verification", scopes: ["extract", "analyze"] },
    { user_id: userId, key_hash: hashKey(rawExtractKey), key_prefix: rawExtractKey.slice(0, 12), name: "Scope verification", scopes: ["extract"] },
  ]).select("id")
  if (keyInsert.error) throw keyInsert.error
  apiKeyIds = keyInsert.data.map((row) => row.id)

  const anonymous = await call("/api/analyze/batch", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: [{ url: "http://127.0.0.1/private" }] }),
  })
  assert.equal(anonymous.response.status, 401)

  const scopeDenied = await call("/api/analyze/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${rawExtractKey}` },
    body: JSON.stringify({ items: [{ text: "Terms apply." }] }),
  })
  assert.equal(scopeDenied.response.status, 403, JSON.stringify(scopeDenied.body))

  const termsText = "These terms require binding arbitration, permit account termination, limit liability, and allow policy changes with notice. ".repeat(8)
  let mixed
  for (const [candidateIndex, candidateUrl] of [
    "https://example.com",
    "https://www.cloudflare.com/website-terms/",
  ].entries()) {
    mixed = await call("/api/analyze/batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${rawKey}`,
        "Idempotency-Key": `mixed-${marker}-${candidateIndex}`,
      },
      body: JSON.stringify({ items: [{ text: termsText, domain: "example.org" }, { url: candidateUrl }] }),
    })
    if (mixed.body.summary?.succeeded === 2) break
  }
  assert.equal(mixed.response.status, 200)
  assert.equal(mixed.body.summary.total, 2)
  assert.equal(mixed.body.summary.succeeded, 2)

  const partial = await call("/api/analyze/batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${rawKey}`,
      "Idempotency-Key": `partial-${marker}`,
    },
    body: JSON.stringify({ items: [{ text: termsText }, { url: "http://127.0.0.1/private" }] }),
  })
  assert.equal(partial.response.status, 200)
  assert.equal(partial.body.summary.succeeded, 1)
  assert.equal(partial.body.results[1].status, 400)

  const idempotentHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${rawKey}`,
    "Idempotency-Key": `single-${marker}`,
  }
  const first = await call("/api/analyze", {
    method: "POST", headers: idempotentHeaders,
    body: JSON.stringify({ text: termsText, domain: "example.org" }),
  })
  const second = await call("/api/analyze", {
    method: "POST", headers: idempotentHeaders,
    body: JSON.stringify({ text: termsText, domain: "example.org" }),
  })
  assert.equal(first.response.status, 200)
  assert.equal(second.response.status, 200)
  assert.equal(second.body.usage.scans.remaining, first.body.usage.scans.remaining)

  const monitorAnonymous = await call("/api/monitor")
  assert.equal(monitorAnonymous.response.status, 401)
  const cronAnonymous = await call("/api/monitor/check", { method: "POST" })
  if (expectCronConfigured) {
    assert.equal(cronAnonymous.response.status, 401)
    assert.equal(cronAnonymous.body.error, "Unauthorized")
  } else {
    assert.equal(cronAnonymous.response.status, 500)
    assert.equal(cronAnonymous.body.error, "CRON_SECRET not configured")
  }
  const monitorApiKey = await call("/api/monitor", { headers: { Authorization: `Bearer ${rawKey}` } })
  assert.equal(monitorApiKey.response.status, 401)

  const usage = await database.from("api_keys").select("request_count").eq("key_hash", hashKey(rawKey)).single()
  assert.equal(usage.error, null)
  assert.ok(Number(usage.data.request_count) >= 4)

  const actor = `${clerkId}:${apiKeyIds[0]}`
  const actorHash = createHash("sha256").update(actor).digest("hex")
  const eventResult = await database
    .from("usage_events")
    .select("outcome, scan_slots, ai_slots, credits")
    .eq("actor_hash", actorHash)
  assert.equal(eventResult.error, null)
  const events = eventResult.data ?? []
  const scanSlots = events.reduce((sum, event) => sum + Number(event.scan_slots), 0)
  const aiSlots = events.reduce((sum, event) => sum + Number(event.ai_slots), 0)
  assert.ok(events.some((event) => event.outcome === "idempotent_replay"))
  assert.equal(events.reduce((sum, event) => sum + Number(event.credits), 0), 0)

  const now = new Date()
  // Both scans and AI use monthly windows in the application rate-limit policy.
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
  const [scanCounter, aiCounter] = await Promise.all([
    database.rpc("get_api_rate_limit_status", { p_bucket_key: `rl:apikey:${actor}:scans:${month}` }),
    database.rpc("get_api_rate_limit_status", { p_bucket_key: `rl:apikey:${actor}:ai:${month}` }),
  ])
  assert.equal(scanCounter.error, null)
  assert.equal(aiCounter.error, null)
  assert.equal(scanCounter.data[0].current_count, scanSlots, "scan events must reconcile to the counter")
  assert.equal(aiCounter.data[0].current_count, aiSlots, "AI events must reconcile to the counter")
  console.log(`Urgent runtime verified against ${baseUrl}: auth-first batch, scope denial, mixed URL/text, partial failure, idempotency, monitoring auth, and usage-event reconciliation`)
} finally {
  if (userId) await database.from("users").delete().eq("id", userId)
  const limits = await database.from("api_rate_limits").select("bucket_key").like("bucket_key", `%${clerkId}%`)
  for (const row of limits.data ?? []) {
    await database.from("usage_reservations").delete().eq("bucket_key", row.bucket_key)
    await database.from("api_rate_limits").delete().eq("bucket_key", row.bucket_key)
  }
  for (const keyId of apiKeyIds) {
    const actorHash = createHash("sha256").update(`${clerkId}:${keyId}`).digest("hex")
    await database.from("usage_events").delete().eq("actor_hash", actorHash)
  }
}
