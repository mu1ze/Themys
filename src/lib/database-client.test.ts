import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { DatabaseSync, type StatementSync } from "node:sqlite"

import {
  createDatabaseClient,
  d1FailureMessage,
  type D1DatabaseLike,
  type D1PreparedStatementLike,
  type D1ResultLike,
  type D1Value,
} from "./database-client.ts"

function sqliteValue(value: D1Value): string | number | null | Uint8Array {
  return value instanceof ArrayBuffer ? new Uint8Array(value) : value
}

class TestStatement implements D1PreparedStatementLike {
  private readonly database: DatabaseSync
  private readonly sql: string
  private values: D1Value[] = []

  constructor(database: DatabaseSync, sql: string) {
    this.database = database
    this.sql = sql
  }

  bind(...values: D1Value[]): TestStatement {
    this.values = values
    return this
  }

  execute(): D1ResultLike {
    const statement = this.database.prepare(this.sql)
    const values = this.values.map(sqliteValue)
    const returnsRows = /^\s*SELECT\b/i.test(this.sql) || /\bRETURNING\b/i.test(this.sql)
    if (returnsRows) {
      return { success: true, results: statement.all(...values) as Record<string, unknown>[] }
    }
    const result = statement.run(...values)
    return {
      success: true,
      results: [],
      meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) },
    }
  }

  async all<T = Record<string, unknown>>(): Promise<D1ResultLike<T>> {
    return this.execute() as D1ResultLike<T>
  }

  async first<T = Record<string, unknown>>(columnName?: string): Promise<T | null> {
    const statement: StatementSync = this.database.prepare(this.sql)
    const row = statement.get(...this.values.map(sqliteValue)) as Record<string, unknown> | undefined
    if (!row) return null
    if (columnName) return (row[columnName] ?? null) as T | null
    return row as T
  }

  async run<T = Record<string, unknown>>(): Promise<D1ResultLike<T>> {
    return this.execute() as D1ResultLike<T>
  }
}

class TestDatabase implements D1DatabaseLike {
  readonly sqlite = new DatabaseSync(":memory:")

  constructor() {
    this.sqlite.exec("PRAGMA foreign_keys = ON")
    this.sqlite.exec(readFileSync(new URL("../../d1/migrations/0001_initial.sql", import.meta.url), "utf8"))
    this.sqlite.exec(readFileSync(new URL("../../d1/migrations/0003_safari_ios_client.sql", import.meta.url), "utf8"))
    this.sqlite.exec(readFileSync(new URL("../../d1/migrations/0005_billing_operations.sql", import.meta.url), "utf8"))
  }

  prepare(sql: string): TestStatement {
    return new TestStatement(this.sqlite, sql)
  }

  async batch<T = Record<string, unknown>>(
    statements: D1PreparedStatementLike[],
  ): Promise<D1ResultLike<T>[]> {
    this.sqlite.exec("BEGIN IMMEDIATE")
    try {
      const results = statements.map((statement) => (statement as TestStatement).execute())
      this.sqlite.exec("COMMIT")
      return results as D1ResultLike<T>[]
    } catch (error) {
      this.sqlite.exec("ROLLBACK")
      throw error
    }
  }

  close(): void {
    this.sqlite.close()
  }
}

test("D1 query client hydrates JSON and booleans and supports conflict updates", async (context) => {
  const binding = new TestDatabase()
  context.after(() => binding.close())
  const database = createDatabaseClient(binding)

  const inserted = await database.from("users").insert({
    id: "user-one",
    clerk_id: "clerk-one",
    email: "one@example.test",
    target_clauses: ["auto-renewal"],
    strict_mode: true,
  }).select("id, target_clauses, strict_mode").single()

  assert.equal(inserted.error, null)
  assert.deepEqual(inserted.data, {
    id: "user-one",
    target_clauses: ["auto-renewal"],
    strict_mode: true,
  })

  const updated = await database.from("users").upsert({
    id: "user-one",
    clerk_id: "clerk-one",
    email: "changed@example.test",
    target_clauses: ["arbitration"],
    strict_mode: false,
  }).select("email, target_clauses, strict_mode").single()

  assert.equal(updated.error, null)
  assert.deepEqual(updated.data, {
    email: "changed@example.test",
    target_clauses: ["arbitration"],
    strict_mode: false,
  })
})

