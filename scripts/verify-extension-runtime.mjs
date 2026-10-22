import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { chromium } from "@playwright/test"

const extensionPath = path.resolve("artifacts/extension/production")
const userDataDir = await mkdtemp(path.join(os.tmpdir(), "themys-extension-e2e-"))
const futurePayload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3_600 }))
  .toString("base64url")
const fakeToken = `header.${futurePayload}.signature`
const fakeClerkId = "user_forged_extension_e2e"
const sensitiveConsole = []
let context

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

try {
  context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  })

  let workers = context.serviceWorkers()
  if (workers.length === 0) workers = [await context.waitForEvent("serviceworker")]
  const worker = workers[0]
  const extensionId = new URL(worker.url()).host
  assert(Boolean(extensionId), "Production MV3 service worker did not start")

  worker.on("console", (message) => {
    const text = message.text()
    if (text.includes(fakeToken) || text.includes(fakeClerkId)) sensitiveConsole.push(text)
  })

  const unrelated = await context.newPage()
  unrelated.on("console", (message) => {
    const text = message.text()
    if (text.includes(fakeToken) || text.includes(fakeClerkId)) sensitiveConsole.push(text)
  })
  await unrelated.goto("https://example.com/", { waitUntil: "domcontentloaded" })
  await unrelated.evaluate(({ extensionId, token, clerkId }) => {
    if (!globalThis.chrome?.runtime?.sendMessage) return
    chrome.runtime.sendMessage(
      extensionId,
      { type: "SET_AUTH_TOKEN", token, clerkId },
      () => void chrome.runtime.lastError,
    )
  }, { extensionId, token: fakeToken, clerkId: fakeClerkId })
  await unrelated.waitForTimeout(500)

  const afterForgery = await worker.evaluate(async () => chrome.storage.local.get([
    "themys-auth-token",
    "themys-clerk-id",
    "themys-auth-expires-at",
  ]))
  assert(!afterForgery["themys-auth-token"], "Unrelated page replaced the extension auth token")
  assert(!afterForgery["themys-clerk-id"], "Unrelated page replaced the extension Clerk identity")

  const popup = await context.newPage()
  popup.on("console", (message) => {
    const text = message.text()
    if (text.includes(fakeToken) || text.includes(fakeClerkId)) sensitiveConsole.push(text)
  })
  await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`)
  assert(
    await popup.locator("#new-scan-link").getAttribute("href") === "https://themys.ca/scan/new",
    "Production popup scan link does not use the canonical origin",
  )
  assert(
    await popup.locator("#dashboard-link").getAttribute("href") === "https://themys.ca/dashboard",
    "Production popup dashboard link does not use the canonical origin",
  )
  assert(await popup.locator("#not-signed-in").isVisible(), "Signed-out popup state did not render")

  const appPage = await context.newPage()
  await appPage.goto("https://themys.ca/", { waitUntil: "domcontentloaded" })
  await appPage.waitForTimeout(2_500)
  assert(
    await appPage.locator("#themys-overlay-host").count() === 0,
    "The extension prompted on the Themys application origin",
  )

  const expiredStatus = await popup.evaluate(async () => {
    await chrome.storage.local.set({
      "themys-auth-token": "expired.token.value",
      "themys-clerk-id": "user_expired_extension_e2e",
      "themys-auth-expires-at": Date.now() - 1_000,
    })
    return new Promise((resolve) => chrome.runtime.sendMessage({ type: "GET_AUTH_STATUS" }, resolve))
  })
  assert(expiredStatus?.authenticated === false, "Expired auth state was treated as authenticated")
  const afterExpiry = await worker.evaluate(async () => chrome.storage.local.get([
    "themys-auth-token",
    "themys-clerk-id",
    "themys-auth-expires-at",
  ]))
  assert(Object.keys(afterExpiry).length === 0, "Expired auth state was not cleared")

  await popup.evaluate(async ({ token, clerkId }) => {
    await chrome.storage.local.set({
      "themys-auth-token": token,
      "themys-clerk-id": clerkId,
      "themys-auth-expires-at": Date.now() + 3_600_000,
    })
    await chrome.runtime.sendMessage({ type: "SIGN_OUT" })
    await new Promise((resolve) => setTimeout(resolve, 100))
  }, { token: fakeToken, clerkId: fakeClerkId })
  const afterSignOut = await worker.evaluate(async () => chrome.storage.local.get([
    "themys-auth-token",
    "themys-clerk-id",
    "themys-auth-expires-at",
  ]))
  assert(Object.keys(afterSignOut).length === 0, "Sign-out did not clear extension auth state")
  assert(sensitiveConsole.length === 0, "Extension console exposed credential material")

  console.log(`Production MV3 runtime verified: worker, popup, forged origin, expiry, logout, and logs (${extensionId})`)
} finally {
  await context?.close()
  await rm(userDataDir, { recursive: true, force: true })
}
