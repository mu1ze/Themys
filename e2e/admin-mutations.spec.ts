import { expect, test } from "@playwright/test"
import { createCloudflareD1AdminClient } from "../scripts/lib/cloudflare-admin.mjs"

function getAdminClient() {
  return createCloudflareD1AdminClient()
}

test("an authorized admin can change a user plan and delete a scan through the UI", async ({ page }) => {
  const admin = getAdminClient()
  const marker = crypto.randomUUID()
  let userId: string | undefined
  let scanId: string | undefined

  try {
    const user = await admin.from("users").insert({
      clerk_id: `user_admin_fixture_${marker}`,
      email: `admin-fixture-${marker}@themys.invalid`,
      plan: "free",
    }).select("id").single()
    if (user.error) throw user.error
    if (!user.data) throw new Error("Admin fixture user was not returned")
    userId = user.data.id

    const scan = await admin.from("scans").insert({
      user_id: userId,
      url: `https://admin-${marker}.example/terms`,
      domain: `admin-${marker}.example`,
      title: `Admin fixture ${marker}`,
      source: "web",
      risk_score: 5.5,
    }).select("id").single()
    if (scan.error) throw scan.error
    if (!scan.data) throw new Error("Admin fixture scan was not returned")
    scanId = scan.data.id

    await page.goto(`/admin/users/${userId}`)
    await expect(page).toHaveURL(new RegExp(`/admin/users/${userId}$`))
    await page.locator("select").selectOption("advanced")
    await page.getByRole("button", { name: "Update" }).click()
    await expect(page.getByText("Plan changed to advanced")).toBeVisible()
    const updated = await admin.from("users").select("plan").eq("id", userId).single()
    if (updated.error) throw updated.error
    if (!updated.data) throw new Error("Updated admin fixture user was not returned")
    expect(updated.data.plan).toBe("advanced")

    await page.goto(`/admin/scans/${scanId}`)
    await page.getByRole("button", { name: "Delete Scan" }).click()
    await page.getByRole("button", { name: "Confirm" }).click()
    await expect(page).toHaveURL(/\/admin\/scans$/)
    const deleted = await admin.from("scans").select("id").eq("id", scanId).maybeSingle()
    if (deleted.error) throw deleted.error
    expect(deleted.data).toBeNull()
  } finally {
    if (scanId) await admin.from("scans").delete().eq("id", scanId)
    if (userId) await admin.from("users").delete().eq("id", userId)
  }
})