test("upserts on a natural key preserve an existing primary key with dependent rows", async (context) => {
  const binding = new TestDatabase()
  context.after(() => binding.close())
  const database = createDatabaseClient(binding)

  const insertedUser = await database.from("users").insert({
    id: "stable-user-id",
    clerk_id: "clerk-with-scan",
    email: "before@example.test",
  })
  assert.equal(insertedUser.error, null)

  const insertedScan = await database.from("scans").insert({
    id: "dependent-scan-id",
    user_id: "stable-user-id",
  })
  assert.equal(insertedScan.error, null)

  const updated = await database
    .from("users")
    .upsert(
      {
        clerk_id: "clerk-with-scan",
        email: "after@example.test",
      },
      { onConflict: "clerk_id" },
    )
    .select("id, email")
    .single()

  assert.equal(updated.error, null)
  assert.deepEqual(updated.data, {
    id: "stable-user-id",
    email: "after@example.test",
  })

  const scan = await database
    .from("scans")
    .select("user_id")
    .eq("id", "dependent-scan-id")
    .single()
  assert.equal(scan.error, null)
  assert.equal(scan.data?.user_id, "stable-user-id")
})

test("usage reservations enforce limits, replay idempotently, and refund once", async (context) => {
  const binding = new TestDatabase()
  context.after(() => binding.close())
  const database = createDatabaseClient(binding)
  const params = {
    p_bucket_key: "rl:user-one:scans:2026-08",
    p_limit: 2,
    p_window_end: "2026-09-01T00:00:00.000Z",
    p_amount: 1,
    p_idempotency_key: "request-one",
  }

  const first = await database.rpc("reserve_usage_slots", params)
  assert.equal(first.error, null)
  assert.equal(first.data[0].allowed, true)
  assert.equal(first.data[0].current_count, 1)

  const replay = await database.rpc("reserve_usage_slots", params)
  assert.equal(replay.error, null)
  assert.equal(replay.data[0].allowed, true)
  assert.equal(replay.data[0].current_count, 1)
  assert.equal(replay.data[0].is_replay, true)

  const refunded = await database.rpc("settle_usage_reservation", {
    p_reservation_id: first.data[0].reservation_id,
    p_commit: false,
  })
  assert.equal(refunded.error, null)
  assert.equal(refunded.data, 0)

  const retried = await database.rpc("reserve_usage_slots", params)
  assert.equal(retried.error, null)
  assert.equal(retried.data[0].allowed, true)
  assert.equal(retried.data[0].current_count, 1)
})

test("credit consumption is oldest-first, idempotent, and refundable", async (context) => {
  const binding = new TestDatabase()
  context.after(() => binding.close())
  const database = createDatabaseClient(binding)
  const future = "2099-01-01T00:00:00.000Z"

  await database.from("users").insert({
    id: "user-credit",
    clerk_id: "clerk-credit",
    email: "credit@example.test",
  })
  await database.from("credit_packs").insert({
    id: "pack-oldest",
    user_id: "user-credit",
    pack_size: 2,
    credits_remaining: 2,
    price_paid: 4,
    purchased_at: "2026-01-01T00:00:00.000Z",
    expires_at: future,
  })

  const params = {
    p_clerk_id: "clerk-credit",
    p_idempotency_key: "credit-request-one",
    p_purpose: "scan_overflow",
  }
  const consumed = await database.rpc("consume_user_credit", params)
  assert.equal(consumed.error, null)
  assert.deepEqual(consumed.data, [{ consumed: true, remaining: 1, is_replay: false }])

  const replay = await database.rpc("consume_user_credit", params)
  assert.equal(replay.error, null)
  assert.deepEqual(replay.data, [{ consumed: true, remaining: 1, is_replay: true }])

  const refunded = await database.rpc("refund_user_credit", params)
  assert.equal(refunded.error, null)
  assert.equal(refunded.data, true)

  const pack = await database.from("credit_packs")
    .select("credits_remaining")
    .eq("id", "pack-oldest")
    .single()
  assert.ok(pack.data)
  assert.equal(pack.data.credits_remaining, 2)

  const hold = await database.from("credit_packs")
    .update({ refund_hold: true }).eq("id", "pack-oldest")
  assert.equal(hold.error, null)
  const blocked = await database.rpc("consume_user_credit", {
    ...params, p_idempotency_key: "credit-request-held",
  })
  assert.equal(blocked.error, null)
  assert.deepEqual(blocked.data, [{ consumed: false, remaining: 0, is_replay: false }])
})

