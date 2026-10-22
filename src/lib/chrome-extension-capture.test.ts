import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

const root = process.cwd()

async function read(relativePath: string) {
  return readFile(join(root, relativePath), "utf8")
}

test("Chrome content scripts load capture policy before content.js and default auto-scan off", async () => {
  const [manifest, content, optionsHtml, optionsJs] = await Promise.all([
    read("extension/manifest.json"),
    read("extension/content.js"),
    read("extension/options/options.html"),
    read("extension/options/options.js"),
  ])
  const parsed = JSON.parse(manifest) as { content_scripts: Array<{ js: string[] }> }
  const scripts = parsed.content_scripts[0].js
  assert.ok(scripts.includes("detection/themys-capture-policy.js"))
  assert.ok(
    scripts.indexOf("detection/themys-capture-policy.js") < scripts.indexOf("content.js"),
    "capture policy must load before content.js",
  )
  assert.match(content, /ThemysCapturePolicy/)
  assert.match(content, /isAutoScanEnabled/)
  assert.match(content, /showDetectionBadge/)
  assert.match(content, /location\.origin === globalThis\.THEMYS_CONFIG\.appOrigin/)
  assert.match(content, /afterAuthAction/)
  assert.match(optionsJs, /ThemysCapturePolicy/)
  assert.match(optionsJs, /DEFAULT_AUTO_SCAN_ENABLED/)
  assert.doesNotMatch(optionsHtml, /id="auto-scan-toggle" checked/)
  assert.match(optionsHtml, /id="auto-scan-toggle"/)
})

test("onboarding persists complete and first-install does not reset a finished wizard", async () => {
  const [onboarding, background] = await Promise.all([
    read("extension/onboarding/onboarding.js"),
    read("extension/background.js"),
  ])
  assert.match(onboarding, /persistOnboardingStep/)
  assert.match(onboarding, /completeOnboarding/)
  assert.doesNotMatch(onboarding, /saveState\(\{\s*complete:\s*false,\s*step:\s*index\s*\}\)/)
  assert.match(background, /shouldOpenOnboarding/)
  assert.match(background, /completeOnboarding/)
  assert.doesNotMatch(
    background,
    /chrome\.storage\.local\.set\(\s*\{\s*'themys-onboarding':\s*\{\s*complete:\s*false/,
  )
})

test("sign-in stays on extension-auth and returns to the originating tab", async () => {
  const [authPage, background, popup] = await Promise.all([
    read("src/app/extension-auth/page.tsx"),
    read("extension/background.js"),
    read("extension/popup/popup.js"),
  ])
  assert.match(authPage, /forceRedirectUrl/)
  assert.match(authPage, /signUpForceRedirectUrl/)
  assert.match(background, /OPEN_AUTH/)
  assert.match(background, /authReturnTabId/)
  assert.match(background, /tabs\.update\(authReturnTabId/)
  assert.match(popup, /OPEN_AUTH/)
  assert.doesNotMatch(popup, /auth\/auth\.html/)
})

test("overlay and extension pages use the web near-black accent instead of blue", async () => {
  const [overlay, popupCss, optionsCss] = await Promise.all([
    read("extension/overlay.js"),
    read("extension/popup/popup.css"),
    read("extension/options/options.css"),
  ])
  assert.match(overlay, /#17191c/)
  assert.match(popupCss, /#17191c/)
  assert.match(optionsCss, /#17191c/)
  assert.doesNotMatch(overlay, /background:#2563eb/)
  assert.doesNotMatch(popupCss, /background: #2563eb/)
})

test("extension overlay mirrors the web result views and disclosure-row contract", async () => {
  const [overlay, builder, popupDetector, popup, scanRoute] = await Promise.all([
    read("extension/overlay.js"),
    read("scripts/build-extension.mjs"),
    read("extension/popup-detector.js"),
    read("extension/popup/popup.js"),
    read("src/app/api/scans/[id]/route.ts"),
  ])

  for (const tab of ["summary", "flagged", "suggestions", "compliance", "extraction"]) {
    assert.match(overlay, new RegExp(`id: '${tab}'`))
  }
  assert.match(overlay, /className = 'result-item'/)
  assert.match(overlay, /What the document says/)
  assert.match(overlay, /In plain English/)
  assert.match(overlay, /Why it matters/)
  assert.match(overlay, /Next step/)
  assert.match(overlay, /candidate\.open = false/)
  assert.match(builder, /await cp\(resolve\(root, "extension"\), output/)
  assert.match(builder, /packages", "tos-detection", "themys-detection\.js"/)
  assert.match(popupDetector, /location\.origin === globalThis\.THEMYS_CONFIG\.appOrigin/)
  assert.match(popup, /whyItMatters: c\.whyItMatters/)
  assert.match(popup, /recommendedAction: c\.recommendedAction/)
  assert.match(popup, /complianceTags: tagsByClause\[c\.id\]/)
  assert.match(popup, /pushback: flaggedClauses/)
  assert.match(scanRoute, /x-themys-client.+extension/)
  assert.match(scanRoute, /getComplianceTagsForScan/)
})

test("extension options are a self-contained control center with safe billing handoff", async () => {
  const [manifestRaw, optionsHtml, optionsJs, background] = await Promise.all([
    read("extension/manifest.json"),
    read("extension/options/options.html"),
    read("extension/options/options.js"),
    read("extension/background.js"),
  ])
  const manifest = JSON.parse(manifestRaw) as { options_ui?: { page?: string; open_in_tab?: boolean } }

  assert.deepEqual(manifest.options_ui, {
    page: "options/options.html",
    open_in_tab: true,
  })
  assert.match(optionsHtml, /Themys Control Center/)
  assert.match(optionsHtml, /data-section="scanning"/)
  assert.match(optionsHtml, /data-section="clauses"/)
  assert.match(optionsHtml, /data-section="account"/)
  assert.match(optionsHtml, /id="manage-plan-link"/)
  assert.match(optionsJs, /settings#subscription/)
  assert.match(optionsJs, /storageSet\(\{ autoScanEnabled: state\.autoScanEnabled \}\)/)
  assert.match(optionsJs, /UPDATE_PROFILE/)
  assert.match(optionsJs, /beforeunload/)
  assert.match(background, /SIGN_OUT[\s\S]*sendResponse\(\{ success: true \}\)/)
})
