import { expect, test } from "@playwright/test"
import { createCloudflareD1AdminClient } from "../scripts/lib/cloudflare-admin.mjs"

const runLive = process.env.RUN_LIVE_PROVIDER_E2E === "1"

test.describe("urgent authenticated batch contract", () => {
  test.skip(!runLive, "Set RUN_LIVE_PROVIDER_E2E=1 to exercise real extraction and analysis providers")

  test("a Clerk user can batch-analyze text and URL items through the shared pipeline", async ({ page }) => {
    test.setTimeout(120_000)

    const database = createCloudflareD1AdminClient()

    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/dashboard/)

    const marker = crypto.randomUUID()
    const domain = `urgent-batch-${marker}.invalid`
    const text = [
      "These service terms govern use of the Example Collaboration Platform.",
      "The provider may suspend access for abuse, requires users to protect account credentials,",
      "limits liability where permitted by law, and may update these terms after giving notice.",
      "Users retain ownership of uploaded content but grant the provider a limited license needed",
      "to host and process it. Subscriptions renew monthly until cancelled before the renewal date.",
      "Disputes are governed by Ontario law and may be resolved in courts located in Toronto.",
    ].join(" ")

    try {
      const response = await page.request.post("/api/analyze/batch", {
        headers: { "Idempotency-Key": `clerk-batch-e2e-${marker}` },
        data: {
          items: [
            { text, domain },
            { url: "https://example.com/", domain },
          ],
        },
        timeout: 110_000,
      })

      expect(response.status()).toBe(200)
      const body = await response.json() as {
        results: Array<{ ok: boolean; index: number; cached?: boolean; result?: { riskScore?: number }; error?: string }>
        summary: { total: number; succeeded: number; failed: number; authenticatedAs: string }
        usage: {
          scans: { remaining: number; limit: number }
          ai: { remaining: number; limit: number }
          creditBalance: number
        }
      }

      expect(body.summary).toMatchObject({ total: 2, succeeded: 2, failed: 0, authenticatedAs: "clerk" })
      expect(body.results.map((item) => item.index)).toEqual([0, 1])
      for (const item of body.results) {
        expect(item.ok, item.error).toBe(true)
        expect(typeof item.result?.riskScore).toBe("number")
      }
      expect(body.usage.scans.remaining).toBeGreaterThanOrEqual(0)
      expect(body.usage.scans.limit).toBeGreaterThan(0)
      expect(body.usage.ai.remaining).toBeGreaterThanOrEqual(0)
      expect(body.usage.ai.limit).toBeGreaterThan(0)
      expect(body.usage.creditBalance).toBeGreaterThanOrEqual(0)
    } finally {
      const { error } = await database.from("scans").delete().eq("domain", domain)
      if (error) throw error
    }
  })
})
