import assert from "node:assert/strict";
import test from "node:test";

import { requestIdFrom, ServerTiming } from "./server-timing.ts";

test("server timing measures operations and emits a safe header", async () => {
  const timing = new ServerTiming();
  const result = await timing.measure("analysis", async () => "ok");

  assert.equal(result, "ok");
  const header = timing.header();
  assert.equal(typeof header, "string");
  assert.match(header ?? "", /^analysis;dur=\d+$/);
});

test("requestIdFrom preserves a bounded incoming request id", () => {
  const request = new Request("https://themys.ca", {
    headers: { "x-request-id": "scan-123" },
  });

  assert.equal(requestIdFrom(request), "scan-123");
  assert.equal(
    requestIdFrom(new Request("https://themys.ca", { headers: { "x-request-id": "scan id/7" } })),
    "scan-id-7",
  );
  assert.ok(requestIdFrom(new Request("https://themys.ca")).length > 0);
});
