import { createDatabaseClient } from "../../src/lib/database-client.ts"
import { spawn } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const defaultWranglerConfig = join(repositoryRoot, "wrangler.jsonc")
const defaultWranglerBinary = join(repositoryRoot, "node_modules/.bin/wrangler")

function required(env, name) {
  const value = env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function apiError(payload, fallback) {
  const message = Array.isArray(payload?.errors)
    ? payload.errors.map((error) => error?.message).filter(Boolean).join("; ")
    : ""
  return new Error(message || fallback)
}

function isMissingR2Object(payload) {
  return Array.isArray(payload?.errors) && payload.errors.some((error) => (
    String(error?.code) === "10007" || error?.message === "The specified key does not exist."
  ))
}

function httpParams(values) {
  return values.map((value) => {
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
      throw new Error("The Cloudflare D1 HTTP helper does not support binary parameters")
    }
    return value
  })
}

class D1HttpStatement {
  constructor(binding, sql) {
    this.binding = binding
    this.sql = sql
    this.values = []
  }

  bind(...values) {
    this.values = values
    return this
  }

  async all() {
    return this.binding.query([{ sql: this.sql, params: httpParams(this.values) }]).then((results) => results[0])
  }

  async first(columnName) {
    const result = await this.all()
    const row = result.results?.[0] ?? null
    if (!row || !columnName) return row
    return row[columnName] ?? null
  }

  async run() {
    return this.all()
  }
}

class D1HttpBinding {
  constructor({ accountId, databaseId, apiToken, fetchImpl = fetch }) {
    this.accountId = accountId
    this.databaseId = databaseId
    this.apiToken = apiToken
    this.fetchImpl = fetchImpl
  }

  prepare(sql) {
    return new D1HttpStatement(this, sql)
  }

  async batch(statements) {
    return this.query(statements.map((statement) => ({
      sql: statement.sql,
      params: httpParams(statement.values),
    })))
  }

  async query(batch) {
    const response = await this.fetchImpl(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(this.accountId)}/d1/database/${encodeURIComponent(this.databaseId)}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batch.length === 1 ? batch[0] : { batch }),
        signal: AbortSignal.timeout(30_000),
      },
    )
    const payload = await response.json().catch(() => null)
    if (!response.ok || payload?.success !== true || !Array.isArray(payload.result)) {
      throw apiError(payload, `Cloudflare D1 request failed with HTTP ${response.status}`)
    }
    const failed = payload.result.find((result) => result?.success === false)
    if (failed) throw new Error(failed.error || "Cloudflare D1 query failed")
    return payload.result
  }
}

export function sqliteLiteral(value) {
  if (value === null || value === undefined) return "NULL"
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("D1 CLI parameters must be finite numbers")
    return String(value)
  }
  if (typeof value === "boolean") return value ? "1" : "0"
  if (typeof value === "string") return `'${value.replaceAll("'", "''")}'`
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    throw new Error("The Cloudflare D1 CLI helper does not support binary parameters")
  }
  throw new Error(`Unsupported D1 CLI parameter type: ${typeof value}`)
}

function bindSql(sql, values) {
  let index = 0
  const bound = sql.replace(/\?/g, () => {
    if (index >= values.length) throw new Error("D1 CLI statement has fewer parameters than placeholders")
    return sqliteLiteral(values[index++])
  })
  if (index !== values.length) throw new Error("D1 CLI statement has more parameters than placeholders")
  return bound
}

async function runWrangler(args, { input, env = process.env } = {}) {
  const binary = env.WRANGLER_BIN?.trim() || defaultWranglerBinary
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(binary, args, {
      cwd: repositoryRoot,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    })
    const stdout = []
    const stderr = []
    child.stdout.on("data", (chunk) => stdout.push(chunk))
    child.stderr.on("data", (chunk) => stderr.push(chunk))
    child.on("error", rejectPromise)
    child.on("close", (code) => {
      const output = Buffer.concat(stdout)
      const errorOutput = Buffer.concat(stderr).toString("utf8")
      if (code !== 0) {
        rejectPromise(new Error(errorOutput.trim() || output.toString("utf8").trim() || `Wrangler exited with code ${code}`))
        return
      }
      resolvePromise({ output, errorOutput })
    })
    if (input !== undefined) child.stdin.end(input)
    else child.stdin.end()
  })
}

class D1WranglerStatement {
  constructor(binding, sql) {
    this.binding = binding
    this.sql = sql
    this.values = []
  }

  bind(...values) {
    this.values = values
    return this
  }

  async all() {
    return this.binding.query([this]).then((results) => results[0])
  }

  async first(columnName) {
    const result = await this.all()
    const row = result.results?.[0] ?? null
    if (!row || !columnName) return row
    return row[columnName] ?? null
  }

  async run() {
    return this.all()
  }
}

class D1WranglerBinding {
  constructor({ databaseName, configPath, env }) {
    this.databaseName = databaseName
    this.configPath = configPath
    this.env = env
  }

