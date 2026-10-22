import { execFile } from "node:child_process"
import { promisify } from "node:util"

import { expect, test } from "@playwright/test"

const execFileAsync = promisify(execFile)
const runExtension = process.env.RUN_EXTENSION_E2E === "1"

test.describe("extension auth page", () => {
  test("return param sends auth token only to the named extension", async ({ page }) => {
    test.setTimeout(60_000)

    await page.addInitScript(() => {
      const state = window as typeof window & {
        __themysAuthMessage?: Record<string, unknown>
        __themysBroadcastTokenSeen?: boolean
        chrome?: unknown
      }
      window.addEventListener("message", (event) => {
        if (event.data?.token) state.__themysBroadcastTokenSeen = true
      })
      Object.defineProperty(state, "chrome", {
        configurable: true,
        value: {
          runtime: {
            sendMessage(
              _extensionId: string,
              message: Record<string, unknown>,
              callback: (response: { ok: boolean }) => void,
            ) {
              state.__themysAuthMessage = message
              callback({ ok: true })
            },
          },
        },
      })
    })

    await page.goto(
      "/extension-auth?extension_id=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&return=https://example.com",
      { waitUntil: "domcontentloaded" },
    )

    await expect
      .poll(async () => page.evaluate(() => Boolean(
        (window as typeof window & { __themysAuthMessage?: { token?: unknown } })
          .__themysAuthMessage?.token,
      )))
      .toBe(true)

    expect(await page.evaluate(() => (
      window as typeof window & { __themysBroadcastTokenSeen?: boolean }
    ).__themysBroadcastTokenSeen ?? false)).toBe(false)

    expect(page.url()).toContain("/extension-auth")
    expect(page.url()).not.toContain("example.com")
  })
})

test.describe("packaged extension authenticated journeys", () => {
  test.skip(!runExtension, "Set RUN_EXTENSION_E2E=1 after building the development extension artifact")

  test("auth bridge, popup, history, profile, monitoring, and sign-out work", async () => {
    test.setTimeout(120_000)
    const result = await execFileAsync(process.execPath, ["scripts/verify-extension-auth.mjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
        THEMYS_EXTENSION_ENVIRONMENT: "development",
      },
      timeout: 110_000,
      maxBuffer: 1024 * 1024,
    })

    expect(result.stdout).toContain("extension verified against")
  })
})
