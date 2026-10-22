import { createClerkClient } from "@clerk/backend"
import { expect, test } from "@playwright/test"
import type { DatabaseClient } from "../src/lib/database-client"
import { createCloudflareD1AdminClient } from "../scripts/lib/cloudflare-admin.mjs"

function getAdminClient() {
  return createCloudflareD1AdminClient()
}

/**
 * Provision one representative row in every user-owned table so the deletion
 * test can prove the full cascade removes all of them, not just the profile.
 *
 * Returns the created row ids so the test can assert each is gone afterwards.
 */
async function provisionUserOwnedRows(
  admin: DatabaseClient,
  userId: string,
): Promise<Record<string, string>> {
  const ids: Record<string, string> = {}

  // scans -> clauses (cascade from scans)
  const scan = await admin.from("scans").insert({
    user_id: userId,
    url: "https://delete-e2e.example/terms",
    domain: "delete-e2e.example",
    title: "Deletion E2E scan",
    source: "web",
  }).select("id").single()
  if (scan.error) throw scan.error
  if (!scan.data) throw new Error("Deletion scan fixture was not returned")
  ids.scan = scan.data.id

  const clause = await admin.from("clauses").insert({
    scan_id: ids.scan,
    text: "Deletion E2E clause",
    category: "data_sharing",
    risk_score: 5,
    risk_level: "yellow",
    position: 1,
  }).select("id").single()
  if (clause.error) throw clause.error
  if (!clause.data) throw new Error("Deletion clause fixture was not returned")
  ids.clause = clause.data.id

  // blocklist_items
  const blocklist = await admin.from("blocklist_items").insert({
    user_id: userId,
    keyword: "deletion-e2e-keyword",
    category: "data_sharing",
    is_custom: true,
  }).select("id").single()
  if (blocklist.error) throw blocklist.error
  if (!blocklist.data) throw new Error("Deletion blocklist fixture was not returned")
  ids.blocklist = blocklist.data.id

  // credit_packs -> credit_usage_reservations (cascade from users)
  const creditPack = await admin.from("credit_packs").insert({
    user_id: userId,
    pack_size: 10,
    credits_remaining: 5,
    price_paid: 1.99,
  }).select("id").single()
  if (creditPack.error) throw creditPack.error
  if (!creditPack.data) throw new Error("Deletion credit pack fixture was not returned")
  ids.creditPack = creditPack.data.id

  const reservation = await admin.from("credit_usage_reservations").insert({
    user_id: userId,
    credit_pack_id: ids.creditPack,
    idempotency_key: `deletion-e2e-${userId}`,
    purpose: "scan_overflow",
  }).select("id").single()
  if (reservation.error) throw reservation.error
  if (!reservation.data) throw new Error("Deletion reservation fixture was not returned")
  ids.reservation = reservation.data.id

  // invoices
  const invoice = await admin.from("invoices").insert({
    user_id: userId,
    amount: 9.99,
    currency: "usd",
    status: "paid",
    description: "Deletion E2E invoice",
  }).select("id").single()
  if (invoice.error) throw invoice.error
  if (!invoice.data) throw new Error("Deletion invoice fixture was not returned")
  ids.invoice = invoice.data.id

  // monitoring_subscriptions -> tos_snapshots -> monitoring_alerts
  const subscription = await admin.from("monitoring_subscriptions").insert({
    user_id: userId,
    url: "https://delete-e2e.example/terms",
    domain: "delete-e2e.example",
    title: "Deletion E2E subscription",
    frequency: "weekly",
  }).select("id").single()
  if (subscription.error) throw subscription.error
  if (!subscription.data) throw new Error("Deletion subscription fixture was not returned")
  ids.subscription = subscription.data.id

  const snapshot = await admin.from("tos_snapshots").insert({
    url: "https://delete-e2e.example/terms",
    domain: "delete-e2e.example",
    text_hash: "deletion-e2e-hash",
    word_count: 10,
    subscription_id: ids.subscription,
  }).select("id").single()
  if (snapshot.error) throw snapshot.error
  if (!snapshot.data) throw new Error("Deletion snapshot fixture was not returned")
  ids.snapshot = snapshot.data.id

  const alert = await admin.from("monitoring_alerts").insert({
    subscription_id: ids.subscription,
    user_id: userId,
    new_snapshot_id: ids.snapshot,
    change_type: "text_change",
    summary: "Deletion E2E alert",
  }).select("id").single()
  if (alert.error) throw alert.error
  if (!alert.data) throw new Error("Deletion alert fixture was not returned")
  ids.alert = alert.data.id

  // api_keys -> api_usage_logs (cascade from users)
  const apiKey = await admin.from("api_keys").insert({
    user_id: userId,
    key_hash: `deletion-e2e-hash-${userId}`,
    key_prefix: "del_e2e",
    name: "Deletion E2E key",
  }).select("id").single()
  if (apiKey.error) throw apiKey.error
  if (!apiKey.data) throw new Error("Deletion API key fixture was not returned")
  ids.apiKey = apiKey.data.id

  const usageLog = await admin.from("api_usage_logs").insert({
    api_key_id: ids.apiKey,
    user_id: userId,
    endpoint: "/v1/analyze",
    status_code: 200,
    response_time_ms: 42,
  }).select("id").single()
  if (usageLog.error) throw usageLog.error
  if (!usageLog.data) throw new Error("Deletion usage log fixture was not returned")
  ids.usageLog = usageLog.data.id

  return ids
}

