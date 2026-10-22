import assert from "node:assert/strict"
import test from "node:test"

import {
  fetchPublicUrl,
  isPublicIpAddress,
  normalizePublicHttpUrl,
  PublicUrlValidationError,
  readResponseText,
  validatePublicHttpUrl,
} from "./url-security.ts"

test("rejects private, loopback, metadata, and documentation IPv4 ranges", () => {
  for (const address of [
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "192.0.2.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
  ]) {
    assert.equal(isPublicIpAddress(address), false, address)
  }
  assert.equal(isPublicIpAddress("8.8.8.8"), true)
})

test("rejects private, loopback, transition, mapped, and documentation IPv6 ranges", () => {
  for (const address of [
    "::",
    "::1",
    "fc00::1",
    "fd12::1",
    "fe80::1",
    "ff02::1",
    "2001:db8::1",
    "2001::1",
    "2002:7f00:1::",
    "64:ff9b::7f00:1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
  ]) {
    assert.equal(isPublicIpAddress(address), false, address)
  }
  assert.equal(isPublicIpAddress("2606:4700:4700::1111"), true)
})

test("normalizes safe URLs and rejects dangerous URL forms", () => {
  assert.equal(
    normalizePublicHttpUrl(" HTTPS://Example.COM/terms#section ").href,
    "https://example.com/terms",
  )

  for (const value of [
    "file:///etc/passwd",
    "data:text/plain,hello",
    "http://user:password@example.com/",
    "http://localhost/",
    "http://service.local/",
    "http://127.0.0.1/",
    "http://2130706433/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:7f00:1]/",
    "https://example.com:8443/",
  ]) {
    assert.throws(
      () => normalizePublicHttpUrl(value),
      (error) => error instanceof PublicUrlValidationError,
      value,
    )
  }
})

test("accepts a hostname without performing an application-level DNS lookup", async () => {
  // Cloudflare Workers supplies the public network boundary through the
  // global_fetch_strictly_public compatibility flag. A hostname may be
  // temporarily unresolvable in a Worker DNS subrequest; that must not turn
  // every scan into a 500 before Cloudflare can make the actual public fetch.
  const url = await validatePublicHttpUrl("https://worker-dns-regression.invalid/terms#summary")
  assert.equal(url.href, "https://worker-dns-regression.invalid/terms")
})

test("rejects a redirect from a public address to a private destination before a second fetch", async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return new Response(null, {
      status: 302,
      headers: { location: "http://127.0.0.1/private" },
    })
  }
  try {
    await assert.rejects(() => fetchPublicUrl("https://8.8.8.8/terms"), /private|reserved/i)
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("terminates oversized and slow response bodies", async () => {
  const oversized = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(8))
        controller.enqueue(new Uint8Array(8))
        controller.close()
      },
    }),
    { headers: { "content-type": "text/plain" } },
  )
  await assert.rejects(
    () => readResponseText(oversized, 10, ["text/plain"]),
    /too large/i,
  )

  const slow = new Response(
    new ReadableStream({
      async pull(controller) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        controller.enqueue(new TextEncoder().encode("late"))
        controller.close()
      },
    }),
    { headers: { "content-type": "text/plain" } },
  )
  await assert.rejects(
    () => readResponseText(slow, 100, ["text/plain"], 10),
    /timed out/i,
  )
})
