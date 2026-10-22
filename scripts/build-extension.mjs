import { execFileSync } from "node:child_process"
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const environment = process.argv[2] ?? "development"
const validateOnly = process.argv.includes("--validate-only")
const origins = {
  development: "http://localhost:3000",
  staging: process.env.THEMYS_STAGING_ORIGIN,
  production: process.env.THEMYS_PRODUCTION_ORIGIN ?? "https://themys.ca",
}
if (!(environment in origins)) throw new Error(`Unknown extension environment: ${environment}`)
const origin = origins[environment]
if (!origin) throw new Error(`Missing canonical origin for ${environment}`)
const parsedOrigin = new URL(origin)
if (environment !== "development" && parsedOrigin.protocol !== "https:") {
  throw new Error("Non-development extension origins must use HTTPS")
}
if (parsedOrigin.origin !== origin) throw new Error("Extension origin must not include a path")

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const output = resolve(root, "artifacts", "extension", environment)
const archive = resolve(root, "artifacts", "extension", `themys-${environment}.zip`)

await rm(output, { recursive: true, force: true })
await mkdir(output, { recursive: true })
await cp(resolve(root, "extension"), output, {
  recursive: true,
  filter: (source) => !source.endsWith(".DS_Store") && !source.endsWith("README.md"),
})
await mkdir(resolve(output, "detection"), { recursive: true })
await Promise.all([
  cp(resolve(root, "packages", "tos-detection", "themys-detection.js"), resolve(output, "detection", "themys-detection.js")),
  cp(resolve(root, "packages", "tos-detection", "themys-capture-policy.js"), resolve(output, "detection", "themys-capture-policy.js")),
])
await writeFile(
  resolve(output, "config.js"),
  `globalThis.THEMYS_CONFIG = Object.freeze(${JSON.stringify({ environment, appOrigin: origin }, null, 2)});\n`,
)
const manifestPath = resolve(output, "manifest.json")
const generatedManifest = JSON.parse(await readFile(manifestPath, "utf8"))
generatedManifest.host_permissions = [`${origin}/*`]
const externalMatch = `${parsedOrigin.protocol}//${parsedOrigin.hostname}/*`
generatedManifest.externally_connectable = { matches: [externalMatch] }
if (process.env.THEMYS_EXTENSION_PUBLIC_KEY) {
  generatedManifest.key = process.env.THEMYS_EXTENSION_PUBLIC_KEY.trim()
} else {
  delete generatedManifest.key
}
await writeFile(manifestPath, `${JSON.stringify(generatedManifest, null, 2)}\n`)

const manifest = JSON.parse(await readFile(resolve(output, "manifest.json"), "utf8"))
if (manifest.manifest_version !== 3) throw new Error("Extension artifact is not Manifest V3")
if (manifest.host_permissions.length !== 1 || manifest.host_permissions[0] !== `${origin}/*`) {
  throw new Error("Extension host permissions do not match the canonical app origin")
}
if (
  manifest.externally_connectable?.matches?.length !== 1
  || manifest.externally_connectable.matches[0] !== externalMatch
) {
  throw new Error("Extension external messaging does not match the canonical app origin")
}
if (manifest.content_security_policy?.extension_pages !== "script-src 'self'; object-src 'self'") {
  throw new Error("Extension page CSP is missing or unsafe")
}
const expectedPermissions = ["activeTab", "alarms", "storage"]
if (JSON.stringify([...manifest.permissions].sort()) !== JSON.stringify(expectedPermissions)) {
  throw new Error("Extension permissions differ from the reviewed minimum")
}

const scanFiles = (await readdir(output, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile() && /\.(?:js|html|css|json)$/i.test(entry.name))
  .map((entry) => resolve(entry.parentPath ?? entry.path, entry.name))
const combined = (await Promise.all(scanFiles.map((file) => readFile(resolve(output, file), "utf8")))).join("\n")
const endpointScanText = combined.replaceAll("http://www.w3.org/2000/svg", "")
const contentScript = await readFile(resolve(output, "content.js"), "utf8")
const backgroundScript = await readFile(resolve(output, "background.js"), "utf8")
const detectionScript = await readFile(resolve(output, "detection", "themys-detection.js"), "utf8")
const capturePolicyScript = await readFile(resolve(output, "detection", "themys-capture-policy.js"), "utf8")
if (!detectionScript.includes("ThemysDetection") || !contentScript.includes("ThemysDetection")) {
  throw new Error("Shared detection package is missing from the artifact")
}
if (!capturePolicyScript.includes("ThemysCapturePolicy") || !contentScript.includes("ThemysCapturePolicy")) {
  throw new Error("Shared capture policy is missing from the artifact")
}
const contentScripts = manifest.content_scripts?.[0]?.js ?? []
if (contentScripts[0] !== "detection/themys-detection.js") {
  throw new Error("Content scripts must load shared detection before overlay and content")
}
if (contentScripts[1] !== "detection/themys-capture-policy.js") {
  throw new Error("Content scripts must load capture policy before overlay and content")
}
if (/THEMYS_AUTH_TOKEN|RELAY_AUTH_TOKEN/.test(contentScript)) {
  throw new Error("Content script must not receive authentication tokens from the page")
}
if (
  !backgroundScript.includes("onMessageExternal") ||
  !backgroundScript.includes("senderUrl?.origin === API_BASE") ||
  !backgroundScript.includes('senderUrl.pathname === "/extension-auth"')
) {
  throw new Error("Service-worker external auth channel is missing sender origin/path validation")
}
const sensitiveLog = combined
  .split("\n")
  .find((line) => /console\.(?:log|warn|error)/.test(line) && /token|authorization|cookie|response.?body/i.test(line))
if (sensitiveLog) throw new Error("Extension artifact contains credential-sensitive logging")
if (environment === "production" && /localhost|127\.0\.0\.1|themys\.ai/i.test(endpointScanText)) {
  throw new Error("Production artifact contains a development or inconsistent application origin")
}
if (environment === "production" && endpointScanText.includes("http://")) {
  throw new Error("Production artifact contains an insecure HTTP endpoint")
}

if (!validateOnly) {
  await rm(archive, { force: true })
  execFileSync("zip", ["-qr", archive, "."], { cwd: output, stdio: "inherit" })
}
console.log(`Validated ${environment} MV3 artifact for ${origin}${validateOnly ? "" : ` at ${archive}`}`)