  prepare(sql) {
    return new D1WranglerStatement(this, sql)
  }

  async batch(statements) {
    return this.query(statements)
  }

  async query(statements) {
    const sql = statements.map((statement) => `${bindSql(statement.sql, statement.values)};`).join("\n")
    const baseArgs = [
      "d1", "execute", this.databaseName,
      "--remote", "--config", this.configPath,
    ]

    if (Buffer.byteLength(sql, "utf8") <= 60_000) {
      const { output } = await runWrangler([
        ...baseArgs, "--command", sql, "--json", "--yes",
      ], { env: this.env })
      const payload = JSON.parse(output.toString("utf8"))
      if (!Array.isArray(payload)) throw new Error("Wrangler D1 returned an invalid JSON payload")
      const failed = payload.find((result) => result?.success === false)
      if (failed) throw new Error(failed.error || "Wrangler D1 query failed")
      return payload
    }

    const temporaryDirectory = await mkdtemp(join(tmpdir(), "themys-d1-"))
    const sqlPath = join(temporaryDirectory, "query.sql")
    try {
      await writeFile(sqlPath, sql, { mode: 0o600 })
      await runWrangler([
        ...baseArgs, "--file", sqlPath, "--json", "--yes",
      ], { env: this.env })
      // File imports return a single aggregate summary instead of a result per
      // statement. A zero exit code means every statement was accepted.
      return statements.map(() => ({ success: true, results: [] }))
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true })
    }
  }
}

export function cloudflareAdminConfig(env = process.env) {
  const apiToken = env.CLOUDFLARE_API_TOKEN?.trim() || null
  return {
    accountId: apiToken ? required(env, "CLOUDFLARE_ACCOUNT_ID") : null,
    databaseId: apiToken ? required(env, "CLOUDFLARE_D1_DATABASE_ID") : null,
    databaseName: env.CLOUDFLARE_D1_DATABASE_NAME?.trim() || "themys-db",
    configPath: env.CLOUDFLARE_WRANGLER_CONFIG?.trim() || defaultWranglerConfig,
    apiToken,
    bucketName: env.CLOUDFLARE_R2_BUCKET?.trim() || "themys-documents",
  }
}

export function createCloudflareD1AdminClient(env = process.env) {
  const config = cloudflareAdminConfig(env)
  const binding = config.apiToken
    ? new D1HttpBinding(config)
    : new D1WranglerBinding({ ...config, env })
  return createDatabaseClient(binding)
}

function objectUrl(config, key) {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/")
  return `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/r2/buckets/${encodeURIComponent(config.bucketName)}/objects/${encodedKey}`
}

export async function uploadCloudflareR2Object(key, value, env = process.env) {
  const config = cloudflareAdminConfig(env)
  if (!config.apiToken) {
    await runWrangler([
      "r2", "object", "put", `${config.bucketName}/${key}`,
      "--remote", "--pipe", "--content-type", "text/plain; charset=utf-8", "--force",
    ], { input: value, env })
    return
  }
  const response = await fetch(objectUrl(config, key), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "text/plain; charset=utf-8",
    },
    body: value,
    signal: AbortSignal.timeout(60_000),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || payload?.success !== true) {
    throw apiError(payload, `Cloudflare R2 upload failed with HTTP ${response.status}`)
  }
  return payload.result
}

export async function getCloudflareR2Object(key, env = process.env) {
  const config = cloudflareAdminConfig(env)
  if (!config.apiToken) {
    try {
      const { output } = await runWrangler([
        "r2", "object", "get", `${config.bucketName}/${key}`, "--remote", "--pipe",
      ], { env })
      return output.toString("utf8")
    } catch (reason) {
      if (/not found|does not exist|10007/i.test(reason instanceof Error ? reason.message : String(reason))) return null
      throw reason
    }
  }
  const response = await fetch(objectUrl(config, key), {
    headers: { Authorization: `Bearer ${config.apiToken}` },
    signal: AbortSignal.timeout(30_000),
  })
  if (response.status === 404) return null
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw apiError(payload, `Cloudflare R2 read failed with HTTP ${response.status}`)
  }
  return response.text()
}

export async function deleteCloudflareR2Object(key, env = process.env) {
  const config = cloudflareAdminConfig(env)
  if (!config.apiToken) {
    try {
      await runWrangler([
        "r2", "object", "delete", `${config.bucketName}/${key}`, "--remote", "--force",
      ], { env })
      return
    } catch (reason) {
      if (/not found|does not exist|10007/i.test(reason instanceof Error ? reason.message : String(reason))) return
      throw reason
    }
  }
  const response = await fetch(objectUrl(config, key), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${config.apiToken}` },
    signal: AbortSignal.timeout(30_000),
  })
  const payload = await response.json().catch(() => null)
  if (isMissingR2Object(payload)) return
  if (response.status === 404 && payload === null) return
  if (!response.ok || payload?.success !== true) {
    throw apiError(payload, `Cloudflare R2 delete failed with HTTP ${response.status}`)
  }
}
