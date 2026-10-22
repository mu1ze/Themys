import { expect, test } from "@playwright/test"
import { setupClerkTestingToken } from "@clerk/testing/playwright"

const widths = [320, 375, 390, 768, 1024, 1440]
const routes = ["/", "/pricing", "/sign-in", "/sign-up"]
const themes = ["light", "dark"] as const

test.use({ storageState: { cookies: [], origins: [] } })

for (const width of widths) {
  for (const theme of themes) {
    test(`public pages fit ${width}px in ${theme} mode`, async ({ page }) => {
      test.setTimeout(90_000)
      await page.setViewportSize({ width, height: width <= 390 ? 812 : 900 })
      await page.addInitScript((selectedTheme) => {
        window.localStorage.setItem("themys-theme", selectedTheme)
      }, theme)
      await setupClerkTestingToken({ page })

      const errors: string[] = []
      page.on("pageerror", (error) => errors.push(error.message))
      page.on("console", (message) => {
        if (message.type() !== "error") return
        const location = message.location().url
        const isLocalHttpsPrefetch =
          message.text().includes("net::ERR_SSL_PROTOCOL_ERROR") &&
          /^https:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/sign-in\?redirect_url=/.test(location)
        if (!isLocalHttpsPrefetch) errors.push(`${message.text()} (${location || "unknown source"})`)
      })

      for (const route of routes) {
        await page.goto(route, { waitUntil: "domcontentloaded" })
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

test("mobile public navigation is keyboard reachable", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto("/", { waitUntil: "domcontentloaded" })
  for (let index = 0; index < 8; index += 1) await page.keyboard.press("Tab")
  const focusable = await page.evaluate(() => {
    const element = document.activeElement
    return element instanceof HTMLElement && element !== document.body && !element.hasAttribute("disabled")
  })
  expect(focusable).toBe(true)
})
