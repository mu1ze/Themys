import assert from "node:assert/strict"
import { createServer } from "node:http"
import test from "node:test"

import { fetchJsonWithTimeout } from "./fetch-timeout.ts"

async function listen(
  handler: (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => void,
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer(handler)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("expected TCP address")
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  }
}

test("fetchJsonWithTimeout aborts if headers arrive but the body never finishes", { timeout: 2_000 }, async () => {
  const hung = await listen((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.write("{")
  })

  try {
    await assert.rejects(
      () => fetchJsonWithTimeout(hung.url, { method: "GET" }, 80),
      (error: unknown) =>
        error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError"),
    )
  } finally {
    await hung.close()
  }
})