test("monitoring subscription limits are enforced atomically", async (context) => {
  const binding = new TestDatabase()
  context.after(() => binding.close())
  const database = createDatabaseClient(binding)
  await database.from("users").insert({
    id: "user-monitor",
    clerk_id: "clerk-monitor",
    email: "monitor@example.test",
  })

  const base = {
    p_user_id: "user-monitor",
    p_domain: "example.test",
    p_title: "Terms",
    p_frequency: "weekly",
    p_limit: 1,
    p_document_type: "terms_of_service",
    p_document_type_confidence: 0.99,
    p_document_type_source: "test",
    p_document_type_evidence: ["heading"],
    p_document_identity_key: "example:terms",
  }
  const first = await database.rpc("subscribe_monitoring_with_identity_limit", {
    ...base,
    p_url: "https://example.test/terms",
  })
  assert.equal(first.error, null)

  const second = await database.rpc("subscribe_monitoring_with_identity_limit", {
    ...base,
    p_url: "https://example.test/privacy",
  })
  assert.equal(second.data, null)
  assert.equal(second.error?.message, "monitor_limit_reached")
})

test("D1 inserts chunk large batches and persist every extraction point", async (context) => {
  const binding = new TestDatabase()
  context.after(() => binding.close())
  const database = createDatabaseClient(binding)

  const user = await database.from("users").insert({
    id: "user-extract",
    clerk_id: "clerk-extract",
    email: "extract@example.test",
  }).select("id").single()
  assert.equal(user.error, null)

  const scan = await database.from("scans").insert({
    id: "scan-extract",
    user_id: "user-extract",
    title: "Example Terms",
    source: "web",
  }).select("id").single()
  assert.equal(scan.error, null)

  const sectionCount = 12
  const pointsPerSection = 8
  const sections = Array.from({ length: sectionCount }, (_, position) => ({
    id: `section-${position}`,
    scan_id: "scan-extract",
    section: `Section ${position + 1}`,
    icon: "📄",
    position,
  }))
  const sectionInsert = await database.from("full_extraction_sections").insert(sections)
  assert.equal(sectionInsert.error, null)

  const points = sections.flatMap((section) =>
    Array.from({ length: pointsPerSection }, (_, position) => ({
      section_id: section.id,
      title: `Point ${position + 1}`,
      detail: "Plain-language explanation of the clause.",
      quote: "Original wording.",
      severity: "info",
      position,
    })),
  )
  assert.equal(points.length, 96)
  const pointInsert = await database.from("full_extraction_points").insert(points)
  assert.equal(pointInsert.error, null)

  const stored = await database.from("full_extraction_points")
    .select("id", { count: "exact", head: true })
  assert.equal(stored.error, null)
  assert.equal(stored.count, 96)
})

test("d1FailureMessage ignores success:false unless D1 returned an error string", () => {
  assert.equal(d1FailureMessage({ success: false }), null)
  assert.equal(d1FailureMessage({ success: false, error: "   " }), null)
  assert.equal(d1FailureMessage({ success: true }), null)
  assert.equal(d1FailureMessage({ success: false, error: "no such table: scans" }), "no such table: scans")
})

test("D1 mutations still persist when batch entries report success:false without an error", async (context) => {
  const binding = new TestDatabase()
  context.after(() => binding.close())
  const wrapped: D1DatabaseLike = {
    prepare(sql) {
      return binding.prepare(sql)
    },
    async batch<T = Record<string, unknown>>(statements: D1PreparedStatementLike[]): Promise<D1ResultLike<T>[]> {
      const results = await binding.batch<T>(statements)
      return results.map((result) => ({ ...result, success: false }))
    },
  }
  const database = createDatabaseClient(wrapped)

  const user = await database.from("users").insert({
    id: "user-false-success",
    clerk_id: "clerk-false-success",
    email: "false-success@example.test",
  }).select("id").single()
  assert.equal(user.error, null)

  const scan = await database.from("scans").insert({
    id: "scan-false-success",
    user_id: "user-false-success",
    title: "False success",
    source: "web",
  }).select("id").single()
  assert.equal(scan.error, null)
  assert.equal(scan.data?.id, "scan-false-success")
})
