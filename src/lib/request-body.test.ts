import assert from "node:assert/strict"
import test from "node:test"

import { readRequestText, RequestBodyTooLargeError } from "./request-body.ts"

test("reads request bodies within the byte ceiling", async () => {
  const request = new Request("https://example.com/api", {
    method: "POST",
    body: "hello",
  })
  assert.equal(await readRequestText(request, 5), "hello")
})

test("rejects declared and streamed request bodies above the byte ceiling", async () => {
  const declared = new Request("https://example.com/api", {
    method: "POST",
    headers: { "content-length": "100" },
    body: "small",
  })
  await assert.rejects(
    () => readRequestText(declared, 10),
    RequestBodyTooLargeError,
  )

  const streamed = new Request("https://example.com/api", {
    method: "POST",
    body: "01234567890",
  })
  await assert.rejects(
    () => readRequestText(streamed, 10),
    RequestBodyTooLargeError,
  )
})
