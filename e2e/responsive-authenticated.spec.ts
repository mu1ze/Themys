import { expect, test } from "@playwright/test"

const widths = [320, 375, 390, 768, 1024, 1440]
const routes = ["/dashboard", "/history", "/scan/results", "/settings", "/monitoring", "/dashboard/developer"]
const themes = ["light", "dark"] as const

for (const width of widths) {
  for (const theme of themes) {
    test(`authenticated pages fit ${width}px in ${theme} mode`, async ({ page }) => {
      test.setTimeout(90_000)
      await page.setViewportSize({ width, height: width <= 390 ? 812 : 900 })
      await page.addInitScript((selectedTheme) => {
        window.localStorage.setItem("themys-theme", selectedTheme)
      }, theme)

      const errors: string[] = []
      page.on("pageerror", (error) => errors.push(error.message))
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text())
      })

      for (const route of routes) {
        await page.goto(route, { waitUntil: "domcontentloaded" })
        await expect(page).toHaveURL(new RegExp(route.replace("/", "\\/")))
        await expect(page.locator("body")).toBeVisible()
        const overflow = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }))
        expect(overflow.scrollWidth, `${route} overflowed at ${width}px`).toBeLessThanOrEqual(overflow.clientWidth + 1)
      }

      expect(errors, `browser errors at ${width}px in ${theme} mode`).toEqual([])
    })
  }
}

test("mobile scan details remain usable when scan data is available", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto("/scan/results", { waitUntil: "domcontentloaded" })
  const mobileNav = page.getByRole("navigation", { name: /result views/i })
  if (await mobileNav.count()) {
    await expect(mobileNav).toBeVisible()
    await expect(mobileNav.getByRole("button", { name: /flagged/i })).toBeVisible()
    await mobileNav.getByRole("button", { name: /flagged/i }).click()
    await expect(page.getByRole("heading", { name: /flagged clauses/i })).toBeVisible()
  } else {
    await expect(page.getByText(/no scan data yet/i)).toBeVisible()
  }
})
