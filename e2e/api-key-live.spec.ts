import { expect, test } from "@playwright/test"
import { createCloudflareD1AdminClient } from "../scripts/lib/cloudflare-admin.mjs"

const runLive = process.env.RUN_LIVE_PROVIDER_E2E === "1"

function getAdminClient() {
  return createCloudflareD1AdminClient()
}

test.describe("live API-key consumer journey", () => {
  test.skip(!runLive, "Set RUN_LIVE_PROVIDER_E2E=1 to spend test-provider quota")

  test("a key can extract, analyze, record usage, and becomes unusable after revocation", async ({ page, baseURL }) => {
    test.setTimeout(180_000)
    expect(baseURL).toBeTruthy()
    const admin = getAdminClient()
    const marker = crypto.randomUUID()
    const name = `Live API E2E ${marker}`
    let keyId: string | undefined
    let rawKey: string | undefined
    let profileId: string | undefined
    let originalPlan: string | undefined
    let originalTargetClauses: string[] = []
    let originalStrictMode = false

    await page.goto("/dashboard/developer")
    try {
      const profileResponse = await page.request.get("/api/profile")
      const { profile } = await profileResponse.json() as {
        profile: { id: string; plan: string; targetClauses?: string[]; strictMode?: boolean }
      }
      profileId = profile.id
      originalPlan = profile.plan
      originalTargetClauses = profile.targetClauses ?? []
      originalStrictMode = profile.strictMode ?? false
      const elevated = await admin.from("users").update({
        plan: "advanced",
        target_clauses: ["automatic renewal"],
        strict_mode: true,
      }).eq("id", profile.id)
      if (elevated.error) throw elevated.error

      const created = await page.request.post("/api/developer/keys", {
        data: { name, scopes: ["extract", "analyze"] },
      })
      expect(created.status(), await created.text()).toBe(200)
      const key = await created.json() as { id: string; key: string }
      keyId = key.id
      rawKey = key.key
      const headers = { Authorization: `Bearer ${rawKey}`, "Content-Type": "application/json" }

      const extracted = await fetch(new URL("/api/extract", baseURL), {
        method: "POST",
        headers,
        body: JSON.stringify({ url: "https://example.com/" }),
      })
      expect(extracted.status, await extracted.clone().text()).toBe(200)
      expect(extracted.headers.get("content-type")).toContain("application/vnd.themys.v1+json")
      const extractedPayload = await extracted.json() as {
        schemaVersion: string
        requestId: string
        ok: boolean
        data: { text: string; wordCount: number }
      }
      expect(extractedPayload).toMatchObject({ ok: true, schemaVersion: "2026-09-20" })
      expect(extractedPayload.requestId).toBeTruthy()
      expect(extractedPayload.data.wordCount).toBeGreaterThan(0)

      const analyzed = await fetch(new URL("/api/analyze", baseURL), {
        method: "POST",
        headers: { ...headers, "Idempotency-Key": `api-key-live-${marker}` },
        body: JSON.stringify({
          domain: `api-key-${marker}.invalid`,
          text: "Your subscription renews automatically each month unless you cancel. We may terminate accounts and limit liability for service interruptions.",
        }),
      })
      expect(analyzed.status, await analyzed.clone().text()).toBe(200)
      const analyzedPayload = await analyzed.json() as {
        schemaVersion: string
        requestId: string
        ok: boolean
        data: {
          flags: Array<{ isTargetClause?: boolean; text: string }>
          analysisPolicy: { mode: string; targetClauses: string[]; complianceEvidence: string }
        }
      }
      expect(analyzedPayload).toMatchObject({ ok: true, schemaVersion: "2026-09-20" })
      expect(analyzedPayload.data.analysisPolicy).toMatchObject({
        mode: "strict_targets_only",
        targetClauses: ["automatic renewal"],
        complianceEvidence: "source_grounded",
      })
      expect(analyzedPayload.data.flags.length).toBeGreaterThan(0)
      expect(analyzedPayload.data.flags.every((flag) => flag.isTargetClause === true)).toBe(true)
      expect(analyzedPayload.data.flags.some((flag) => /terminat|liabil/i.test(flag.text))).toBe(false)

      const usage = await admin.from("api_keys").select("request_count").eq("id", keyId).single()
      if (usage.error) throw usage.error
      if (!usage.data) throw new Error("API key usage row was not returned")
      expect(usage.data.request_count).toBeGreaterThanOrEqual(2)

      const revoked = await page.request.delete(`/api/developer/keys/${keyId}`)
      expect(revoked.status()).toBe(200)
      const rejected = await fetch(new URL("/api/extract", baseURL), {
        method: "POST",
        headers,
        body: JSON.stringify({ url: "https://example.com/" }),
      })
      expect(rejected.status).toBe(401)
      const rejectedPayload = await rejected.json() as {
        ok: boolean
        error: { code: string; status: number }
      }
      expect(rejectedPayload).toMatchObject({
        ok: false,
        error: { code: "authentication_required", status: 401 },
      })
    } finally {
      await admin.from("scans").delete().eq("domain", `api-key-${marker}.invalid`)
      if (keyId) await admin.from("api_keys").delete().eq("id", keyId)
      if (profileId && originalPlan) {
        const restored = await admin.from("users").update({
          plan: originalPlan,
          target_clauses: originalTargetClauses,
          strict_mode: originalStrictMode,
        }).eq("id", profileId)
        if (restored.error) throw restored.error
      }
    }
  })
})
