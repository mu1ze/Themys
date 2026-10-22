import "server-only"

import { getCloudflareContext } from "@opennextjs/cloudflare"

import {
  createDatabaseClient,
  DatabaseClient,
  type D1DatabaseLike,
} from "./database-client"

let cachedBinding: D1DatabaseLike | null = null
let cachedClient: DatabaseClient | null = null

function isD1Binding(value: unknown): value is D1DatabaseLike {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<D1DatabaseLike>
  return typeof candidate.prepare === "function" && typeof candidate.batch === "function"
}

export function getDatabaseBinding(): D1DatabaseLike {
  let value: unknown
  try {
    value = (getCloudflareContext().env as unknown as Record<string, unknown>).DB
  } catch (reason) {
    throw new Error("D1 binding DB is unavailable in this runtime", { cause: reason })
  }

  if (!isD1Binding(value)) {
    throw new Error("D1 binding DB is not configured")
  }
  return value
}

export function getDatabase(): DatabaseClient {
  const binding = getDatabaseBinding()
  if (cachedBinding !== binding || !cachedClient) {
    cachedBinding = binding
    cachedClient = createDatabaseClient(binding)
  }
  return cachedClient
}

export { DatabaseClient }
