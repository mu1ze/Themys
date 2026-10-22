export type TimedJsonResponse =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: number }

/**
 * Fetch JSON with a deadline that covers headers *and* the response body.
 * Clearing the abort timer after `fetch()` resolves lets a stalled body hang forever.
 */
export async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<TimedJsonResponse> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    if (!res.ok) {
      return { ok: false, status: res.status }
    }
    const data: unknown = await res.json()
    return { ok: true, status: res.status, data }
  } finally {
    clearTimeout(timeout)
  }
}
