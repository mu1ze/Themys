import { expect, test } from "@playwright/test"
import { createCloudflareD1AdminClient } from "../scripts/lib/cloudflare-admin.mjs"

const runLive = process.env.RUN_LIVE_PROVIDER_E2E === "1"

function getAdminClient() {
  return createCloudflareD1AdminClient()
}

async function scanIds(page: import("@playwright/test").Page): Promise<Set<string>> {
  const response = await page.request.post("/api/scans/history", { data: { limit: 50 } })
  const responseBody = await response.text()
  expect(response.status(), responseBody).toBe(200)
  const body = JSON.parse(responseBody) as { scans: Array<{ id: string }> }
  return new Set(body.scans.map((scan) => scan.id))
}

test.describe("live scan workspace", () => {
  test("paste control is available on the scan form", async ({ page }) => {
    await page.goto("/scan/new")
    await expect(page.getByRole("button", { name: "Paste" })).toBeVisible()
  })

  test.skip(!runLive, "Set RUN_LIVE_PROVIDER_E2E=1 to spend test-provider quota")

  test("URL scans run from the UI, persist results, and are cleaned up", async ({ page }) => {
    test.setTimeout(240_000)
    const admin = getAdminClient()
    await page.goto("/scan/new")
    const profileResponse = await page.request.get("/api/profile")
    expect(profileResponse.status()).toBe(200)
    const { profile } = await profileResponse.json() as { profile: { id: string; plan: string } }
    const originalPlan = profile.plan
    const before = await scanIds(page)
    const createdIds: string[] = []

    try {
      const elevated = await admin.from("users").update({ plan: "advanced" }).eq("id", profile.id)
      if (elevated.error) throw elevated.error

      await page.goto("/scan/new")
      await page.getByPlaceholder("https://example.com/terms").fill("https://example.com/")
      await page.getByRole("button", { name: "Scan Now" }).click()
      await page.waitForURL(/\/scan\/results\?id=/, { timeout: 120_000 })
      await expect(page.getByText(/scan results/i).first()).toBeVisible()

      const after = await scanIds(page)
      createdIds.push(...[...after].filter((id) => !before.has(id)))
      expect(createdIds.length).toBeGreaterThan(0)
    } finally {
      for (const id of createdIds) await admin.from("scans").delete().eq("id", id)
      const restored = await admin.from("users").update({ plan: originalPlan }).eq("id", profile.id)
      if (restored.error) throw restored.error
    }
  })

  test("the same URL produces a cache miss, then a cache hit, and persists both scans", async ({ page }) => {
    test.setTimeout(240_000)
    const admin = getAdminClient()
    await page.goto("/dashboard")

    const profileResponse = await page.request.get("/api/profile")
    const profileBody = await profileResponse.text()
    expect(profileResponse.status(), profileBody).toBe(200)
    const { profile } = JSON.parse(profileBody) as {
      profile: {
        id: string
        plan: string
        country: string | null
        state: string | null
        targetClauses: string[]
        strictMode: boolean
      }
    }
    const marker = crypto.randomUUID()
    const domain = `cache-${marker}.invalid`
    const targetClauses = [`Cache acceptance ${marker}`]
    const createdIds: string[] = []

    try {
      const elevated = await admin.from("users").update({ plan: "advanced" }).eq("id", profile.id)
      if (elevated.error) throw elevated.error

      const preferences = await page.request.post("/api/profile", {
        data: {
          country: profile.country ?? "",
          state: profile.state ?? "",
          targetClauses,
          strictMode: profile.strictMode,
        },
      })
      expect(preferences.status(), await preferences.text()).toBe(200)

      const scan = async (idempotencyKey: string) => {
        const response = await page.request.post("/api/analyze", {
          headers: { "Idempotency-Key": idempotencyKey },
          data: { url: `https://example.com/?themys-cache-e2e=${marker}`, domain },
          timeout: 120_000,
        })
        const body = await response.json() as {
          scanId?: string
          usage?: { cached?: boolean }
          error?: string
        }
        expect(response.status(), JSON.stringify(body)).toBe(200)
        expect(body.scanId).toBeTruthy()
        createdIds.push(body.scanId!)
        return body
      }

      const first = await scan(`cache-miss-${marker}`)
      const second = await scan(`cache-hit-${marker}`)

      expect(first.usage?.cached).toBe(false)
      expect(second.usage?.cached).toBe(true)
      expect(second.scanId).not.toBe(first.scanId)

      const persisted = await admin
        .from("scans")
        .select("id, user_id, source, raw_text_hash")
        .eq("domain", domain)
      if (persisted.error) throw persisted.error
      expect(persisted.data).toHaveLength(2)
      expect(persisted.data?.every((row) => row.user_id === profile.id && row.source === "web")).toBe(true)

      const rawTextHash = persisted.data?.[0]?.raw_text_hash
      expect(rawTextHash).toMatch(/^[0-9a-f]{64}$/)
      const evicted = await page.request.delete(`/api/admin/scans/${rawTextHash.slice(0, 16)}`)
      expect(evicted.status(), await evicted.text()).toBe(200)
    } finally {
      try {
        const restore = await page.request.post("/api/profile", {
          data: {
            country: profile.country ?? "",
            state: profile.state ?? "",
            targetClauses: profile.targetClauses,
            strictMode: profile.strictMode,
          },
        })
        expect(restore.status(), await restore.text()).toBe(200)
      } finally {
        for (const id of createdIds) {
          const cleanup = await admin.from("scans").delete().eq("id", id)
          if (cleanup.error) throw cleanup.error
        }
        const cleanupByDomain = await admin.from("scans").delete().eq("domain", domain)
        if (cleanupByDomain.error) throw cleanupByDomain.error
        const restoredPlan = await admin.from("users").update({ plan: profile.plan }).eq("id", profile.id)
        if (restoredPlan.error) throw restoredPlan.error
      }
    }
  })
})
