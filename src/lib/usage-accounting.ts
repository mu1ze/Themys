import "server-only"

import { getDatabase } from "@/lib/database"

export type UsageClient = "web" | "extension" | "safari-ios" | "api_key" | "cron"

async function digest(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

export async function hashUsageActor(actor: string): Promise<string> {
  return digest(actor)
}

export function getRequestIdempotencyKey(request: Request): string | undefined {
  const value = request.headers.get("idempotency-key")?.trim()
  if (!value) return undefined
  return value.length <= 200 ? value : undefined
}

export async function recordUsageEvent(input: {
  actor: string
  client: UsageClient
  operation: string
  outcome: string
  cached?: boolean
  scanSlots?: number
  aiSlots?: number
  credits?: number
  idempotencyKey?: string
  metadata?: Record<string, string | number | boolean | null>
}): Promise<void> {
  const actorHash = await digest(input.actor)
  const idempotencyKeyHash = input.idempotencyKey
    ? await digest(input.idempotencyKey)
    : null
  const { error } = await getDatabase().from("usage_events").insert({
    actor_hash: actorHash,
    client_type: input.client,
    operation: input.operation,
    outcome: input.outcome,
    cached: input.cached ?? false,
    scan_slots: input.scanSlots ?? 0,
    ai_slots: input.aiSlots ?? 0,
    credits: input.credits ?? 0,
    idempotency_key_hash: idempotencyKeyHash,
    metadata: input.metadata ?? {},
  })
  if (error) throw error
}
