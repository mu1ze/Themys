import assert from "node:assert/strict"
import test from "node:test"

import { scrubSentryEvent } from "./sentry-privacy.ts"

test("Sentry scrubber removes credentials, identity, bodies, and URL secrets", () => {
  const scrubbed = scrubSentryEvent({
    request: {
      url: "https://themys.ca/api/analyze?token=secret#fragment",
      headers: { Authorization: "Bearer abc.def.ghi", Cookie: "__session=secret", Accept: "application/json" },
      data: { text: "raw terms" },
      cookies: { __session: "secret" },
    },
    user: { id: "user_secret", email: "person@example.com" },
    extra: {
      apiKey: "tmys_supersecret",
      note: "Contact person@example.com for user_secret",
      exception:
        "Clerk failed for https://game.clerk.accounts.dev/v1/client/sessions/sess_secret/touch?__clerk_db_jwt=dvb_secret&email=person@example.com",
      safe: "kept",
    },
  })
  assert.equal(scrubbed.user, undefined)
  assert.equal(scrubbed.request?.url, "https://themys.ca/api/analyze")
  assert.equal(scrubbed.request?.data, undefined)
  assert.equal(scrubbed.request?.cookies, undefined)
  assert.equal(scrubbed.request?.headers?.Authorization, undefined)
  assert.equal(scrubbed.request?.headers?.Cookie, undefined)
  assert.equal(scrubbed.extra?.apiKey, "[REDACTED]")
  assert.equal(scrubbed.extra?.note, "Contact [REDACTED_EMAIL] for [REDACTED_USER]")
  assert.equal(
    scrubbed.extra?.exception,
    "Clerk failed for https://game.clerk.accounts.dev/v1/client/sessions/[REDACTED_USER]/touch?[REDACTED_QUERY]",
  )
})
