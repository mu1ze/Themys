import crypto from "node:crypto"

import { createCloudflareD1AdminClient } from "./lib/cloudflare-admin.mjs"

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
const cronSecret = process.env.CRON_SECRET
const triggerScheduled = process.env.TRIGGER_SCHEDULED === "1"

if (!cronSecret) throw new Error("CRON_SECRET is required")

const database = createCloudflareD1AdminClient()
const marker = crypto.randomUUID()
const clerkId = `user_cron_e2e_${marker}`
const url = `https://www.cloudflare.com/website-terms/?themys-cron-e2e=${marker}`
let userId

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

try {
  const missing = await fetch(`${baseUrl}/api/monitor/check`, { method: "POST" })
  assert(missing.status === 401, `Missing cron secret returned ${missing.status}`)
  const invalid = await fetch(`${baseUrl}/api/monitor/check`, {
    method: "POST",
    headers: { Authorization: "Bearer invalid-local-verification-secret" },
  })
  assert(invalid.status === 401, `Invalid cron secret returned ${invalid.status}`)

  const { data: dueRows, error: dueError } = await database
    .from("monitoring_subscriptions")
    .select("id, frequency, last_checked_at")
    .eq("is_active", true)
    .limit(101)
  if (dueError) throw dueError
  const now = Date.now()
  const intervals = { daily: 86_400_000, weekly: 604_800_000, monthly: 2_592_000_000 }
  const existingDue = (dueRows ?? []).filter((row) => {
    if (!row.last_checked_at) return true
    return now - new Date(row.last_checked_at).getTime() >= (intervals[row.frequency] ?? intervals.weekly)
  })
  assert(existingDue.length === 0, "Refusing controlled cron run because real due subscriptions exist")

  const { data: user, error: userError } = await database
    .from("users")
    .insert({
      clerk_id: clerkId,
      email: `cron-e2e-${marker}@themys.invalid`,
      plan: "free",
    })
    .select("id")
    .single()
  if (userError) throw userError
  userId = user.id

  const { data: subscription, error: subscriptionError } = await database
    .from("monitoring_subscriptions")
    .insert({
      user_id: userId,
      url,
      domain: "www.cloudflare.com",
      title: "Controlled cron verification",
      frequency: "daily",
    })
    .select("id")
    .single()
  if (subscriptionError) throw subscriptionError

  const trigger = () => triggerScheduled
    ? fetch(`${baseUrl}/cdn-cgi/handler/scheduled`)
    : fetch(`${baseUrl}/api/monitor/check`, {
        method: "POST",
        headers: { "x-cron-secret": cronSecret },
      })

  const response = await trigger()
  assert(response.status === 200, `Cron trigger returned ${response.status}`)
  if (!triggerScheduled) {
    const result = await response.json()
    assert(result.checked === 1, `Expected one checked subscription, got ${result.checked}`)
    assert(result.changed === 0, `Expected a baseline without a change, got ${result.changed}`)
    assert(result.alerted === 0, `Expected no baseline alert, got ${result.alerted}`)
  }

  if (triggerScheduled) {
    const deadline = Date.now() + 30_000
    while (Date.now() < deadline) {
      const { data } = await database
        .from("monitoring_subscriptions")
        .select("last_checked_at")
        .eq("id", subscription.id)
        .single()
      if (data?.last_checked_at) break
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }

  const [{ data: updated, error: updatedError }, { data: snapshots, error: snapshotError }] = await Promise.all([
    database
      .from("monitoring_subscriptions")
      .select("last_checked_at")
      .eq("id", subscription.id)
      .single(),
    database
      .from("tos_snapshots")
      .select("id, text_hash, word_count")
      .eq("url", url),
  ])
  if (updatedError) throw updatedError
  if (snapshotError) throw snapshotError
  assert(Boolean(updated.last_checked_at), "Cron did not update last_checked_at")
  assert(snapshots?.length === 1, `Expected one baseline snapshot, got ${snapshots?.length ?? 0}`)
  assert(Boolean(snapshots[0].text_hash), "Baseline snapshot is missing its text hash")
  assert((snapshots[0].word_count ?? 0) > 0, "Baseline snapshot has no extracted words")

  const forcedHash = `forced-change-${marker}`
  const [{ error: hashError }, { error: dueAgainError }] = await Promise.all([
    database.from("tos_snapshots").update({ text_hash: forcedHash }).eq("id", snapshots[0].id),
    database.from("monitoring_subscriptions").update({ last_checked_at: null }).eq("id", subscription.id),
  ])
  if (hashError) throw hashError
  if (dueAgainError) throw dueAgainError

  const changedResponse = await trigger()
  assert(changedResponse.status === 200, `Changed cron trigger returned ${changedResponse.status}`)
  if (!triggerScheduled) {
    const result = await changedResponse.json()
    assert(result.checked === 1, `Expected one changed subscription check, got ${result.checked}`)
    assert(result.changed === 1, `Expected one detected change, got ${result.changed}`)
    assert(result.alerted === 1, `Expected one created alert, got ${result.alerted}`)
  }

  const changeDeadline = Date.now() + 120_000
  let changedSnapshots = []
  let alerts = []
  while (Date.now() < changeDeadline) {
    const [snapshotResult, alertResult] = await Promise.all([
      database
        .from("tos_snapshots")
        .select("id, text_hash, risk_score, clause_count")
        .eq("subscription_id", subscription.id),
      database
        .from("monitoring_alerts")
        .select("id, old_snapshot_id, new_snapshot_id, email_status")
        .eq("subscription_id", subscription.id),
    ])
    if (snapshotResult.error) throw snapshotResult.error
    if (alertResult.error) throw alertResult.error
    changedSnapshots = snapshotResult.data ?? []
    alerts = alertResult.data ?? []
    if (changedSnapshots.length === 2 && alerts.length === 1) break
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  assert(changedSnapshots.length === 2, `Expected baseline and changed snapshots, got ${changedSnapshots.length}`)
  assert(alerts.length === 1, `Expected one monitoring alert, got ${alerts.length}`)
  assert(alerts[0].old_snapshot_id === snapshots[0].id, "Alert does not reference the baseline snapshot")
  assert(alerts[0].new_snapshot_id !== snapshots[0].id, "Alert does not reference the changed snapshot")
  assert(alerts[0].email_status === "disabled", `Expected free-plan email to be disabled, got ${alerts[0].email_status}`)

  console.log(
    `Controlled monitoring cron verified: auth rejection, ${triggerScheduled ? "scheduled handler, " : ""}baseline, change detection, alert creation, and email eligibility`,
  )
} finally {
  await database.from("tos_snapshots").delete().eq("url", url)
  if (userId) await database.from("users").delete().eq("id", userId)
}
