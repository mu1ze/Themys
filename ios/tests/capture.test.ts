import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"
import vm from "node:vm"

const root = process.cwd()

async function readIos(...parts: string[]) {
  return readFile(join(root, "ios", ...parts), "utf8")
}

test("Safari iOS capture reuses shared detection and does not impersonate the Chrome client header", async () => {
  const [analyze, background, content, spec] = await Promise.all([
    readFile(join(root, "src/app/api/analyze/route.ts"), "utf8"),
    readFile(join(root, "ios/ThemysSafariExtension/Resources/background.js"), "utf8"),
    readFile(join(root, "ios/ThemysSafariExtension/Resources/content.js"), "utf8"),
    readFile(join(root, "docs/superpowers/specs/2026-09-08-ios-safari-capture-design.md"), "utf8"),
  ])
  assert.match(analyze, /themysClientFromRequest/)
  assert.match(analyze, /isOverlayCaptureClient/)
  assert.match(background, /X-Themys-Client": CLIENT/)
  assert.match(background, /safari-ios/)
  assert.doesNotMatch(background, /X-Themys-Client": "extension"/)
  assert.match(content, /showDetectionBadge/)
  assert.match(spec, /Detect and badge/)
})

test("v1 iOS entitlements do not declare a network extension or VPN", async () => {
  const [app, ext, sequel] = await Promise.all([
    readFile(join(root, "ios/Themys/Themys.entitlements"), "utf8"),
    readFile(join(root, "ios/ThemysSafariExtension/ThemysSafariExtension.entitlements"), "utf8"),
    readFile(join(root, "ios/NETWORK_EXTENSION.md"), "utf8"),
  ])
  assert.doesNotMatch(app, /packet-tunnel-provider|networkextension|vpn/i)
  assert.doesNotMatch(ext, /packet-tunnel-provider|networkextension|vpn/i)
  assert.match(sequel, /not v1/i)
})

test("Both native targets declare Clerk shared-session support", async () => {
  const [yml, pbxproj] = await Promise.all([
    readIos("project.yml"),
    readIos("Themys.xcodeproj", "project.pbxproj"),
  ])
  assert.match(yml, /from: "1\.5\.4"/)
  assert.match(yml, /product: ClerkKit/)
  assert.match(yml, /product: ClerkKitUI/)
  assert.doesNotMatch(yml, /0\.73\.0/)
  assert.match(pbxproj, /minimumVersion = 1\.5\.4/)
  assert.match(pbxproj, /productName = ClerkKit/)
  assert.match(pbxproj, /productName = ClerkKitUI/)
  assert.doesNotMatch(pbxproj, /productName = Clerk;/)
})

test("Safari background loads config before startup and uses the two-argument native message signature", async () => {
  const [manifestRaw, background] = await Promise.all([
    readIos("ThemysSafariExtension", "Resources", "manifest.json"),
    readIos("ThemysSafariExtension", "Resources", "background.js"),
  ])
  const manifest = JSON.parse(manifestRaw) as { background: { scripts: string[] } }
  assert.equal(manifest.background.scripts[0], "config.js")
  assert.ok(manifest.background.scripts.includes("background.js"))
  assert.match(background, /sendNativeMessage\(NATIVE_APPLICATION_ID, payload\)/)
  assert.doesNotMatch(background, /sendNativeMessage\(payload\)/)
  assert.match(background, /THEMYS_CONFIG\?\.appOrigin/)
  assert.match(background, /unwrapNativeResponse/)
  assert.match(background, /"="\.repeat\(pad\)/)
})

test("Safari background starts without throwing when config.js is loaded first", async () => {
  const [config, background] = await Promise.all([
    readIos("ThemysSafariExtension", "Resources", "config.js"),
    readIos("ThemysSafariExtension", "Resources", "background.js"),
  ])
  const sandbox: Record<string, unknown> = {
    console: { error() {}, log() {} },
    crypto: { randomUUID: () => "id" },
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    atob: (value: string) => Buffer.from(value, "base64").toString("binary"),
    setTimeout,
    clearTimeout,
  }
  const runtime = {
    sendNativeMessage: async () => ({}),
    onMessage: { addListener() {} },
  }
  sandbox.browser = { runtime, tabs: { sendMessage: async () => {} } }
  sandbox.chrome = sandbox.browser
  sandbox.globalThis = sandbox
  vm.createContext(sandbox)
  vm.runInContext(config, sandbox)
  vm.runInContext(background, sandbox)
  assert.equal((sandbox.globalThis as { THEMYS_CONFIG: { appOrigin: string } }).THEMYS_CONFIG.appOrigin, "https://themys.ca")
})

test("Agreement capture sends the linked Terms URL instead of checkout page text", async () => {
  const content = await readIos("ThemysSafariExtension", "Resources", "content.js")
  assert.match(content, /handlePopupDetected/)
  assert.match(content, /shouldOfferCapture/)
  assert.match(content, /startLinkedTermsScan/)
  assert.match(content, /type: "TOS_DETECTED"/)
  assert.match(content, /THEMYS_POPUP_DETECTED[\s\S]*handlePopupDetected\(event\.data\.payload\)/)
  assert.doesNotMatch(content, /THEMYS_POPUP_DETECTED[\s\S]{0,120}showBadge\(\)/)
})

test("Popup Scan runtime payload uses the linked Terms URL and omits checkout page text", async () => {
  const content = await readIos("ThemysSafariExtension", "Resources", "content.js")
  const sent: unknown[] = []
  const listeners: Array<{ type: string; fn: (event: unknown) => void }> = []
  const sandbox: Record<string, unknown> = {
    console: { error() {}, log() {} },
    document: {
      body: { innerText: "Card number 4111111111111111 checkout form" },
      title: "Checkout",
      querySelectorAll: () => [],
    },
    location: {
      href: "https://shop.example/checkout",
      hostname: "shop.example",
      origin: "https://shop.example",
      pathname: "/checkout",
      search: "",
    },
    MutationObserver: class {
      observe() {}
    },
    URL,
    setTimeout,
    clearTimeout,
  }
  sandbox.window = sandbox
  sandbox.globalThis = sandbox
  sandbox.addEventListener = (type: string, fn: (event: unknown) => void) => {
    listeners.push({ type, fn })
  }
  sandbox.ThemysDetection = {
    TEXT_LIMIT: 5000,
    DISMISS_MS: 86_400_000,
    isExcludedPage: () => false,
    scorePage: () => 0,
    isHighConfidenceLegalPage: () => false,
  }
  sandbox.browser = {
    storage: { local: { get: async () => ({}), set: async () => {} } },
    runtime: {
      sendMessage: async (msg: unknown) => {
        const typed = msg as { type?: string }
        if (typed.type === "GET_PREFS") return { autoDetectEnabled: true }
        sent.push(msg)
        return {}
      },
      onMessage: { addListener() {} },
    },
  }
  sandbox.chrome = sandbox.browser
  vm.createContext(sandbox)
  vm.runInContext(content, sandbox)
  vm.runInContext(
    `window.__themysOverlay = {
      showLoadingOverlay() {},
      showInlineWidget(termsUrl, _type, onScan) { onScan(termsUrl); }
    };`,
    sandbox,
  )
  const contextWindow = vm.runInContext("window", sandbox)
  const messageListener = listeners.find((listener) => listener.type === "message")
  assert.ok(messageListener)
  messageListener!.fn({
    source: contextWindow,
    data: {
      type: "THEMYS_POPUP_DETECTED",
      payload: { termsUrl: "https://shop.example/terms", detectionType: "checkbox" },
    },
  })
  const started = Date.now()
  while (sent.length === 0 && Date.now() - started < 200) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert.equal(sent.length, 1)
  const payload = JSON.parse(JSON.stringify(sent[0])) as { type: string; url: string; domain: string; text?: string }
  assert.equal(payload.type, "TOS_DETECTED")
  assert.equal(payload.url, "https://shop.example/terms")
  assert.equal(payload.domain, "shop.example")
  assert.equal(payload.text, undefined)
  assert.ok(!JSON.stringify(payload).includes("4111111111111111"))
})

test("Popup detection honors Detect Terms being disabled and origin dismissal", async () => {
  const content = await readIos("ThemysSafariExtension", "Resources", "content.js")
  assert.match(
    content,
    /async function shouldOfferCapture\(\) \{[\s\S]*autoDetectEnabled[\s\S]*isOriginDismissed/,
  )
  assert.match(
    content,
    /async function handlePopupDetected\([\s\S]*shouldOfferCapture\(\)/,
  )
})

test("Shared session stays in Keychain and uses the JWT expiry rather than a fake 50-minute window", async () => {
  const [bridge, auth, app] = await Promise.all([
    readIos("Shared", "SessionBridge.swift"),
    readIos("Themys", "AuthController.swift"),
    readIos("Themys", "ThemysApp.swift"),
  ])
  assert.match(bridge, /clearLegacyDefaults/)
  assert.match(bridge, /jwtExpiry/)
  assert.doesNotMatch(bridge, /defaults\?\.set\(token/)
  assert.match(auth, /isLoaded/)
  assert.match(auth, /waitUntilClerkLoaded/)
  assert.match(auth, /auth\.events/)
  assert.match(auth, /tokenRefreshed/)
  assert.match(auth, /getToken/)
  assert.match(auth, /handleOpenURL/)
  assert.match(auth, /Clerk\.shared\.handle\(url\)/)
  assert.doesNotMatch(auth, /50 \* 60/)
  assert.match(app, /auth\.handleOpenURL/)
  assert.match(app, /\.environment\(Clerk\.shared\)/)
  assert.match(await readIos("Themys", "RootView.swift"), /isAuthFlowComplete/)
})

test("Empty credits 402 responses are decoded instead of shown as an error", async () => {
  const api = await readIos("Themys", "ThemysAPI.swift")
  assert.match(api, /allowedStatuses: \[200, 402\]/)
  assert.match(api, /limit-check/)
})

test("Native scan auth reloads Clerk shared identity instead of a saved JWT", async () => {
  const [bridge, handler, project] = await Promise.all([
    readIos("Shared", "SessionBridge.swift"),
    readIos("ThemysSafariExtension", "SafariWebExtensionHandler.swift"),
    readIos("project.yml"),
  ])
  assert.match(bridge, /sharedSessionSync: \.enabled/)
  assert.match(bridge, /reloadFromSharedStorage\(\)/)
  assert.match(bridge, /skipCache: true/)
  assert.match(handler, /try await ClerkSession.token\(\)/)
  assert.doesNotMatch(handler, /SessionBridge.read\(\)|context.open\(/)
  assert.match(project, /ThemysSafariExtension:\n    dependencies:[\s\S]*product: ClerkKit/)
})

test("Safari Sign in opens the app directly even when extension messaging is available", async () => {
  let click: (() => void) | undefined
  let removed = false
  const messages: unknown[] = []
  const shadow = {
    appendChild() {},
    getElementById: () => ({ addEventListener: (_: string, fn: () => void) => { click = fn } }),
  }
  const location = { href: "https://shop.example/checkout?a=1&b=2" }
  const sandbox = vm.createContext({
    location,
    THEMYS_CONFIG: { platform: "safari-ios", appScheme: "themys" },
    browser: { runtime: { sendMessage: (msg: unknown) => messages.push(msg) } },
    document: {
      getElementById: () => null,
      body: { appendChild() {} },
      createElement: () => ({ attachShadow: () => shadow, remove: () => { removed = true } }),
    },
  })
  vm.runInContext("window = globalThis; self = globalThis", sandbox)
  vm.runInContext(await readIos("ThemysSafariExtension", "Resources", "overlay.js"), sandbox)
  vm.runInContext("window.__themysOverlay.showAuthRequired()", sandbox)
  assert.ok(click)
  click()
  const target = new URL(location.href)
  assert.equal(target.protocol, "themys:")
  assert.equal(target.host, "sign-in")
  assert.equal(target.searchParams.get("return"), "https://shop.example/checkout?a=1&b=2")
  assert.equal(messages.length, 0)
  assert.equal(removed, false, "Keep sign-in available if opening is cancelled")
})

test("Safari popup dismissal suppresses the whole origin for exactly 24 hours", async () => {
  const sandbox = vm.createContext({ URL, console })
  vm.runInContext(`
    var now = 100000000;
    var originalDate = Date;
    Date = class extends originalDate { static now() { return now; } };
    var stored = {}, widgets = 0, dismiss;
    window = globalThis;
    location = { href: "https://shop.example/checkout", origin: "https://shop.example", hostname: "shop.example" };
    document = { body: { innerText: "Checkout" } };
    ThemysDetection = { TEXT_LIMIT: 1000, DISMISS_MS: 86400000, isExcludedPage: () => true };
    MutationObserver = class { observe() {} };
    addEventListener = () => {};
    __themysOverlay = { showInlineWidget(url, type, scan, onDismiss) { widgets++; dismiss = onDismiss; } };
    browser = {
      storage: { local: { get: async () => stored, set: async value => Object.assign(stored, value) } },
      runtime: { sendMessage: async () => ({ autoDetectEnabled: true }), onMessage: { addListener() {} } }
    };
  `, sandbox)
  vm.runInContext(await readIos("ThemysSafariExtension", "Resources", "content.js"), sandbox)
  await vm.runInContext('handlePopupDetected({termsUrl: "https://shop.example/terms"})', sandbox)
  vm.runInContext('dismiss("https://shop.example/terms")', sandbox)
  await new Promise<void>((resolve) => setImmediate(resolve))
  await vm.runInContext('handlePopupDetected({termsUrl: "https://shop.example/privacy"})', sandbox)
  assert.equal(vm.runInContext("widgets", sandbox), 1)
  vm.runInContext("now += 86400000", sandbox)
  await vm.runInContext('handlePopupDetected({termsUrl: "https://shop.example/privacy"})', sandbox)
  assert.equal(vm.runInContext("widgets", sandbox), 2)
  vm.runInContext("stored.autoDetectEnabled = false; now += 86400000", sandbox)
  await vm.runInContext('handlePopupDetected({termsUrl: "https://shop.example/other-terms"})', sandbox)
  assert.equal(vm.runInContext("widgets", sandbox), 2)
})

test("Native refresh errors produce retryable scan errors, not unhandled promises", async () => {
  const sandbox = vm.createContext({ console, URL, atob })
  vm.runInContext(`
    var receive, replies = [];
    browser = { runtime: {
      sendNativeMessage: async () => ({ ok: false, error: "session_unavailable" }),
      onMessage: { addListener(fn) { receive = fn; } }
    }, tabs: { sendMessage: async (id, msg) => replies.push(msg) } };
  `, sandbox)
  vm.runInContext(await readIos("ThemysSafariExtension", "Resources", "background.js"), sandbox)
  vm.runInContext('receive({type: "SCAN_PAGE", url: "https://example.com/terms"}, {tab: {id: 1}}, () => {})', sandbox)
  await new Promise<void>((resolve) => setImmediate(resolve))
  assert.equal(vm.runInContext("replies[0].type", sandbox), "SCAN_ERROR")
})

test("Safari native responses unwrap message wrappers and JWT exp decoding pads base64", async () => {
  const background = await readIos("ThemysSafariExtension", "Resources", "background.js")
  const sandbox: Record<string, unknown> = {
    console: { error() {}, log() {} },
    crypto: { randomUUID: () => "id" },
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    atob: (value: string) => Buffer.from(value, "base64").toString("binary"),
    setTimeout,
    clearTimeout,
    browser: {
      runtime: { sendNativeMessage: async () => ({}), onMessage: { addListener() {} } },
      tabs: { sendMessage: async () => {} },
    },
  }
  sandbox.chrome = sandbox.browser
  sandbox.globalThis = sandbox
  vm.createContext(sandbox)
  vm.runInContext(`globalThis.THEMYS_CONFIG = { appOrigin: "https://themys.ca" };`, sandbox)
  vm.runInContext(background, sandbox)
  const wrapped = vm.runInContext(
    `unwrapNativeResponse({ message: { ok: true, token: "abc" } })`,
    sandbox,
  ) as { token: string }
  assert.equal(wrapped.token, "abc")
  const direct = vm.runInContext(
    `unwrapNativeResponse({ ok: true, autoDetectEnabled: false })`,
    sandbox,
  ) as { autoDetectEnabled: boolean }
  assert.equal(direct.autoDetectEnabled, false)
  const paddedExp = vm.runInContext(
    `tokenExpiresAt("eyJhbGciOiJub25lIn0.eyJleHAiOjIwMDAwMDAwMDB9.x")`,
    sandbox,
  )
  assert.equal(paddedExp, 2_000_000_000_000)
})

test("iOS control center exposes Safari prompts, scan preferences, and billing", async () => {
  const [settings, api] = await Promise.all([
    readIos("Themys", "SettingsScreen.swift"),
    readIos("Themys", "ThemysAPI.swift"),
  ])

  assert.match(settings, /navigationTitle\("Control Center"\)/)
  assert.match(settings, /Offer scans on legal pages/)
  assert.match(settings, /Playbook & custom clauses/)
  assert.match(settings, /Manage subscription/)
  assert.match(settings, /components\.fragment = "subscription"/)
  assert.match(settings, /Only show watch-list matches/)
  assert.match(api, /static func profile\(\)/)
  assert.match(api, /static func updateProfile\(/)
  assert.match(api, /"X-Themys-Client"/)
})
