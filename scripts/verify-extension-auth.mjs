import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { chromium } from "@playwright/test"
import dotenv from "dotenv"
import { createCloudflareD1AdminClient } from "./lib/cloudflare-admin.mjs"

dotenv.config({ path: ".env" })

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
const extensionEnvironment = process.env.THEMYS_EXTENSION_ENVIRONMENT ?? "development"
if (!["development", "staging", "production"].includes(extensionEnvironment)) {
  throw new Error(`Unsupported extension environment: ${extensionEnvironment}`)
}
const extensionPath = path.resolve("artifacts", "extension", extensionEnvironment)
const extensionConfig = await readFile(path.join(extensionPath, "config.js"), "utf8")
const configuredOrigin = extensionConfig.match(/"appOrigin":\s*"([^"]+)"/)?.[1]
if (!configuredOrigin || configuredOrigin !== new URL(baseUrl).origin) {
  throw new Error(
    `Extension artifact origin ${configuredOrigin ?? "(missing)"} does not match ${new URL(baseUrl).origin}`,
  )
}
const storageStatePath = path.resolve("e2e/.auth/user.json")
const userDataDir = await mkdtemp(path.join(os.tmpdir(), "themys-extension-auth-e2e-"))
const state = JSON.parse(await readFile(storageStatePath, "utf8"))
const targetUrl = new URL(baseUrl)
const isRemoteTarget = targetUrl.hostname !== "localhost" && targetUrl.hostname !== "127.0.0.1"
if (isRemoteTarget && process.env.ALLOW_REMOTE_CLERK_COOKIE_REMAP !== "1") {
  throw new Error("Set ALLOW_REMOTE_CLERK_COOKIE_REMAP=1 to authorize sending the saved test session to the configured HTTPS app origin")
}
if (isRemoteTarget && targetUrl.protocol !== "https:") {
  throw new Error("Remote Clerk test sessions may only be remapped to HTTPS origins")
}
const targetCookies = (state.cookies ?? []).map((cookie) =>
  cookie.domain === "localhost"
    ? {
        ...cookie,
        domain: targetUrl.hostname,
        secure: targetUrl.protocol === "https:",
      }
    : cookie,
)
const marker = crypto.randomUUID()
const monitorUrl = `https://1.1.1.1/terms?themys-extension-e2e=${marker}`
const scanUrl = `https://www.cloudflare.com/website-terms/?themys-extension-scan-e2e=${marker}`
const runLiveProvider = process.env.RUN_LIVE_PROVIDER_E2E === "1"
const database = process.env.CLOUDFLARE_ACCOUNT_ID
  && process.env.CLOUDFLARE_D1_DATABASE_ID
  && process.env.CLOUDFLARE_API_TOKEN
  ? createCloudflareD1AdminClient()
  : null
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
  await context.addCookies(targetCookies)

  let workers = context.serviceWorkers()
  if (workers.length === 0) workers = [await context.waitForEvent("serviceworker")]
  const worker = workers[0]
  const extensionId = new URL(worker.url()).host
  assert(Boolean(extensionId), "Development MV3 service worker did not start")

  const authPage = await context.newPage()
  await authPage.goto(`${baseUrl}/extension-auth?extension_id=${encodeURIComponent(extensionId)}`)
  await authPage.getByRole("heading", { name: "Signed in successfully!" }).waitFor({ timeout: 30_000 })

  const storedAuth = await worker.evaluate(async () => chrome.storage.local.get([
    "themys-auth-token",
    "themys-clerk-id",
    "themys-auth-expires-at",
  ]))
  assert(typeof storedAuth["themys-auth-token"] === "string", "Auth bridge did not store a Clerk token")
  assert(typeof storedAuth["themys-clerk-id"] === "string", "Auth bridge did not store the Clerk identity")
  assert(
    Number(storedAuth["themys-auth-expires-at"]) > Date.now(),
    "Auth bridge stored an expired token",
  )

  const popup = await context.newPage()
  await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`)
  await popup.locator("#history-section").waitFor({ state: "visible", timeout: 10_000 })
  assert(await popup.locator("#not-signed-in").isHidden(), "Authenticated popup still shows signed-out state")

  const history = await popup.evaluate(async () => new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "FETCH_HISTORY" }, resolve)
  }))
  assert(!history?.error && Array.isArray(history?.scans), "Extension history request failed")

  const profile = await popup.evaluate(async () => new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_PROFILE" }, resolve)
  }))
  assert(profile?.success === true && profile.profile, "Extension profile request failed")

  const beforeMonitor = await popup.evaluate(async (url) => new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "MONITOR_CHECK", url }, resolve)
  }), monitorUrl)
  assert(beforeMonitor?.monitored === false, "Fresh extension monitoring fixture was already subscribed")

  const subscribed = await popup.evaluate(async (url) => new Promise((resolve) => {
    chrome.runtime.sendMessage({
      type: "MONITOR_TOGGLE",
      action: "subscribe",
      url,
      domain: "1.1.1.1",
      title: "Extension authentication E2E",
    }, resolve)
  }), monitorUrl)
  assert(subscribed?.ok === true && subscribed.data?.subscription?.id, "Extension monitoring subscribe failed")

  const afterMonitor = await popup.evaluate(async (url) => new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "MONITOR_CHECK", url }, resolve)
  }), monitorUrl)
  assert(afterMonitor?.monitored === true, "Extension monitoring status did not reflect subscription")

  const unsubscribed = await popup.evaluate(async (subscriptionId) => new Promise((resolve) => {
    chrome.runtime.sendMessage({
      type: "MONITOR_TOGGLE",
      action: "unsubscribe",
      subscriptionId,
    }, resolve)
  }), subscribed.data.subscription.id)
  assert(unsubscribed?.ok === true, "Extension monitoring unsubscribe failed")

  if (runLiveProvider) {
    const termsPage = await context.newPage()
    await termsPage.goto(scanUrl, { waitUntil: "domcontentloaded", timeout: 45_000 })
    await termsPage.waitForFunction(() => {
      const host = document.getElementById("themys-overlay-host")
      return Boolean(host?.shadowRoot?.querySelector(".risk-badge"))
    }, undefined, { timeout: 120_000 })
    const riskBadge = await termsPage.evaluate(() => {
      const host = document.getElementById("themys-overlay-host")
      return host?.shadowRoot?.querySelector(".risk-badge")?.textContent ?? ""
    })
    assert(/^\d+(?:\.\d+)?\/10$/.test(riskBadge), `Extension scan rendered an invalid risk badge: ${riskBadge}`)
    const lastScan = await worker.evaluate(async () => {
      const value = await chrome.storage.local.get("themys-last-scan")
      return value["themys-last-scan"]
    })
    assert(typeof lastScan?.riskScore === "number", "Extension scan did not persist its popup result")
  }

  await popup.evaluate(async () => {
    await chrome.runtime.sendMessage({ type: "SIGN_OUT" })
    await new Promise((resolve) => setTimeout(resolve, 100))
  })
  const afterSignOut = await worker.evaluate(async () => chrome.storage.local.get([
    "themys-auth-token",
    "themys-clerk-id",
    "themys-auth-expires-at",
  ]))
  assert(Object.keys(afterSignOut).length === 0, "Authenticated extension sign-out did not clear storage")

  console.log(
    `${extensionEnvironment} extension verified against ${baseUrl}: Clerk bridge, history, profile, monitoring, popup, logout${runLiveProvider ? ", and live scan" : ""}`,
  )
} finally {
  if (database) {
    await database.from("monitoring_subscriptions").delete().eq("url", monitorUrl)
    await database.from("scans").delete().eq("url", scanUrl)
  }
  await context?.close()
  await rm(userDataDir, { recursive: true, force: true })
}
