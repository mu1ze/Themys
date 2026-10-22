import { expect, test } from "@playwright/test"

test.use({ storageState: { cookies: [], origins: [] } })

const publicRoutes: { path: string; url?: string; heading: string }[] = [
  { path: "/", heading: "All your fine print, one clear briefing." },
  { path: "/pricing", heading: "Simple, transparent pricing" },
  {
    path: "/features",
    heading: "Scan a terms of service, review every clause, and track what changes.",
  },
  { path: "/", url: `${process.env.DOCS_BASE_URL ?? "https://docs.themys.ca"}/`, heading: "Documentation" },
  { path: "/quick-start", url: `${process.env.DOCS_BASE_URL ?? "https://docs.themys.ca"}/quick-start/`, heading: "Getting Started with Themys" },
  { path: "/legal", url: `${process.env.DOCS_BASE_URL ?? "https://docs.themys.ca"}/legal`, heading: "Privacy, clearly stated." },
  { path: "/sign-in", heading: "Know what you agree to" },
  { path: "/sign-up", heading: "Know what you agree to" },
] as const

const protectedRoutes = [
  "/dashboard",
  "/history",
  "/scan/new",
  "/scan/results",
  "/settings",
  "/monitoring",
  "/dashboard/developer",
] as const

test.beforeAll(({ baseURL }) => {
  expect(baseURL, "Production smoke tests require PLAYWRIGHT_BASE_URL").toBeTruthy()
  const target = new URL(baseURL!)
  expect(target.protocol, "Production smoke tests require HTTPS").toBe("https:")
  expect(["localhost", "127.0.0.1"]).not.toContain(target.hostname)
})

for (const route of publicRoutes) {
  test(`${route.url ?? route.path} renders without browser errors`, async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text())
    })

    const response = await page.goto(route.url ?? route.path, { waitUntil: "domcontentloaded" })
    expect(response?.status()).toBe(200)
    await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible()
    expect(errors).toEqual([])
  })
}

for (const route of protectedRoutes) {
  test(`${route} redirects anonymous users to sign in`, async ({ page, baseURL }) => {
    await page.goto(route, { waitUntil: "domcontentloaded" })

    const current = new URL(page.url())
    expect(current.pathname).toBe("/sign-in")
    expect(current.searchParams.get("redirect_url")).toBe(new URL(route, baseURL!).href)
  })
}

test("anonymous production APIs reject protected operations", async ({ request }) => {
  const checks = await Promise.all([
    request.get("/api/monitor"),
    request.get("/api/monitor/alerts"),
    request.get("/api/developer/keys"),
    request.post("/api/analyze", { data: { text: "Production smoke test" } }),
  ])

  expect(checks.map((response) => response.status())).toEqual([401, 401, 401, 401])
})

test("homepage claims and legal links match the launch copy", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" })

  for (const unsupportedClaim of ["97%", "18 min", "70+"]) {
    await expect(page.getByText(unsupportedClaim, { exact: true })).toHaveCount(0)
  }

  await expect(page.getByRole("link", { name: "Privacy" })).toHaveAttribute(
    "href",
    "https://docs.themys.ca/legal#privacy",
  )
  await expect(page.getByRole("link", { name: "Terms" })).toHaveAttribute(
    "href",
    "https://docs.themys.ca/legal#terms",
  )
})
