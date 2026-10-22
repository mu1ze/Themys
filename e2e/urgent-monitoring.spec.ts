import { expect, test } from "@playwright/test"
import { createCloudflareD1AdminClient } from "../scripts/lib/cloudflare-admin.mjs"

function getAdminClient() {
  return createCloudflareD1AdminClient()
}

test.describe("urgent monitoring contract", () => {
  test("anonymous monitoring routes are protected", async ({ baseURL }) => {
    expect(baseURL).toBeTruthy()
    // Use native fetch here. Clerk's Playwright helper injects its testing token
    // into Playwright request contexts, including newly-created contexts.
    const monitorResponse = await fetch(new URL("/api/monitor", baseURL))
    const alertsResponse = await fetch(new URL("/api/monitor/alerts", baseURL))
    const pageResponse = await fetch(new URL("/monitoring", baseURL), {
      redirect: "manual",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
      },
    })
    expect(monitorResponse.status).toBe(401)
    expect(alertsResponse.status).toBe(401)
    expect([307, 308]).toContain(pageResponse.status)
    expect(pageResponse.headers.get("location")).toMatch(/\/sign-in|clerk\.accounts/)
  })

  test("signed-in dashboard, subscription lifecycle, and alert reads use canonical routes", async ({ page }) => {
    const database = getAdminClient()
    await page.goto("/monitoring")
    await expect(page.getByRole("heading", { name: "Monitoring" })).toBeVisible()

    const listResponse = await page.request.get("/api/monitor")
    expect(listResponse.status()).toBe(200)
    const list = await listResponse.json() as { subscriptions: unknown[]; limit: number }
    expect(Array.isArray(list.subscriptions)).toBe(true)
    expect(list.limit).toBeGreaterThan(0)

    const invalidUrlResponse = await page.request.post("/api/monitor", {
      data: {
        url: "http://127.0.0.1/terms",
        title: "Invalid monitoring E2E fixture",
        frequency: "weekly",
      },
    })
    expect(invalidUrlResponse.status()).toBe(400)

    const url = `https://1.1.1.1/terms?themys-e2e=${crypto.randomUUID()}`
    const profileResponse = await page.request.get("/api/profile")
    expect(profileResponse.status()).toBe(200)
    const { profile } = await profileResponse.json() as {
      profile: { id: string; plan: "free" | "base" | "advanced" | "lifetime" }
    }
    const originalPlan = profile.plan
    let subscriptionId: string | undefined

    try {
      const { error: planError } = await database
        .from("users")
        .update({ plan: "advanced" })
        .eq("id", profile.id)
      if (planError) throw planError

      const createResponse = await page.request.post("/api/monitor", {
        data: { url, title: "Monitoring E2E fixture", frequency: "weekly" },
      })
      const createBody = await createResponse.text()
      expect(createResponse.status(), createBody).toBe(200)
      const created = JSON.parse(createBody) as { subscription: { id: string; url: string } }
      subscriptionId = created.subscription.id
      expect(created.subscription.url).toBe(url)

      const disableEmail = await page.request.patch("/api/monitor", {
        data: { subscriptionId, emailNotificationsEnabled: false },
      })
      const disableBody = await disableEmail.text()
      expect(disableEmail.status(), disableBody).toBe(200)
      const disabled = JSON.parse(disableBody) as {
        subscription: { email_notifications_enabled: boolean }
      }
      expect(disabled.subscription.email_notifications_enabled).toBe(false)

      const enableEmail = await page.request.patch("/api/monitor", {
        data: { subscriptionId, emailNotificationsEnabled: true },
      })
      const enableBody = await enableEmail.text()
      expect(enableEmail.status(), enableBody).toBe(200)
      const enabled = JSON.parse(enableBody) as {
        subscription: { email_notifications_enabled: boolean }
      }
      expect(enabled.subscription.email_notifications_enabled).toBe(true)

      const { data: snapshot, error: snapshotError } = await database
        .from("tos_snapshots")
        .insert({
          url,
          domain: "1.1.1.1",
          text_hash: `owned-alert-${crypto.randomUUID()}`,
        })
        .select("id")
        .single()
      if (snapshotError) throw snapshotError
      if (!snapshot) throw new Error("Owned monitoring snapshot was not returned")

      const { data: ownedAlert, error: alertError } = await database
        .from("monitoring_alerts")
        .insert({
          subscription_id: subscriptionId,
          user_id: profile.id,
          new_snapshot_id: snapshot.id,
          change_type: "text_change",
        })
        .select("id")
        .single()
      if (alertError) throw alertError
      if (!ownedAlert) throw new Error("Owned monitoring alert was not returned")

      const afterCreate = await page.request.get("/api/monitor")
      expect(afterCreate.status()).toBe(200)
      const body = await afterCreate.json() as { subscriptions: Array<{ id: string }> }
      expect(body.subscriptions.some((subscription) => subscription.id === subscriptionId)).toBe(true)

      const alertsResponse = await page.request.get("/api/monitor/alerts")
      expect(alertsResponse.status()).toBe(200)
      const alerts = await alertsResponse.json() as {
        alerts: Array<{ id: string; is_read: boolean }>
        unreadCount: number
      }
      expect(Array.isArray(alerts.alerts)).toBe(true)
      expect(alerts.unreadCount).toBeGreaterThanOrEqual(0)
      expect(alerts.alerts.some((alert) => alert.id === ownedAlert.id && !alert.is_read)).toBe(true)

      const markRead = await page.request.patch("/api/monitor/alerts", {
        data: { alertId: ownedAlert.id },
      })
      expect(markRead.status()).toBe(200)

      const { data: readAlert, error: readError } = await database
        .from("monitoring_alerts")
        .select("is_read")
        .eq("id", ownedAlert.id)
        .single()
      if (readError) throw readError
      if (!readAlert) throw new Error("Read monitoring alert was not returned")
      expect(readAlert.is_read).toBe(true)
    } finally {
      if (subscriptionId) {
        const removeResponse = await page.request.delete("/api/monitor", {
          data: { subscriptionId },
        })
        expect(removeResponse.status()).toBe(200)
      }
      const { error: snapshotCleanupError } = await database
        .from("tos_snapshots")
        .delete()
        .eq("url", url)
      if (snapshotCleanupError) throw snapshotCleanupError
      const { error: planRestoreError } = await database
        .from("users")
        .update({ plan: originalPlan })
        .eq("id", profile.id)
      if (planRestoreError) throw planRestoreError
    }
  })

  test("signed-in users cannot mutate another user's subscription or alert", async ({ page }) => {
    const database = getAdminClient()
    const marker = crypto.randomUUID()
    const clerkId = `user_monitor_owner_${marker}`
    const fixtureUrl = `https://example.com/foreign-terms?themys-owner-e2e=${marker}`
    let foreignUserId: string | undefined

    try {
      await page.goto("/monitoring")
      await expect(page.getByRole("heading", { name: "Monitoring" })).toBeVisible()

      const { data: foreignUser, error: userError } = await database
        .from("users")
        .insert({
          clerk_id: clerkId,
          email: `monitor-owner-${marker}@themys.invalid`,
          plan: "free",
        })
        .select("id")
        .single()
      if (userError) throw userError
      if (!foreignUser) throw new Error("Foreign monitoring user was not returned")
      foreignUserId = foreignUser.id as string

      const { data: subscription, error: subscriptionError } = await database
        .from("monitoring_subscriptions")
        .insert({
          user_id: foreignUserId,
          url: fixtureUrl,
          domain: "example.com",
          title: "Foreign ownership fixture",
          frequency: "weekly",
        })
        .select("id")
        .single()
      if (subscriptionError) throw subscriptionError
      if (!subscription) throw new Error("Foreign monitoring subscription was not returned")

      const { data: snapshot, error: snapshotError } = await database
        .from("tos_snapshots")
        .insert({
          url: fixtureUrl,
          domain: "example.com",
          text_hash: `foreign-owner-${marker}`,
        })
        .select("id")
        .single()
      if (snapshotError) throw snapshotError
      if (!snapshot) throw new Error("Foreign monitoring snapshot was not returned")

      const { data: alert, error: alertError } = await database
        .from("monitoring_alerts")
        .insert({
          subscription_id: subscription.id,
          user_id: foreignUserId,
          new_snapshot_id: snapshot.id,
          change_type: "text_change",
        })
        .select("id")
        .single()
      if (alertError) throw alertError
      if (!alert) throw new Error("Foreign monitoring alert was not returned")

      const listResponse = await page.request.get("/api/monitor")
      expect(listResponse.status()).toBe(200)
      const list = await listResponse.json() as { subscriptions: Array<{ id: string }> }
      expect(list.subscriptions.some((item) => item.id === subscription.id)).toBe(false)

      const alertsResponse = await page.request.get("/api/monitor/alerts")
      expect(alertsResponse.status()).toBe(200)
      const alerts = await alertsResponse.json() as { alerts: Array<{ id: string }> }
      expect(alerts.alerts.some((item) => item.id === alert.id)).toBe(false)

      const deleteResponse = await page.request.delete("/api/monitor", {
        data: { subscriptionId: subscription.id },
      })
      expect(deleteResponse.status()).toBe(404)

      const markReadResponse = await page.request.patch("/api/monitor/alerts", {
        data: { alertId: alert.id },
      })
      expect(markReadResponse.status()).toBe(404)

      const { data: untouchedAlert, error: readError } = await database
        .from("monitoring_alerts")
        .select("is_read")
        .eq("id", alert.id)
        .single()
      if (readError) throw readError
      if (!untouchedAlert) throw new Error("Foreign monitoring alert readback was not returned")
      expect(untouchedAlert.is_read).toBe(false)
    } finally {
      if (foreignUserId) {
        const { error } = await database.from("users").delete().eq("id", foreignUserId)
        if (error) throw error
      }
      const { error: snapshotCleanupError } = await database
        .from("tos_snapshots")
        .delete()
        .eq("url", fixtureUrl)
      if (snapshotCleanupError) throw snapshotCleanupError
    }
  })
})
