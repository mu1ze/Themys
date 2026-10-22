import "dotenv/config"
import assert from "node:assert/strict"
import { createCloudflareD1AdminClient } from "./lib/cloudflare-admin.mjs"

const database = createCloudflareD1AdminClient()
const bucket = `verification:${crypto.randomUUID()}`
const windowEnd = new Date(Date.now() + 60_000).toISOString()

try {
  const attempts = await Promise.all(
    Array.from({ length: 20 }, (_, index) => database.rpc("reserve_usage_slots", {
      p_bucket_key: bucket,
      p_limit: 5,
      p_window_end: windowEnd,
      p_amount: 1,
      p_idempotency_key: `request-${index}`,
    })),
  )
  for (const attempt of attempts) assert.equal(attempt.error, null)
  const rows = attempts.map(({ data }) => Array.isArray(data) ? data[0] : data)
  assert.equal(rows.filter((row) => row.allowed).length, 5, "concurrent ceiling must be exact")
  const acceptedEntries = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.allowed)

  const replay = await database.rpc("reserve_usage_slots", {
    p_bucket_key: bucket,
    p_limit: 5,
    p_window_end: windowEnd,
    p_amount: 1,
    p_idempotency_key: `request-${acceptedEntries[0].index}`,
  })
  assert.equal(replay.error, null)
  assert.equal(replay.data[0].is_replay, true)
  assert.equal(replay.data[0].current_count, 5)

  const before = await database.rpc("get_api_rate_limit_status", { p_bucket_key: bucket })
  await Promise.all(Array.from({ length: 10 }, () =>
    database.rpc("get_api_rate_limit_status", { p_bucket_key: bucket }),
  ))
  const after = await database.rpc("get_api_rate_limit_status", { p_bucket_key: bucket })
  assert.equal(before.data[0].current_count, after.data[0].current_count, "status reads must not consume quota")

  const accepted = acceptedEntries.map(({ row }) => row)
  await Promise.all(accepted.slice(0, 3).map((row) =>
    database.rpc("settle_usage_reservation", { p_reservation_id: row.reservation_id, p_commit: true }),
  ))
  await Promise.all(accepted.slice(3).map((row) =>
    database.rpc("settle_usage_reservation", { p_reservation_id: row.reservation_id, p_commit: false }),
  ))
  const settled = await database.rpc("get_api_rate_limit_status", { p_bucket_key: bucket })
  assert.equal(settled.data[0].current_count, 3)

  await database.rpc("settle_usage_reservation", {
    p_reservation_id: accepted[3].reservation_id,
    p_commit: false,
  })
  const repeatedRefund = await database.rpc("get_api_rate_limit_status", { p_bucket_key: bucket })
  assert.equal(repeatedRefund.data[0].current_count, 3, "refund settlement must be idempotent")

  const retryAfterRefund = await database.rpc("reserve_usage_slots", {
    p_bucket_key: bucket,
    p_limit: 5,
    p_window_end: windowEnd,
    p_amount: 1,
    p_idempotency_key: `request-${acceptedEntries[3].index}`,
  })
  assert.equal(retryAfterRefund.error, null)
  assert.equal(retryAfterRefund.data[0].allowed, true)
  assert.equal(retryAfterRefund.data[0].is_replay, false, "refunded attempts must reserve again")
  assert.equal(retryAfterRefund.data[0].current_count, 4)
  await database.rpc("settle_usage_reservation", {
    p_reservation_id: retryAfterRefund.data[0].reservation_id,
    p_commit: true,
  })

  console.log("Remote usage accounting verified: exact concurrency, replay, read-only status, idempotent settlement, and charged retries after refund")
} finally {
  await database.from("usage_reservations").delete().eq("bucket_key", bucket)
  await database.from("api_rate_limits").delete().eq("bucket_key", bucket)
}
