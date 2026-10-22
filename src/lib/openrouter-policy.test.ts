import assert from "node:assert/strict"
import test from "node:test"

import { buildOpenRouterChatRequest } from "./openrouter-policy.ts"

test("OpenRouter requests require zero-data-retention provider endpoints", () => {
  const request = buildOpenRouterChatRequest("provider/model", "system", "document")

  assert.deepEqual(request.provider, { zdr: true })
  assert.deepEqual(request.messages, [
    { role: "system", content: "system" },
    { role: "user", content: "document" },
  ])
  assert.deepEqual(request.response_format, { type: "json_object" })
})
