import { isIP } from "node:net"

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
])

export class PublicUrlValidationError extends Error {
  override name = "PublicUrlValidationError"
}

function invalidPublicUrl(message: string): PublicUrlValidationError {
  return new PublicUrlValidationError(message)
}

function parseIpv4(address: string): number[] | null {
  const parts = address.split(".")
  if (parts.length !== 4) return null
  const bytes = parts.map(Number)
  return bytes.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    ? bytes
    : null
}

function isBlockedIpv4(address: string): boolean {
  const b = parseIpv4(address)
  if (!b) return true
  return (
    b[0] === 0 ||
    b[0] === 10 ||
    b[0] === 127 ||
    (b[0] === 100 && b[1] >= 64 && b[1] <= 127) ||
    (b[0] === 169 && b[1] === 254) ||
    (b[0] === 172 && b[1] >= 16 && b[1] <= 31) ||
    (b[0] === 192 && b[1] === 0 && b[2] === 0) ||
    (b[0] === 192 && b[1] === 0 && b[2] === 2) ||
    (b[0] === 192 && b[1] === 168) ||
    (b[0] === 198 && (b[1] === 18 || b[1] === 19)) ||
    (b[0] === 198 && b[1] === 51 && b[2] === 100) ||
    (b[0] === 203 && b[1] === 0 && b[2] === 113) ||
    b[0] >= 224
  )
}

function normalizedIpv6(address: string): string {
  return address.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0]
}

function expandIpv6(address: string): number[] | null {
  let ip = normalizedIpv6(address)
  if (ip.includes(".")) {
    const lastColon = ip.lastIndexOf(":")
    const ipv4 = parseIpv4(ip.slice(lastColon + 1))
    if (!ipv4) return null
    ip = `${ip.slice(0, lastColon)}:${((ipv4[0] << 8) | ipv4[1]).toString(16)}:${((ipv4[2] << 8) | ipv4[3]).toString(16)}`
  }

  const halves = ip.split("::")
  if (halves.length > 2) return null
  const left = halves[0] ? halves[0].split(":") : []
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : []
  const missing = 8 - left.length - right.length
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) {
    return null
  }

  const parts = [...left, ...Array(missing).fill("0"), ...right]
  const values = parts.map((part) => Number.parseInt(part, 16))
  return values.length === 8 && values.every((value) => Number.isInteger(value) && value >= 0 && value <= 0xffff)
    ? values
    : null
}

function isBlockedIpv6(address: string): boolean {
  const ip = normalizedIpv6(address)
  const parts = expandIpv6(ip)
  if (!parts) return true
  const [first, second] = parts
  const allZeroThroughSix = parts.slice(0, 6).every((part) => part === 0)
  const embeddedIpv4 = `${parts[6] >> 8}.${parts[6] & 0xff}.${parts[7] >> 8}.${parts[7] & 0xff}`

  return (
    parts.every((part) => part === 0) ||
    (parts.slice(0, 7).every((part) => part === 0) && parts[7] === 1) ||
    (parts.slice(0, 5).every((part) => part === 0) && parts[5] === 0xffff && isBlockedIpv4(embeddedIpv4)) ||
    allZeroThroughSix || // deprecated IPv4-compatible ::/96
    (first & 0xfe00) === 0xfc00 || // unique local fc00::/7
    (first & 0xffc0) === 0xfe80 || // link local fe80::/10
    (first & 0xff00) === 0xff00 || // multicast ff00::/8
    (first === 0x0064 && second === 0xff9b) || // NAT64 translation prefixes
    first === 0x2002 || // 6to4 can tunnel to embedded private IPv4
    (first === 0x2001 && (second === 0 || second === 0x0db8)) || // Teredo and documentation
    (first & 0xfff0) === 0x3ff0 // 3fff::/20 documentation
  )
}

export function isPublicIpAddress(address: string): boolean {
  const version = isIP(normalizedIpv6(address))
  if (version === 4) return !isBlockedIpv4(address)
  if (version === 6) return !isBlockedIpv6(address)
  return false
}

export function normalizePublicHttpUrl(input: string): URL {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    throw invalidPublicUrl("Invalid URL")
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw invalidPublicUrl("Only HTTP and HTTPS URLs are allowed")
  }
  if (url.username || url.password) {
    throw invalidPublicUrl("Credential-bearing URLs are not allowed")
  }
  if (url.port && !["80", "443"].includes(url.port)) {
    throw invalidPublicUrl("Non-standard URL ports are not allowed")
  }

  const hostname = normalizedIpv6(url.hostname).replace(/\.$/, "")
  if (
    !hostname ||
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw invalidPublicUrl("Local or internal destinations are not allowed")
  }
  if (isIP(hostname) && !isPublicIpAddress(hostname)) {
    throw invalidPublicUrl("Private or reserved IP destinations are not allowed")
  }

  url.hash = ""
  url.hostname = hostname
  return url
}

export async function validatePublicHttpUrl(input: string): Promise<URL> {
  // The Worker is configured with Cloudflare's `global_fetch_strictly_public`
  // compatibility flag. That is the network boundary for hostname resolution
  // and outbound routing in production. Resolving hostnames again here via
  // `node:dns` caused every URL scan to fail when the Worker DNS subrequest
  // was unavailable, while also adding multiple subrequests per redirect.
  //
  // Keep validating literal IP destinations ourselves; a hostname is only
  // ever fetched through Cloudflare's public egress path.
  return normalizePublicHttpUrl(input)
}

export async function fetchPublicUrl(
  input: string,
  init: RequestInit = {},
  options: { timeoutMs?: number; maxRedirects?: number } = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 10_000
  const maxRedirects = options.maxRedirects ?? 3
  let current = await validatePublicHttpUrl(input)

  for (let hop = 0; hop <= maxRedirects; hop++) {
    // Re-validate every redirect target before making the next public fetch.
    current = await validatePublicHttpUrl(current.href)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    let response: Response
    try {
      response = await fetch(current, {
        ...init,
        redirect: "manual",
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (![301, 302, 303, 307, 308].includes(response.status)) return response
    const location = response.headers.get("location")
    if (!location) return response
    await response.body?.cancel()
    if (hop === maxRedirects) throw new Error("Too many redirects")
    current = await validatePublicHttpUrl(new URL(location, current).href)
  }

  throw new Error("Too many redirects")
}

export async function readResponseText(
  response: Response,
  maxBytes: number,
  allowedContentTypes: string[],
  timeoutMs = 15_000,
): Promise<string> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""
  if (contentType && !allowedContentTypes.some((allowed) => contentType.includes(allowed))) {
    throw new Error("Unsupported response content type")
  }
  const declaredLength = Number(response.headers.get("content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("Response is too large")
  }
  if (!response.body) return ""

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let total = 0
  let text = ""
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    void reader.cancel("Response timed out")
  }, timeoutMs)
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (timedOut) throw new Error("Response timed out")
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel("Response is too large")
        throw new Error("Response is too large")
      }
      text += decoder.decode(value, { stream: true })
    }
    return text + decoder.decode()
  } finally {
    clearTimeout(timeout)
    reader.releaseLock()
  }
}
