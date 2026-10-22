import { lstat, readFile, readdir } from "node:fs/promises"
import { relative, resolve } from "node:path"

const root = process.cwd()
const forbiddenOrigins = [/https?:\/\/(?:www\.)?themys\.com/i, /https?:\/\/(?:www\.)?themys\.ai/i]
const allowedLocalFiles = new Set([
  "README.md",
  "DEPLOYMENT.md",
  "ENVIRONMENTS.md",
  "development.md",
  "extension/README.md",
  "extension/config.js",
  "extension/manifest.json",
  "e2e/extension-auth.spec.ts",
  "playwright.config.ts",
  "scripts/build-extension.mjs",
  "scripts/verify-extension-auth.mjs",
  "scripts/verify-monitoring-cron.mjs",
  "scripts/verify-release-config.mjs",
  "scripts/verify-security-runtime.mjs",
  "scripts/verify-urgent-runtime.mjs",
  "docs/src/app/content/api-overview.md",
  "docs/src/app/content/webhooks.md",
  "src/lib/app-origin.test.ts",
  "src/lib/app-origin.ts",
])

function allowsLocalOrigin(name) {
  if (allowedLocalFiles.has(name)) return true
  if (/\.(?:test|spec)\.(?:js|ts|tsx|mjs)$/.test(name)) return true
  if (name.startsWith("scripts/") && name.endsWith(".mjs")) return true
  return false
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if ([".auth", ".git", ".kilo", ".hermes", ".commandcode", ".private", ".next", ".open-next", ".wrangler", ".superpowers", "artifacts", "audit-report", "node_modules", "playwright-report", "test-results"].includes(entry.name)) continue
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(path))
    else files.push(path)
  }
  return files
}

const files = await walk(root)
const sourceFiles = files.filter((file) => /\.(?:js|mjs|ts|tsx|json|jsonc|md)$/.test(file))
for (const file of sourceFiles) {
  const name = relative(root, file)
  const content = await readFile(file, "utf8")
  if (forbiddenOrigins.some((pattern) => pattern.test(content))) {
    throw new Error(`${name} contains a deprecated Themys origin`)
  }
  if (/localhost:3000|127\.0\.0\.1:3000/.test(content) && !allowsLocalOrigin(name)) {
    throw new Error(`${name} contains an unexpected local application origin`)
  }
}

const docsDirectory = resolve(root, "docs/src/app/content")
const docs = (await readdir(docsDirectory)).filter((name) => name.endsWith(".md"))
const documented = new Set()
for (const name of docs) {
  const content = await readFile(resolve(docsDirectory, name), "utf8")
  for (const match of content.matchAll(/(?:https:\/\/themys\.ca)?(\/api\/[a-zA-Z0-9_./<>-]+)/g)) {
    documented.add(match[1].replace(/<([^>]+)>/g, "[$1]").replace(/[.,:;]+$/, ""))
  }
}

const routeRoot = resolve(root, "src/app/api")
const routeFiles = (await walk(routeRoot)).filter((file) => file.endsWith("route.ts"))
const implemented = new Map()
for (const file of routeFiles) {
  const route = `/${relative(resolve(root, "src/app"), file)}`.replace(/\/route\.ts$/, "")
  const content = await readFile(file, "utf8")
  implemented.set(route, new Set(Array.from(content.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)/g), (match) => match[1])))
}

const implementedPatterns = new Set(Array.from(implemented.keys(), (route) => route.replace(/\[[^\]]+\]/g, "[]")))
for (const route of documented) {
  if (!implementedPatterns.has(route.replace(/\[[^\]]+\]/g, "[]"))) {
    throw new Error(`Documentation references missing route ${route}`)
  }
}

const requiredContracts = new Map([
  ["/api/extract", ["POST"]],
  ["/api/analyze", ["POST"]],
  ["/api/analyze/batch", ["POST"]],
  ["/api/developer/keys", ["GET", "POST"]],
  ["/api/developer/keys/[keyId]", ["DELETE"]],
  ["/api/developer/usage", ["GET"]],
  ["/api/developer/usage/per-key", ["GET"]],
  ["/api/monitor", ["GET", "POST", "PATCH", "DELETE"]],
  ["/api/monitor/alerts", ["GET", "PATCH"]],
  ["/api/webhooks/stripe", ["POST"]],
])
for (const [route, methods] of requiredContracts) {
  const actual = implemented.get(route)
  if (!actual) throw new Error(`Required public API route is missing: ${route}`)
  for (const method of methods) {
    if (!actual.has(method)) throw new Error(`${route} is missing documented ${method} support`)
  }
}

console.log(`Validated canonical origins and ${documented.size} documented API routes`)

const wranglerConfig = await readFile(resolve(root, "wrangler.jsonc"), "utf8")
if (!/"migrations_dir"\s*:\s*"d1\/migrations"/.test(wranglerConfig)) {
  throw new Error("wrangler.jsonc must point D1 migrations at d1/migrations")
}

const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"))
const migrateScripts = [
  "d1:migrate:local",
  "d1:migrate:remote",
  "d1:migrations:list",
  "d1:migrations:list:local",
  "d1:migrations:list:remote",
]
for (const name of migrateScripts) {
  const script = packageJson.scripts?.[name]
  if (typeof script !== "string" || !script.includes("--config wrangler.jsonc")) {
    throw new Error(`${name} must pass --config wrangler.jsonc so Wrangler reads d1/migrations`)
  }
}

const migrationsLink = await lstat(resolve(root, "migrations"))
if (!migrationsLink.isSymbolicLink()) {
  throw new Error("migrations must be a symlink to d1/migrations so the Wrangler default path works")
}
