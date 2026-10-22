import { readFile } from "node:fs/promises"

const environment = process.argv[2] ?? "production"
if (!new Set(["staging", "production"]).has(environment)) {
  throw new Error("Usage: node scripts/verify-email-worker-config.mjs <staging|production>")
}

const config = await readFile(new URL("../email-worker/wrangler.jsonc", import.meta.url), "utf8")
if (!config.includes('"name": "SEND_EMAIL"') || !config.includes('"name": "DELIVERY_COORDINATOR"') || !config.includes('"MONITORING_EMAIL_FROM": "alerts@themys.ca"')) {
  throw new Error("email-worker/wrangler.jsonc is missing the SEND_EMAIL binding, DeliveryCoordinator binding, or alerts@themys.ca sender")
}
if (!config.includes('"new_sqlite_classes": ["DeliveryCoordinator"]')) {
  throw new Error("email-worker/wrangler.jsonc is missing the DeliveryCoordinator migration")
}
if (!config.includes('"workers_dev": false')) {
  throw new Error("production email Worker must not expose a workers.dev endpoint")
}

console.log(`Validated ${environment} email Worker configuration; private service binding and Wrangler authentication are checked by deployment; no provider secret is required by this Worker`)
