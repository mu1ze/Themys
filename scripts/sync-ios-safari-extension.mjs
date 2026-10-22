#!/usr/bin/env node
import { cp, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const resources = resolve(root, "ios", "ThemysSafariExtension", "Resources")
await mkdir(resolve(resources, "detection"), { recursive: true })
await cp(
  resolve(root, "packages", "tos-detection", "themys-detection.js"),
  resolve(resources, "detection", "themys-detection.js"),
)
await cp(resolve(root, "extension", "overlay.js"), resolve(resources, "overlay.js"))
await cp(resolve(root, "extension", "popup-detector.js"), resolve(resources, "popup-detector.js"))

const environment = process.env.THEMYS_IOS_ENVIRONMENT ?? "production"
const origin =
  environment === "development"
    ? "http://localhost:3000"
    : process.env.THEMYS_PRODUCTION_ORIGIN ?? "https://themys.ca"
await writeFile(
  resolve(resources, "config.js"),
  `globalThis.THEMYS_CONFIG = Object.freeze(${JSON.stringify(
    { environment, appOrigin: origin, platform: "safari-ios", appScheme: "themys" },
    null,
    2,
  )});\n`,
)

const overlay = await readFile(resolve(resources, "overlay.js"), "utf8")
if (!overlay.includes("showDetectionBadge")) {
  throw new Error("Synced overlay.js is missing showDetectionBadge")
}
console.log(`Synced Safari extension resources for ${origin}`)