async function assertRowsRemoved(admin: DatabaseClient, ids: Record<string, string>) {
  const checks: Array<[string, string]> = [
    ["scans", ids.scan],
    ["clauses", ids.clause],
    ["blocklist_items", ids.blocklist],
    ["credit_packs", ids.creditPack],
    ["credit_usage_reservations", ids.reservation],
    ["invoices", ids.invoice],
    ["monitoring_subscriptions", ids.subscription],
    ["tos_snapshots", ids.snapshot],
    ["monitoring_alerts", ids.alert],
    ["api_keys", ids.apiKey],
    ["api_usage_logs", ids.usageLog],
  ]
  for (const [table, id] of checks) {
    const { data, error } = await admin.from(table).select("id").eq("id", id).maybeSingle()
    if (error) throw error
    expect(data, `${table} row should be removed after account deletion`).toBeNull()
  }
}

test("a user can permanently delete their identity and application data", async ({ page }) => {
  test.setTimeout(120_000)
  const clerkSecret = process.env.CLERK_SECRET_KEY
  if (!clerkSecret?.startsWith("sk_test_")) {
    throw new Error("Account deletion E2E requires a Clerk development instance")
  }

  const testEmail = process.env.CLERK_TEST_USER_EMAIL ?? "e2e+clerk_test@themys.ca"
  const clerkClient = createClerkClient({ secretKey: clerkSecret })
  const admin = getAdminClient()

  let databaseUserId: string | undefined
  let ids: Record<string, string> = {}

  try {
    // The fixture page is already authenticated via the storageState saved by
    // global.setup.ts — no manual context or testing token is needed.
    const provision = await page.request.post("/api/profile", {
      data: { country: "CA", state: "ON", targetClauses: ["Deletion E2E"], strictMode: true },
    })
    expect(provision.status(), await provision.text()).toBe(200)
    const profile = await provision.json() as { profile: { id: string } }
    databaseUserId = profile.profile.id

    // Provision representative rows across every user-owned table.
    ids = await provisionUserOwnedRows(admin, databaseUserId)

    await page.goto("/settings")
    await page.getByRole("tab", { name: "Account" }).click()
    await page.getByRole("button", { name: "Delete account" }).click()
    await expect(page.getByText("This action cannot be undone")).toBeVisible()
    await page.getByRole("button", { name: "Confirm deletion" }).click()
    await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 })

    // Clerk identity is removed.
    await expect.poll(async () => {
      const users = await clerkClient.users.getUserList({ emailAddress: [testEmail], limit: 1 })
      return users.data.length
    }).toBe(0)

    // The profile row is removed.
    const deletedProfile = await admin.from("users").select("id").eq("id", databaseUserId).maybeSingle()
    if (deletedProfile.error) throw deletedProfile.error
    expect(deletedProfile.data).toBeNull()

    // Every user-owned application row is removed via the cascade.
    await assertRowsRemoved(admin, ids)
  } finally {
    if (databaseUserId) await admin.from("users").delete().eq("id", databaseUserId)

    // Re-create the shared test user if this test deleted it, and restore their profile row
    const remaining = await clerkClient.users.getUserList({ emailAddress: [testEmail], limit: 1 })
    if (!remaining.data[0]) {
      let newUser: Awaited<ReturnType<typeof clerkClient.users.createUser>>
      try {
        newUser = await clerkClient.users.createUser({
          emailAddress: [testEmail],
          username: "themys_e2e",
          firstName: "Themys",
          lastName: "E2E",
          skipPasswordRequirement: true,
          skipLegalChecks: true,
        })
      } catch {
        return // User already exists from another run, nothing to do
      }
      try {
        await admin.from("users").insert({
          clerk_id: newUser.id,
          email: testEmail,
          plan: "free",
        }).select()
      } catch {
        // Profile may already exist from a previous test cycle
      }
    }
  }
})
