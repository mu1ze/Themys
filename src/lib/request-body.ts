export class RequestBodyTooLargeError extends Error {}

/** Read a request body while enforcing a byte ceiling for chunked requests. */
export async function readRequestText(request: Request, maxBytes: number): Promise<string> {
  const declaredLength = Number(request.headers.get("content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestBodyTooLargeError("Request body is too large")
  }
  if (!request.body) return ""

  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let total = 0
  let text = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel("Request body is too large")
        throw new RequestBodyTooLargeError("Request body is too large")
      }
      text += decoder.decode(value, { stream: true })
    }
    return text + decoder.decode()
  } finally {
    reader.releaseLock()
  }
}
