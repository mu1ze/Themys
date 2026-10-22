import assert from "node:assert/strict"
import test from "node:test"

import {
  buildAnonymousActor,
  getAnonymousClientIdentifier,
} from "./anonymous-events.ts"

test("anonymous identity uses only Cloudflare's verified client IP header", async () => {
  const request = new Request("https://themys.ca/api/events/anon", {
    headers: {
      "cf-connecting-ip": "203.0.113.8",
      "x-forwarded-for": "198.51.100.2, 203.0.113.8",
      "user-agent": "test-agent",
    },
  })

  assert.equal(getAnonymousClientIdentifier(request), "203.0.113.8")
  const actor = await buildAnonymousActor(request, "test-secret-that-is-at-least-32-bytes")
  assert.match(actor, /^anon:[0-9a-f]{64}$/)
  assert.doesNotMatch(actor, /203\.0\.113\.8|test-agent/)
  assert.notEqual(
    actor,
    await buildAnonymousActor(request, "different-secret-that-is-also-32-bytes"),
  )
})

test("client-supplied forwarding headers cannot widen anonymous identities", () => {
  const request = new Request("https://themys.ca/api/events/anon", {
    headers: { "x-forwarded-for": "198.51.100.2" },
  })
  assert.equal(getAnonymousClientIdentifier(request), "unknown")
})
