import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

const root = process.cwd()
const read = (file: string) => readFile(join(root, file), "utf8")

test("macOS Safari ships a browser-compatible web extension target", async () => {
  const [manifestRaw, config, background, content, syncScript] = await Promise.all([
    read("macos/ThemysSafariExtension/Resources/manifest.json"),
    read("macos/ThemysSafariExtension/Resources/config.js"),
    read("macos/ThemysSafariExtension/Resources/background.js"),
    read("macos/ThemysSafariExtension/Resources/content.js"),
    read("scripts/sync-macos-safari-extension.mjs"),
  ])
  const manifest = JSON.parse(manifestRaw) as {
    permissions: string[]
    externally_connectable: { matches: string[] }
    background: { scripts: string[] }
    content_scripts: Array<{ js: string[] }>
  }
  assert.deepEqual(manifest.permissions.sort(), ["alarms", "storage", "tabs"])
  assert.deepEqual(manifest.externally_connectable.matches, ["https://themys.ca/*"])
  assert.deepEqual(manifest.background.scripts, ["config.js", "background.js"])
  assert.ok(manifest.content_scripts[0].js.includes("detection/themys-capture-policy.js"))
  assert.match(config, /"platform": "safari-macos"/)
  assert.match(background, /X-Themys-Client.*extension/)
  assert.match(background, /handleTextScan/)
  assert.match(background, /refreshAuthToken/)
  assert.match(background, /onMessageExternal/)
  assert.match(background, /SET_AUTH_TOKEN/)
  assert.match(content, /typeof browser !== "undefined" \? browser : globalThis\.chrome/)
  assert.match(syncScript, /artifacts", "extension", process\.env\.THEMYS_MACOS_ARTIFACT/)
})
