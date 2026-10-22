import { expect, test } from "@playwright/test"
import { setupClerkTestingToken } from "@clerk/testing/playwright"

test.use({ storageState: { cookies: [], origins: [] } })

test("anonymous users see header sign-in and sign-up actions", async ({ page }) => {
  test.setTimeout(90_000)
  await setupClerkTestingToken({ page })

  await page.goto("/", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Start free" })).toBeVisible()
})

test("anonymous users can load sign-in after client navigation", async ({ page }) => {
  test.setTimeout(90_000)
  await setupClerkTestingToken({ page })

  await page.goto("/", { waitUntil: "domcontentloaded" })
  await expect(page.locator("script[data-clerk-js-script]")).toHaveCount(1)

  await page.getByRole("link", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(page.locator("[data-clerk-component]")).toBeVisible()
})

test("anonymous users can open the sign-up flow from sign-in", async ({ page }) => {
  test.setTimeout(90_000)
  await setupClerkTestingToken({ page })

  await page.goto("/sign-in", { waitUntil: "domcontentloaded" })
  await expect(page.locator("[data-clerk-component]")).toBeVisible()

  const signUpLink = page.getByRole("link", { name: "Create one" })
  await expect(signUpLink).toHaveCount(1)
  await signUpLink.click()

  await expect(page).toHaveURL(/\/sign-up$/)
  await expect(page.locator("[data-clerk-component]")).toBeVisible()
})

test("anonymous dashboard requests redirect to sign-in", async ({ page }) => {
  test.setTimeout(90_000)
  await setupClerkTestingToken({ page })

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" })
  await page.waitForURL(/\/sign-in\?redirect_url=[^&]*%2Fdashboard/)
})
