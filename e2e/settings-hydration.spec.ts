import { expect, test } from "@playwright/test"

for (const section of ["profile", "accounts", "account"] as const) {
  test(`settings ${section} deep link hydrates without React errors`, async ({ page }) => {
    const errors: string[] = []

    page.on("pageerror", (error) => errors.push(error.message))
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text())
    })

    await page.goto(`/settings#${section}`, { waitUntil: "networkidle" })
    await expect(page).toHaveURL(new RegExp(`/settings#${section}$`))
    await expect(page.getByRole("tabpanel")).toBeVisible()

    expect(errors).toEqual([])
  })
}

test("header account menu navigates to custom settings without hydration errors", async ({ page }) => {
  const errors: string[] = []

  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text())
  })

  await page.goto("/dashboard", { waitUntil: "networkidle" })
  await page.locator(".cl-userButtonTrigger").click()
  await page.getByText("Manage account", { exact: true }).click()
  await expect(page).toHaveURL(/\/settings#profile$/)
  await expect(page.getByRole("tabpanel")).toBeVisible()

  expect(errors).toEqual([])
})
