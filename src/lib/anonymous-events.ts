export const ANONYMOUS_EVENT_MAX_BODY_BYTES = 4_096
export const ANONYMOUS_EVENT_MAX_PER_HOUR = 120
export const ANONYMOUS_EVENT_WINDOW_SECONDS = 60 * 60

export function getAnonymousClientIdentifier(request: Request): string {
  return request.headers.get("cf-connecting-ip")?.trim().slice(0, 64) || "unknown"
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

/** Build a non-reversible, deployment-keyed actor without persisting raw IP data. */
export async function buildAnonymousActor(
  request: Request,
  secret: string,
): Promise<string> {
  if (new TextEncoder().encode(secret.trim()).byteLength < 32) {
    throw new Error("Anonymous fingerprint secret must be at least 32 bytes")
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const ip = getAnonymousClientIdentifier(request)
  const userAgent = (request.headers.get("user-agent") ?? "unknown").slice(0, 200)
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${ip}:${userAgent}`),
  )
  return `anon:${toHex(signature)}`
}
