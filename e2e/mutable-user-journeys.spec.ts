import { expect, test, type Page } from "@playwright/test"
import { createClerkClient } from "@clerk/backend"
import { createCloudflareD1AdminClient } from "../scripts/lib/cloudflare-admin.mjs"

function getAdminClient() {
  return createCloudflareD1AdminClient()
}

type Profile = {
  id: string
  country: string | null
  state: string | null
  targetClauses: string[]
  strictMode: boolean
}

async function getProfile(page: Page): Promise<Profile> {
  let response: Awaited<ReturnType<Page["request"]["get"]>>
  for (let i = 0; i < 3; i++) {
    response = await page.request.get("/api/profile")
    if (response.status() === 200) {
      return (await response.json() as { profile: Profile }).profile
    }
    await page.waitForTimeout(1000)
  }
  expect((await (response!).status()).valueOf()).toBe(200)
  return (await (await response!).json() as { profile: Profile }).profile
}

test.describe("mutable user journeys", () => {
  test("settings UI updates display name, location, and scan preferences, then restores them", async ({ page }) => {
    test.setTimeout(60_000)
    const admin = getAdminClient()
    await page.goto("/settings")
    const original = await getProfile(page)
    const marker = crypto.randomUUID().slice(0, 8)
    const targetClauses = [`E2E arbitration ${marker}`, `E2E renewal ${marker}`]
    let dependentScanId: string | undefined
    let dependentSubscriptionId: string | undefined
    const testEmail = process.env.CLERK_TEST_USER_EMAIL ?? "e2e+clerk_test@themys.ca"
    const secretKey = process.env.CLERK_SECRET_KEY
    if (!secretKey) throw new Error("CLERK_SECRET_KEY is required for settings E2E")
    const clerk = createClerkClient({ secretKey })
    const users = await clerk.users.getUserList({ emailAddress: [testEmail], limit: 1 })
    const clerkUser = users.data[0]
    if (!clerkUser) throw new Error(`Clerk test user ${testEmail} was not found`)
    if (!clerkUser.firstName) throw new Error("The Clerk E2E user must have a restorable first name")
    const originalFirstName = clerkUser.firstName

    try {
      const scan = await admin.from("scans").insert({
        user_id: original.id,
        url: `https://settings-${marker}.example/terms`,
        domain: `settings-${marker}.example`,
        title: `Settings dependency ${marker}`,
        source: "web",
      }).select("id").single()
      if (scan.error) throw scan.error
      if (!scan.data) throw new Error("Settings scan dependency was not returned")
      dependentScanId = scan.data.id

      const subscription = await admin.from("monitoring_subscriptions").insert({
        user_id: original.id,
        url: `https://settings-${marker}.example/privacy`,
        domain: `settings-${marker}.example`,
        title: `Settings monitoring dependency ${marker}`,
        frequency: "weekly",
      }).select("id").single()
      if (subscription.error) throw subscription.error
      if (!subscription.data) throw new Error("Settings monitoring dependency was not returned")
      dependentSubscriptionId = subscription.data.id

      await page.getByRole("button", { name: "Edit" }).first().click()
      await page.getByLabel("Display name").fill("x".repeat(101))
      await page.getByRole("button", { name: "Save", exact: true }).click()
      await expect(page.getByText("Name must be between 1 and 100 characters")).toBeVisible()

      const displayName = `Themys E2E ${marker}`
      await page.getByLabel("Display name").fill(displayName)
      await page.getByRole("button", { name: "Save", exact: true }).click()
      await expect(page.getByText(displayName)).toBeVisible({ timeout: 15_000 })

      await page.getByRole("tab", { name: "Location" }).click()
      await page.getByLabel("Country").fill("CA")
      await page.getByLabel("State / region").fill("ON")
      await page.getByRole("button", { name: "Save location" }).click()
      await expect(page.getByText("Location saved. Future scans will use this profile.")).toBeVisible()

      await page.getByRole("tab", { name: "Scan prefs" }).click()
      await page.getByRole("button", { name: "Edit" }).first().click()
      const clauseInput = page.getByPlaceholder("Add a new target clause...")
      for (const clause of targetClauses) {
        await clauseInput.fill(clause)
        await page.getByRole("button", { name: "Add", exact: true }).click()
      }
      const strictToggle = page.locator("#strict-mode")
      if (!(await strictToggle.isChecked())) {
        await page.locator("label[for='strict-mode']").click()
      }
      await page.getByRole("button", { name: "Save preferences" }).click()
      await expect(page.getByText("Enabled", { exact: true })).toBeVisible({ timeout: 15_000 })

      const mutated = await getProfile(page)
      expect(mutated).toMatchObject({
        id: original.id,
        country: "CA",
        state: "ON",
        targetClauses,
        strictMode: true,
      })

      const [preservedScan, preservedSubscription] = await Promise.all([
        admin.from("scans").select("user_id").eq("id", dependentScanId).single(),
        admin.from("monitoring_subscriptions").select("user_id").eq("id", dependentSubscriptionId).single(),
      ])
      if (preservedScan.error) throw preservedScan.error
      if (preservedSubscription.error) throw preservedSubscription.error
      expect(preservedScan.data?.user_id).toBe(original.id)
      expect(preservedSubscription.data?.user_id).toBe(original.id)

      const updatedClerkUser = await clerk.users.getUser(clerkUser.id)
      expect(updatedClerkUser.firstName).toBe(displayName)
    } finally {
      await clerk.users.updateUser(clerkUser.id, { firstName: originalFirstName })
      try {
        const restore = await page.request.post("/api/profile", {
          data: {
            country: original.country ?? "",
            state: original.state ?? "",
            targetClauses: original.targetClauses,
            strictMode: original.strictMode,
          },
        })
        expect(restore.status(), await restore.text()).toBe(200)
      } finally {
        if (dependentSubscriptionId) {
          const cleanup = await admin.from("monitoring_subscriptions").delete().eq("id", dependentSubscriptionId)
          if (cleanup.error) throw cleanup.error
        }
        if (dependentScanId) {
          const cleanup = await admin.from("scans").delete().eq("id", dependentScanId)
          if (cleanup.error) throw cleanup.error
        }
      }
    }
  })

  test("API keys can be created, listed, scoped, and revoked", async ({ page }) => {
    const admin = getAdminClient()
    const marker = crypto.randomUUID()
    const name = `Mutable E2E ${marker}`
    let keyId: string | undefined

    await page.goto("/dashboard/developer")
    await page.waitForTimeout(300)

    try {
      const invalid = await page.request.post("/api/developer/keys", {
        data: { name, scopes: ["admin"] },
      })
      expect(invalid.status()).toBe(400)

      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {})
      await page.waitForTimeout(500)

      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find((b) =>
          b.textContent?.trim().startsWith("Create API key")
        )
        if (btn) btn.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      })
      await page.getByPlaceholder("e.g., Production, Development").fill(name)
      await page.getByRole("button", { name: "Create key", exact: true }).click()
      await expect(page.getByRole("dialog", { name: "API key created" })).toBeVisible()
      await expect(page.getByText("Save this key — it will not be shown again.")).toBeVisible()

      const stored = await admin.from("api_keys").select("id").eq("name", name).single()
      if (stored.error) throw stored.error
      if (!stored.data) throw new Error("Created API key row was not returned")
      keyId = stored.data.id
      await page.getByRole("button", { name: "Close", exact: true }).click()
      await expect(page.locator("tr").filter({ hasText: name })).toBeVisible()

      const list = await page.request.get("/api/developer/keys")
      expect(list.status()).toBe(200)
      const listed = await list.json() as {
        keys: Array<{ id: string; name: string; scopes: string[] }>
      }
      expect(listed.keys).toContainEqual(expect.objectContaining({
        id: keyId,
        name,
        scopes: expect.arrayContaining(["extract"]),
      }))

      page.once("dialog", (dialog) => dialog.accept())
      const row = page.locator("tr").filter({ hasText: name })
      await row.getByRole("button", { name: "Revoke" }).click()
      await expect(page.locator("tr").filter({ hasText: name })).toHaveCount(0)

      const afterRevoke = await page.request.get("/api/developer/keys")
      const after = await afterRevoke.json() as { keys: Array<{ id: string }> }
      expect(after.keys.some((key) => key.id === keyId)).toBe(false)
    } finally {
      if (keyId) {
        const { error } = await admin.from("api_keys").delete().eq("id", keyId)
        if (error) throw error
      }
    }
  })

  test("scan history returns owned scans and deletion is isolated by user", async ({ page }) => {
    test.setTimeout(60_000)
    const admin = getAdminClient()
    await page.goto("/history")
    const profile = await getProfile(page)
    const marker = crypto.randomUUID()
    const domain = `mutable-${marker}.example`
    const title = `Mutable E2E ${marker}`
    const foreignClerkId = `user_mutable_foreign_${marker}`
    let scanId: string | undefined
    let foreignUserId: string | undefined
    let foreignScanId: string | undefined

    try {
      const ownedInsert = await admin.from("scans").insert({
        user_id: profile.id,
        url: `https://${domain}/terms`,
        domain,
        title,
        risk_score: 7.2,
        clause_count: 1,
        flagged_count: 1,
        source: "web",
        raw_text: "Mutable E2E terms fixture",
      }).select("id").single()
      if (ownedInsert.error) throw ownedInsert.error
      if (!ownedInsert.data) throw new Error("Owned scan fixture was not returned")
      scanId = ownedInsert.data.id

      const clauseInsert = await admin.from("clauses").insert({
        scan_id: scanId,
        text: "The service renews automatically unless cancelled.",
        category: "auto_renewal",
        risk_score: 7.2,
        risk_level: "red",
        position: 0,
        is_flagged: true,
        explanation: "The agreement renews automatically.",
        why_it_matters: "Cancellation is required to avoid another term.",
      })
      if (clauseInsert.error) throw clauseInsert.error

      const foreignUser = await admin.from("users").insert({
        clerk_id: foreignClerkId,
        email: `${marker}@themys.invalid`,
        plan: "free",
      }).select("id").single()
      if (foreignUser.error) throw foreignUser.error
      if (!foreignUser.data) throw new Error("Foreign user fixture was not returned")
      foreignUserId = foreignUser.data.id

      const foreignScan = await admin.from("scans").insert({
        user_id: foreignUserId,
        url: `https://foreign-${domain}/terms`,
        domain: `foreign-${domain}`,
        title: "Foreign mutable fixture",
        source: "web",
      }).select("id").single()
      if (foreignScan.error) throw foreignScan.error
      if (!foreignScan.data) throw new Error("Foreign scan fixture was not returned")
      foreignScanId = foreignScan.data.id

      let historyBody: { scans: Array<{ id: string }> } | undefined
      for (let i = 0; i < 3; i++) {
        const history = await page.request.post("/api/scans/history", { data: { limit: 50 } })
        if (history.status() === 200) {
          historyBody = await history.json()
          break
        }
        await page.waitForTimeout(1000)
      }
      if (!historyBody) throw new Error("Failed to fetch scan history after retries")
      expect(historyBody.scans.some((scan) => scan.id === scanId)).toBe(true)
      expect(historyBody.scans.some((scan) => scan.id === foreignScanId)).toBe(false)

      const detail = await page.request.get(`/api/scans/${scanId}`)
      expect(detail.status()).toBe(200)
      const detailBody = await detail.json() as { scan: { id: string }; clauses: Array<{ category: string }> }
      expect(detailBody.scan.id).toBe(scanId)
      expect(detailBody.clauses).toContainEqual(expect.objectContaining({ category: "auto_renewal" }))

      const foreignRead = await page.request.get(`/api/scans/${foreignScanId}`)
      expect(foreignRead.status()).toBe(404)
      const foreignDelete = await page.request.delete(`/api/scans/${foreignScanId}`)
      expect(foreignDelete.status()).toBe(404)

      await page.goto("/history")
      const ownedCard = page.locator("article").filter({ hasText: domain })
      await expect(ownedCard).toBeVisible({ timeout: 15_000 })
      page.once("dialog", (dialog) => dialog.accept())
      await ownedCard.getByRole("button", { name: "Delete scan" }).click()

      const start = Date.now()
      while (Date.now() - start < 15_000) {
        const check = await page.request.get(`/api/scans/${scanId}`)
        if (check.status() === 404) break
        await page.waitForTimeout(500)
      }
      const removedRead = await page.request.get(`/api/scans/${scanId}`)
      expect(removedRead.status()).toBe(404)

      const foreignState = await admin.from("scans").select("is_deleted").eq("id", foreignScanId).single()
      if (foreignState.error) throw foreignState.error
      if (!foreignState.data) throw new Error("Foreign scan state was not returned")
      expect(foreignState.data.is_deleted).toBe(false)
    } finally {
      if (scanId) await admin.from("scans").delete().eq("id", scanId)
      if (foreignUserId) await admin.from("users").delete().eq("id", foreignUserId)
    }
  })

  test("documentation feedback is persisted and can be cleaned up", async ({ page }) => {
    const admin = getAdminClient()
    const marker = crypto.randomUUID()
    const comment = `Mutable E2E feedback ${marker}`

    try {
      const response = await page.request.post("/api/docs/feedback", {
        data: {
          slug: "quick-start",
          helpful: false,
          comment,
          deviceId: `mutable_e2e_${marker.replaceAll("-", "")}`,
        },
      })
      expect(response.status(), await response.text()).toBe(201)

      const stored = await admin
        .from("docs_feedback")
        .select("slug, helpful, comment")
        .eq("comment", comment)
        .single()
      if (stored.error) throw stored.error
      expect(stored.data).toEqual({ slug: "quick-start", helpful: false, comment })
    } finally {
      const { error } = await admin.from("docs_feedback").delete().eq("comment", comment)
      if (error) throw error
    }
  })
})
