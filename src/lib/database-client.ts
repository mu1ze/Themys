export type D1Value = string | number | null | ArrayBuffer

export type D1ResultLike<T = Record<string, unknown>> = {
  results?: T[]
  success?: boolean
  error?: string
  meta?: {
    changes?: number
    last_row_id?: number
    rows_read?: number
    rows_written?: number
  }
}

export type D1PreparedStatementLike = {
  bind(...values: D1Value[]): D1PreparedStatementLike
  all<T = Record<string, unknown>>(): Promise<D1ResultLike<T>>
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>
  run<T = Record<string, unknown>>(): Promise<D1ResultLike<T>>
}

export type D1DatabaseLike = {
  prepare(sql: string): D1PreparedStatementLike
  batch<T = Record<string, unknown>>(
    statements: D1PreparedStatementLike[],
  ): Promise<D1ResultLike<T>[]>
}

export type DatabaseError = Error & { code?: string }

/**
 * D1 does not carry a generated relational type map at runtime. Keep the
 * compatibility adapter's rows dynamic while still giving array callbacks a
 * concrete contextual type under strict TypeScript settings. `DatabaseRows`
 * is an intersection because the same builder can return a list or a single
 * row after `.single()`/`.maybeSingle()`.
 */
export type DatabaseRow = Record<string, any>
export type DatabaseRows = DatabaseRow[] & DatabaseRow

export type DatabaseResult<T = DatabaseRows> = {
  data: T | null
  error: DatabaseError | null
  count: number | null
}

type QueryOperation =
  | { type: "select" }
  | { type: "insert"; rows: Record<string, unknown>[] }
  | {
      type: "upsert"
      rows: Record<string, unknown>[]
      onConflict?: string
      ignoreDuplicates?: boolean
    }
  | { type: "update"; values: Record<string, unknown> }
  | { type: "delete" }

type Filter = {
  sql: string
  values: D1Value[]
}

type RelationSelection = {
  alias: string
  table: string
  fields: string[]
  inner: boolean
}

const TABLES = new Set([
  "users",
  "scans",
  "clauses",
  "blocklist_items",
  "tos_cache",
  "explanations_cache",
  "credit_packs",
  "invoices",
  "stripe_events",
  "purchase_acceptances",
  "billing_cases",
  "billing_case_events",
  "payment_refunds",
  "payment_disputes",
  "billing_notifications",
  "full_extraction_sections",
  "full_extraction_points",
  "docs_feedback",
  "monitoring_subscriptions",
  "tos_snapshots",
  "monitoring_alerts",
  "regulations",
  "clause_compliance_tags",
  "scan_jev_diagnostics",
  "api_keys",
  "api_usage_logs",
  "api_rate_limits",
  "usage_reservations",
  "credit_usage_reservations",
  "usage_events",
])

const AUTO_ID_TABLES = new Set([
  "users",
  "scans",
  "clauses",
  "blocklist_items",
  "credit_packs",
  "invoices",
  "billing_cases",
  "billing_case_events",
  "full_extraction_sections",
  "full_extraction_points",
  "docs_feedback",
  "monitoring_subscriptions",
  "tos_snapshots",
  "monitoring_alerts",
  "regulations",
  "clause_compliance_tags",
  "api_keys",
  "api_usage_logs",
  "usage_reservations",
  "credit_usage_reservations",
  "usage_events",
])

const UPDATED_AT_TABLES = new Set([
  "users",
  "purchase_acceptances",
  "billing_cases",
  "payment_refunds",
  "payment_disputes",
  "tos_cache",
  "monitoring_subscriptions",
  "api_keys",
  "api_rate_limits",
])

const JSON_COLUMNS: Record<string, Set<string>> = {
  users: new Set(["target_clauses"]),
  scans: new Set(["document_type_evidence"]),
  api_keys: new Set(["scopes"]),
  monitoring_subscriptions: new Set(["document_type_evidence"]),
  tos_snapshots: new Set(["categories_json"]),
  regulations: new Set(["articles"]),
  usage_events: new Set(["metadata"]),
}

const BOOLEAN_COLUMNS: Record<string, Set<string>> = {
  users: new Set(["strict_mode"]),
  scans: new Set(["is_deleted", "is_monitoring_scan"]),
  clauses: new Set([
    "is_flagged",
    "is_ai_explained",
    "is_standard_practice",
    "is_target_clause",
  ]),
  blocklist_items: new Set(["is_custom", "is_active"]),
  stripe_events: new Set(["livemode"]),
  purchase_acceptances: new Set(["livemode"]),
  billing_cases: new Set(["livemode"]),
  payment_refunds: new Set(["livemode"]),
  payment_disputes: new Set(["livemode", "evidence_submitted"]),
  credit_packs: new Set(["refund_hold"]),
  docs_feedback: new Set(["helpful"]),
  monitoring_subscriptions: new Set(["is_active", "email_notifications_enabled"]),
  monitoring_alerts: new Set(["is_read", "is_email_sent"]),
  regulations: new Set(["is_active"]),
  api_keys: new Set(["is_active"]),
  usage_events: new Set(["cached"]),
}

/** D1 rejects oversized batches; keep well under the documented 100-statement cap. */
const D1_MAX_BATCH_STATEMENTS = 50

export function d1FailureMessage(result: { success?: boolean; error?: string }): string | null {
  return typeof result.error === "string" && result.error.trim() ? result.error.trim() : null
}

const RELATIONS: Record<
  string,
  Record<string, { local: string; foreign: string }>
> = {
  api_keys: {
    users: { local: "user_id", foreign: "id" },
  },
  clause_compliance_tags: {
    regulations: { local: "regulation_id", foreign: "id" },
  },
}

function databaseError(reason: unknown): DatabaseError {
  if (reason instanceof Error) return reason as DatabaseError
  return new Error(typeof reason === "string" ? reason : "Database operation failed")
}

function identifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Invalid database identifier: ${value}`)
  }
  return `"${value}"`
}

function tableIdentifier(value: string): string {
  if (!TABLES.has(value)) throw new Error(`Unknown database table: ${value}`)
  return identifier(value)
}

function splitTopLevel(value: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let index = 0; index < value.length; index++) {
    const char = value[index]
    if (char === "(") depth++
    if (char === ")") depth--
    if (char === "," && depth === 0) {
      parts.push(value.slice(start, index).trim())
      start = index + 1
    }
  }
  parts.push(value.slice(start).trim())
  return parts.filter(Boolean)
}

function scalar(value: unknown): D1Value {
  if (value === undefined || value === null) return null
  if (typeof value === "boolean") return value ? 1 : 0
  if (typeof value === "string" || typeof value === "number") return value
  if (value instanceof ArrayBuffer) return value
  if (ArrayBuffer.isView(value)) {
    const bytes = new Uint8Array(value.byteLength)
    bytes.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
    return bytes.buffer
  }
  return JSON.stringify(value)
}

function parseFilterValue(value: string): D1Value {
  if (value === "null") return null
  if (value === "true") return 1
  if (value === "false") return 0
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value)
  return value.replace(/^"|"$/g, "")
}

function normalizeRow(table: string, row: Record<string, unknown>): Record<string, any> {
  const normalized: Record<string, any> = { ...row }
  for (const column of JSON_COLUMNS[table] ?? []) {
    const value = normalized[column]
    if (typeof value === "string") {
      try {
        normalized[column] = JSON.parse(value)
      } catch {
        normalized[column] = null
      }
    }
  }
  for (const column of BOOLEAN_COLUMNS[table] ?? []) {
    if (normalized[column] !== null && normalized[column] !== undefined) {
      normalized[column] = normalized[column] === true || normalized[column] === 1
    }
  }
  return normalized
}

function nowIso(): string {
  return new Date().toISOString()
}

function prepareRow(table: string, input: Record<string, unknown>): Record<string, unknown> {
  const row = { ...input }
  if (AUTO_ID_TABLES.has(table) && !row.id) row.id = crypto.randomUUID()
  if (table === "monitoring_alerts" && !row.email_idempotency_key && row.id) {
    row.email_idempotency_key = row.id
  }
  return row
}

function projection(
  value: string,
): { sql: string; relations: RelationSelection[] } {
  const columns: string[] = []
  const relations: RelationSelection[] = []

  for (const token of splitTopLevel(value || "*")) {
    if (token === "*") {
      columns.push("*")
      continue
    }
    const relation = /^(?:(\w+):)?(\w+)(!inner)?\((.*)\)$/.exec(token)
    if (relation) {
      const [, alias, table, inner, fields] = relation
      relations.push({
        alias: alias || table,
        table,
        fields: splitTopLevel(fields).map((field) => {
          identifier(field)
          return field
        }),
        inner: Boolean(inner),
      })
      continue
    }
    columns.push(identifier(token))
  }

  return {
    sql: columns.length > 0 ? columns.join(", ") : "*",
    relations,
  }
}

async function preparedRows(
  database: D1DatabaseLike,
  sql: string,
  values: D1Value[],
): Promise<Record<string, unknown>[]> {
  const result = await database.prepare(sql).bind(...values).all<Record<string, unknown>>()
  const failure = d1FailureMessage(result)
  if (failure) throw new Error(failure)
  return result.results ?? []
}

async function hydrateRelations(
  database: D1DatabaseLike,
  baseTable: string,
  rows: Record<string, any>[],
  relations: RelationSelection[],
): Promise<Record<string, any>[]> {
  let hydrated = rows
  for (const relation of relations) {
    const mapping = RELATIONS[baseTable]?.[relation.table]
    if (!mapping) {
      throw new Error(`Unsupported relation ${baseTable}.${relation.table}`)
    }
    const ids = [...new Set(hydrated.map((row) => row[mapping.local]).filter(Boolean))]
    if (ids.length === 0) {
      hydrated = relation.inner ? [] : hydrated.map((row) => ({ ...row, [relation.alias]: null }))
      continue
    }
    const fields = [...new Set([mapping.foreign, ...relation.fields])]
    const sql = `SELECT ${fields.map(identifier).join(", ")} FROM ${tableIdentifier(relation.table)} WHERE ${identifier(mapping.foreign)} IN (${ids.map(() => "?").join(", ")})`
    const related = await preparedRows(database, sql, ids.map(scalar))
    const byId = new Map(
      related.map((row) => [row[mapping.foreign], normalizeRow(relation.table, row)]),
    )
    hydrated = hydrated
      .map((row) => ({ ...row, [relation.alias]: byId.get(row[mapping.local]) ?? null }))
      .filter((row) => !relation.inner || row[relation.alias] !== null)
  }
  return hydrated
}

export class DatabaseQueryBuilder implements PromiseLike<DatabaseResult<DatabaseRows>> {
  private readonly database: D1DatabaseLike
  private readonly table: string
  private operation: QueryOperation = { type: "select" }
  private selectColumns = "*"
  private selectionRequested = false
  private selectCount = false
  private head = false
  private filters: Filter[] = []
  private orders: string[] = []
  private rowLimit: number | null = null
  private offset = 0
  private resultMode: "many" | "single" | "maybeSingle" = "many"

  constructor(database: D1DatabaseLike, table: string) {
    this.database = database
    this.table = table
    tableIdentifier(table)
  }

  select(columns = "*", options: { count?: "exact"; head?: boolean } = {}): this {
    this.selectionRequested = true
    this.selectColumns = columns || "*"
    this.selectCount = options.count === "exact"
    this.head = options.head === true
    return this
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]): this {
    this.operation = {
      type: "insert",
      rows: (Array.isArray(values) ? values : [values]).map((row) => prepareRow(this.table, row)),
    }
    return this
  }

  upsert(
    values: Record<string, unknown> | Record<string, unknown>[],
    options: { onConflict?: string; ignoreDuplicates?: boolean } = {},
  ): this {
    this.operation = {
      type: "upsert",
      rows: (Array.isArray(values) ? values : [values]).map((row) => prepareRow(this.table, row)),
      onConflict: options.onConflict,
      ignoreDuplicates: options.ignoreDuplicates,
    }
    return this
  }

  update(values: Record<string, unknown>): this {
    this.operation = { type: "update", values: { ...values } }
    return this
  }

  delete(): this {
    this.operation = { type: "delete" }
    return this
  }

  eq(column: string, value: unknown): this {
    return this.addComparison(column, "=", value)
  }

  neq(column: string, value: unknown): this {
    return this.addComparison(column, "!=", value)
  }

  gt(column: string, value: unknown): this {
    return this.addComparison(column, ">", value)
  }

  gte(column: string, value: unknown): this {
    return this.addComparison(column, ">=", value)
  }

  lt(column: string, value: unknown): this {
    return this.addComparison(column, "<", value)
  }

  lte(column: string, value: unknown): this {
    return this.addComparison(column, "<=", value)
  }

  like(column: string, value: string): this {
    this.filters.push({ sql: `${identifier(column)} LIKE ?`, values: [value] })
    return this
  }

  ilike(column: string, value: string): this {
    this.filters.push({ sql: `${identifier(column)} LIKE ? COLLATE NOCASE`, values: [value] })
    return this
  }

  is(column: string, value: null | boolean): this {
    if (value === null) this.filters.push({ sql: `${identifier(column)} IS NULL`, values: [] })
    else this.filters.push({ sql: `${identifier(column)} IS ?`, values: [scalar(value)] })
    return this
  }

  not(column: string, operator: string, value: unknown): this {
    if (operator === "is" && value === null) {
      this.filters.push({ sql: `${identifier(column)} IS NOT NULL`, values: [] })
      return this
    }
    const operators: Record<string, string> = { eq: "!=", gt: "<=", gte: "<", lt: ">=", lte: ">" }
    const sqlOperator = operators[operator]
    if (!sqlOperator) throw new Error(`Unsupported negated filter operator: ${operator}`)
    return this.addComparison(column, sqlOperator, value)
  }

  in(column: string, values: unknown[]): this {
    if (values.length === 0) {
      this.filters.push({ sql: "0 = 1", values: [] })
      return this
    }
    this.filters.push({
      sql: `${identifier(column)} IN (${values.map(() => "?").join(", ")})`,
      values: values.map(scalar),
    })
    return this
  }

  or(expression: string): this {
    const clauses: string[] = []
    const values: D1Value[] = []
    for (const part of splitTopLevel(expression)) {
      const match = /^([A-Za-z_][A-Za-z0-9_]*)\.(eq|neq|gt|gte|lt|lte|like|ilike|is|in)\.(.*)$/.exec(part)
      if (!match) throw new Error(`Unsupported OR filter: ${part}`)
      const [, column, operator, raw] = match
      const name = identifier(column)
      if (operator === "is") {
        if (raw !== "null") throw new Error(`Unsupported IS filter value: ${raw}`)
        clauses.push(`${name} IS NULL`)
      } else if (operator === "in") {
        const list = raw.startsWith("(") && raw.endsWith(")")
          ? splitTopLevel(raw.slice(1, -1))
          : []
        if (list.length === 0) {
          clauses.push("0 = 1")
        } else {
          clauses.push(`${name} IN (${list.map(() => "?").join(", ")})`)
          values.push(...list.map(parseFilterValue))
        }
      } else {
        const operators: Record<string, string> = {
          eq: "=", neq: "!=", gt: ">", gte: ">=", lt: "<", lte: "<=", like: "LIKE", ilike: "LIKE",
        }
        clauses.push(`${name} ${operators[operator]} ?${operator === "ilike" ? " COLLATE NOCASE" : ""}`)
        values.push(parseFilterValue(raw))
      }
    }
    this.filters.push({ sql: `(${clauses.join(" OR ")})`, values })
    return this
  }

  order(
    column: string,
    options: { ascending?: boolean; nullsFirst?: boolean } = {},
  ): this {
    const name = identifier(column)
    if (options.nullsFirst !== undefined) {
      this.orders.push(
        `${name} IS ${options.nullsFirst ? "NOT " : ""}NULL ASC`,
      )
    }
    this.orders.push(`${name} ${options.ascending === false ? "DESC" : "ASC"}`)
    return this
  }

  limit(value: number): this {
    this.rowLimit = Math.max(0, Math.floor(value))
    return this
  }

  range(from: number, to: number): this {
    this.offset = Math.max(0, Math.floor(from))
    this.rowLimit = Math.max(0, Math.floor(to) - this.offset + 1)
    return this
  }

  single(): this {
    this.resultMode = "single"
    this.rowLimit = this.rowLimit ?? 2
    return this
  }

  maybeSingle(): this {
    this.resultMode = "maybeSingle"
    this.rowLimit = this.rowLimit ?? 2
    return this
  }

  then<TResult1 = DatabaseResult<DatabaseRows>, TResult2 = never>(
    onfulfilled?: ((value: DatabaseResult<DatabaseRows>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }

  private addComparison(column: string, operator: string, value: unknown): this {
    if (value === null && operator === "=") {
      this.filters.push({ sql: `${identifier(column)} IS NULL`, values: [] })
    } else if (value === null && operator === "!=") {
      this.filters.push({ sql: `${identifier(column)} IS NOT NULL`, values: [] })
    } else {
      this.filters.push({ sql: `${identifier(column)} ${operator} ?`, values: [scalar(value)] })
    }
    return this
  }

  private where(): { sql: string; values: D1Value[] } {
    if (this.filters.length === 0) return { sql: "", values: [] }
    return {
      sql: ` WHERE ${this.filters.map((filter) => filter.sql).join(" AND ")}`,
      values: this.filters.flatMap((filter) => filter.values),
    }
  }

  private async execute(): Promise<DatabaseResult<any>> {
    try {
      if (this.operation.type === "select") return await this.executeSelect()
      return await this.executeMutation()
    } catch (reason) {
      return { data: null, error: databaseError(reason), count: null }
    }
  }

  private async executeSelect(): Promise<DatabaseResult<any>> {
    const selected = projection(this.selectColumns)
    const where = this.where()
    let count: number | null = null

    if (this.selectCount) {
      const row = await this.database
        .prepare(`SELECT COUNT(*) AS count FROM ${tableIdentifier(this.table)}${where.sql}`)
        .bind(...where.values)
        .first<{ count: number }>()
      count = Number(row?.count ?? 0)
    }

    if (this.head) return { data: null, error: null, count }

    let sql = `SELECT ${selected.sql} FROM ${tableIdentifier(this.table)}${where.sql}`
    if (this.orders.length > 0) sql += ` ORDER BY ${this.orders.join(", ")}`
    if (this.rowLimit !== null) sql += ` LIMIT ${this.rowLimit}`
    if (this.offset > 0) sql += ` OFFSET ${this.offset}`

    let rows = (await preparedRows(this.database, sql, where.values)).map((row) =>
      normalizeRow(this.table, row),
    )
    rows = await hydrateRelations(this.database, this.table, rows, selected.relations)
    return this.shape(rows, count)
  }

  private async executeMutation(): Promise<DatabaseResult<any>> {
    const selected = projection(this.selectColumns)
    const returning = this.selectionRequested ? ` RETURNING ${selected.sql}` : ""
    const statements: D1PreparedStatementLike[] = []

    if (this.operation.type === "insert" || this.operation.type === "upsert") {
      for (const sourceRow of this.operation.rows) {
        const row = prepareRow(this.table, sourceRow)
        if (
          this.operation.type === "upsert" &&
          UPDATED_AT_TABLES.has(this.table) &&
          row.updated_at === undefined
        ) {
          row.updated_at = nowIso()
        }
        const columns = Object.keys(row)
        if (columns.length === 0) throw new Error("Cannot insert an empty row")
        const values = columns.map((column) => scalar(row[column]))
        let sql = `INSERT INTO ${tableIdentifier(this.table)} (${columns.map(identifier).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`

        if (this.operation.type === "upsert") {
          const conflictColumns = (this.operation.onConflict || "id")
            .split(",")
            .map((column) => column.trim())
            .filter(Boolean)
          conflictColumns.forEach(identifier)
          if (this.operation.ignoreDuplicates) {
            sql += ` ON CONFLICT (${conflictColumns.map(identifier).join(", ")}) DO NOTHING`
          } else {
            // `prepareRow` supplies IDs for inserts, including upserts whose
            // conflict target is a natural key. Never copy that candidate ID
            // onto the existing row: dependent foreign keys generally do not
            // use ON UPDATE CASCADE, so rotating the primary key would fail.
            const updateColumns = columns.filter(
              (column) => column !== "id" && !conflictColumns.includes(column),
            )
            if (updateColumns.length === 0) {
              sql += ` ON CONFLICT (${conflictColumns.map(identifier).join(", ")}) DO NOTHING`
            } else {
              sql += ` ON CONFLICT (${conflictColumns.map(identifier).join(", ")}) DO UPDATE SET ${updateColumns.map((column) =>
                `${identifier(column)} = excluded.${identifier(column)}`,
              ).join(", ")}`
            }
          }
        }
        statements.push(this.database.prepare(`${sql}${returning}`).bind(...values))
      }
    } else if (this.operation.type === "update") {
      const values = { ...this.operation.values }
      if (UPDATED_AT_TABLES.has(this.table) && values.updated_at === undefined) {
        values.updated_at = nowIso()
      }
      const columns = Object.keys(values)
      if (columns.length === 0) throw new Error("Cannot apply an empty update")
      const where = this.where()
      const sql = `UPDATE ${tableIdentifier(this.table)} SET ${columns.map((column) => `${identifier(column)} = ?`).join(", ")}${where.sql}${returning}`
      statements.push(
        this.database
          .prepare(sql)
          .bind(...columns.map((column) => scalar(values[column])), ...where.values),
      )
    } else {
      const where = this.where()
      statements.push(
        this.database
          .prepare(`DELETE FROM ${tableIdentifier(this.table)}${where.sql}${returning}`)
          .bind(...where.values),
      )
    }

    if (statements.length === 0) {
      return this.resultMode === "many"
        ? { data: [] as DatabaseRows, error: null, count: 0 }
        : { data: null, error: null, count: 0 }
    }

    const rows: Record<string, unknown>[] = []
    for (let index = 0; index < statements.length; index += D1_MAX_BATCH_STATEMENTS) {
      const chunk = statements.slice(index, index + D1_MAX_BATCH_STATEMENTS)
      const results = await this.database.batch(chunk)
      for (const result of results) {
        const failure = d1FailureMessage(result)
        if (failure) throw new Error(failure)
      }
      rows.push(...results.flatMap((result) => result.results ?? []))
    }
    let normalized = rows.map((row) => normalizeRow(this.table, row as Record<string, unknown>))
    normalized = await hydrateRelations(this.database, this.table, normalized, selected.relations)
    if (!returning) return { data: null, error: null, count: null }
    return this.shape(normalized, null)
  }

  private shape(rows: Record<string, any>[], count: number | null): DatabaseResult<DatabaseRows> {
    const resultRows = rows as DatabaseRows
    if (this.resultMode === "single") {
      if (rows.length !== 1) {
        const error = databaseError(`Expected one row, received ${rows.length}`)
        error.code = "DB_SINGLE_ROW"
        return { data: null, error, count }
      }
      return { data: rows[0] as DatabaseRows, error: null, count }
    }
    if (this.resultMode === "maybeSingle") {
      if (rows.length > 1) {
        const error = databaseError(`Expected at most one row, received ${rows.length}`)
        error.code = "DB_MULTIPLE_ROWS"
        return { data: null, error, count }
      }
      return { data: (rows[0] as DatabaseRows | undefined) ?? null, error: null, count }
    }
    return { data: resultRows, error: null, count }
  }
}

async function runRpc(
  database: D1DatabaseLike,
  name: string,
  params: Record<string, any>,
): Promise<any> {
  if (name === "get_api_rate_limit_status") {
    const row = await database
      .prepare("SELECT COALESCE(request_count, 0) AS current_count FROM api_rate_limits WHERE bucket_key = ?")
      .bind(params.p_bucket_key)
      .first<Record<string, unknown>>()
    return [{ current_count: Number(row?.current_count ?? 0) }]
  }

  if (name === "refund_api_rate_limit_slots") {
    if (!Number.isInteger(params.p_amount) || params.p_amount < 1) {
      throw new Error("Refund amount must be positive")
    }
    const row = await database
      .prepare("UPDATE api_rate_limits SET request_count = max(0, request_count - ?), updated_at = ? WHERE bucket_key = ? RETURNING request_count")
      .bind(params.p_amount, nowIso(), params.p_bucket_key)
      .first<Record<string, unknown>>()
    return Number(row?.request_count ?? 0)
  }

  if (name === "reserve_usage_slots") {
    const amount = Number(params.p_amount ?? 1)
    const limit = Number(params.p_limit)
    if (!Number.isInteger(limit) || !Number.isInteger(amount) || limit < 1 || amount < 1 || amount > limit) {
      throw new Error("Invalid usage reservation")
    }
    const id = crypto.randomUUID()
    const token = crypto.randomUUID()
    const idempotencyKey = params.p_idempotency_key ?? null
    const timestamp = nowIso()
    const batch = await database.batch([
      database.prepare(`
        INSERT INTO usage_reservations (
          id, bucket_key, idempotency_key, amount, status, window_end, attempt_token
        ) VALUES (?, ?, ?, ?, 'pending', ?, ?)
        ON CONFLICT (bucket_key, idempotency_key) DO UPDATE SET
          amount = excluded.amount,
          status = 'pending',
          window_end = excluded.window_end,
          attempt_token = excluded.attempt_token,
          settle_token = NULL,
          settled_at = NULL
        WHERE usage_reservations.status = 'refunded'
        RETURNING id
      `).bind(id, params.p_bucket_key, idempotencyKey, amount, params.p_window_end, token),
      database.prepare(`
        INSERT INTO api_rate_limits (
          bucket_key, request_count, window_end, last_attempt_token, updated_at
        )
        SELECT ?, ?, ?, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM usage_reservations
          WHERE bucket_key = ? AND attempt_token = ? AND status = 'pending'
        )
        ON CONFLICT (bucket_key) DO UPDATE SET
          request_count = api_rate_limits.request_count + excluded.request_count,
          window_end = excluded.window_end,
          last_attempt_token = excluded.last_attempt_token,
          updated_at = excluded.updated_at
        WHERE api_rate_limits.request_count + excluded.request_count <= ?
        RETURNING request_count
      `).bind(
        params.p_bucket_key,
        amount,
        params.p_window_end,
        token,
        timestamp,
        params.p_bucket_key,
        token,
        limit,
      ),
      database.prepare(`
        UPDATE usage_reservations
        SET status = CASE WHEN EXISTS (
              SELECT 1 FROM api_rate_limits
              WHERE bucket_key = ? AND last_attempt_token = ?
            ) THEN 'reserved' ELSE 'refunded' END,
            settled_at = CASE WHEN EXISTS (
              SELECT 1 FROM api_rate_limits
              WHERE bucket_key = ? AND last_attempt_token = ?
            ) THEN NULL ELSE ? END
        WHERE bucket_key = ? AND attempt_token = ? AND status = 'pending'
      `).bind(
        params.p_bucket_key,
        token,
        params.p_bucket_key,
        token,
        timestamp,
        params.p_bucket_key,
        token,
      ),
      database.prepare(`
        SELECT
          CASE WHEN r.status IN ('reserved', 'committed') THEN 1 ELSE 0 END AS allowed,
          COALESCE(l.request_count, 0) AS current_count,
          CASE WHEN r.status IN ('reserved', 'committed') THEN r.id ELSE NULL END AS reservation_id,
          CASE WHEN r.attempt_token <> ? OR r.status = 'committed' THEN 1 ELSE 0 END AS is_replay
        FROM usage_reservations r
        LEFT JOIN api_rate_limits l ON l.bucket_key = r.bucket_key
        WHERE r.id = ? OR (? IS NOT NULL AND r.bucket_key = ? AND r.idempotency_key = ?)
        ORDER BY CASE WHEN r.id = ? THEN 0 ELSE 1 END
        LIMIT 1
      `).bind(token, id, idempotencyKey, params.p_bucket_key, idempotencyKey, id),
    ])
    const row = batch[3]?.results?.[0] as Record<string, unknown> | undefined
    return [{
      allowed: row?.allowed === 1 || row?.allowed === true,
      current_count: Number(row?.current_count ?? 0),
      reservation_id: row?.reservation_id ?? null,
      is_replay: row?.is_replay === 1 || row?.is_replay === true,
    }]
  }

  if (name === "settle_usage_reservation") {
    const commit = params.p_commit === true
    const token = crypto.randomUUID()
    const timestamp = nowIso()
    const batch = await database.batch([
      database.prepare(`
        UPDATE usage_reservations
        SET status = ?, settled_at = ?, settle_token = ?
        WHERE id = ? AND status = 'reserved'
        RETURNING bucket_key, amount
      `).bind(commit ? "committed" : "refunded", timestamp, token, params.p_reservation_id),
      database.prepare(`
        UPDATE api_rate_limits
        SET request_count = max(0, request_count - COALESCE((
              SELECT amount FROM usage_reservations
              WHERE id = ? AND settle_token = ? AND status = 'refunded'
            ), 0)),
            updated_at = ?
        WHERE bucket_key = (
          SELECT bucket_key FROM usage_reservations
          WHERE id = ? AND settle_token = ? AND status = 'refunded'
        ) AND ? = 0
        RETURNING request_count
      `).bind(params.p_reservation_id, token, timestamp, params.p_reservation_id, token, commit ? 1 : 0),
      database.prepare(`
        SELECT l.request_count
        FROM usage_reservations r
        LEFT JOIN api_rate_limits l ON l.bucket_key = r.bucket_key
        WHERE r.id = ?
      `).bind(params.p_reservation_id),
    ])
    const row = batch[2]?.results?.[0] as Record<string, unknown> | undefined
    if (!row) throw new Error("Usage reservation not found")
    return Number(row.request_count ?? 0)
  }

  if (name === "consume_user_credit") {
    if (!['scan_overflow', 'ai_overflow'].includes(params.p_purpose)) {
      throw new Error("Invalid credit purpose")
    }
    const id = crypto.randomUUID()
    const timestamp = nowIso()
    const batch = await database.batch([
      database.prepare(`
        INSERT INTO credit_usage_reservations (
          id, user_id, credit_pack_id, idempotency_key, purpose, status, created_at
        )
        SELECT ?, u.id, p.id, ?, ?, 'consumed', ?
        FROM users u
        JOIN credit_packs p ON p.user_id = u.id
        WHERE u.clerk_id = ?
          AND p.credits_remaining > 0
          AND p.refund_hold = 0
          AND p.expires_at > ?
          AND NOT EXISTS (
            SELECT 1 FROM credit_usage_reservations existing
            WHERE existing.user_id = u.id AND existing.idempotency_key = ?
          )
        ORDER BY p.purchased_at ASC
        LIMIT 1
        ON CONFLICT (user_id, idempotency_key) DO NOTHING
        RETURNING id
      `).bind(
        id,
        params.p_idempotency_key,
        params.p_purpose,
        timestamp,
        params.p_clerk_id,
        timestamp,
        params.p_idempotency_key,
      ),
      database.prepare(`
        UPDATE credit_packs
        SET credits_remaining = credits_remaining - 1
        WHERE id = (
          SELECT credit_pack_id FROM credit_usage_reservations WHERE id = ?
        ) AND credits_remaining > 0
      `).bind(id),
      database.prepare(`
        SELECT
          CASE WHEN r.status = 'consumed' THEN 1 ELSE 0 END AS consumed,
          COALESCE((
            SELECT SUM(p.credits_remaining) FROM credit_packs p
            WHERE p.user_id = r.user_id AND p.credits_remaining > 0
              AND p.refund_hold = 0 AND p.expires_at > ?
          ), 0) AS remaining,
          CASE WHEN r.id = ? THEN 0 ELSE 1 END AS is_replay
        FROM credit_usage_reservations r
        JOIN users u ON u.id = r.user_id
        WHERE u.clerk_id = ? AND r.idempotency_key = ?
        LIMIT 1
      `).bind(timestamp, id, params.p_clerk_id, params.p_idempotency_key),
    ])
    const row = batch[2]?.results?.[0] as Record<string, unknown> | undefined
    return [{
      consumed: row?.consumed === 1 || row?.consumed === true,
      remaining: Number(row?.remaining ?? 0),
      is_replay: row?.is_replay === 1 || row?.is_replay === true,
    }]
  }

  if (name === "refund_user_credit") {
    const token = crypto.randomUUID()
    const batch = await database.batch([
      database.prepare(`
        UPDATE credit_usage_reservations
        SET status = 'refunded', refund_token = ?
        WHERE id = (
          SELECT r.id FROM credit_usage_reservations r
          JOIN users u ON u.id = r.user_id
          WHERE u.clerk_id = ? AND r.idempotency_key = ? AND r.status = 'consumed'
          LIMIT 1
        )
        RETURNING id
      `).bind(token, params.p_clerk_id, params.p_idempotency_key),
      database.prepare(`
        UPDATE credit_packs
        SET credits_remaining = credits_remaining + 1
        WHERE id = (
          SELECT credit_pack_id FROM credit_usage_reservations
          WHERE refund_token = ? AND status = 'refunded'
        )
      `).bind(token),
    ])
    return (batch[0]?.results?.length ?? 0) === 1
  }

  if (name === "record_api_key_usage") {
    const timestamp = nowIso()
    const batch = await database.batch([
      database.prepare(`
        UPDATE api_keys
        SET request_count = request_count + 1, last_used_at = ?, updated_at = ?
        WHERE id = ? AND is_active = 1
        RETURNING user_id
      `).bind(timestamp, timestamp, params.p_api_key_id),
      database.prepare(`
        INSERT INTO api_usage_logs (
          id, api_key_id, user_id, endpoint, status_code, response_time_ms, message, created_at
        )
        SELECT ?, id, user_id, ?, ?, ?, ?, ?
        FROM api_keys WHERE id = ? AND is_active = 1
      `).bind(
        crypto.randomUUID(),
        params.p_endpoint,
        params.p_status_code,
        params.p_response_time_ms,
        params.p_message ?? null,
        timestamp,
        params.p_api_key_id,
      ),
    ])
    if ((batch[0]?.results?.length ?? 0) !== 1) {
      throw new Error("API key is inactive or missing")
    }
    return null
  }

  if (name === "subscribe_monitoring_with_identity_limit") {
    const allowedTypes = new Set([
      "terms_of_service", "terms_of_use", "terms_and_conditions",
      "privacy_policy", "acceptable_use_policy", "cookie_policy", "eula", "other",
    ])
    if (
      !Number.isInteger(params.p_limit) || params.p_limit < 1 ||
      !["daily", "weekly", "monthly"].includes(params.p_frequency) ||
      !allowedTypes.has(params.p_document_type) ||
      typeof params.p_document_type_confidence !== "number" ||
      params.p_document_type_confidence < 0.85 ||
      !params.p_document_identity_key
    ) {
      throw new Error("Invalid monitoring subscription parameters")
    }
    const timestamp = nowIso()
    const row = await database.prepare(`
      INSERT INTO monitoring_subscriptions (
        id, user_id, url, domain, title, frequency, is_active,
        document_type, document_type_confidence, document_type_source,
        document_type_evidence, document_identity_key,
        verification_status, verification_message, created_at, updated_at
      )
      SELECT ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 'active', NULL, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM monitoring_subscriptions WHERE user_id = ? AND url = ?
      ) OR (
        SELECT COUNT(*) FROM monitoring_subscriptions WHERE user_id = ? AND is_active = 1
      ) < ?
      ON CONFLICT (user_id, url) DO UPDATE SET
        domain = excluded.domain,
        title = excluded.title,
        frequency = excluded.frequency,
        is_active = 1,
        document_type = excluded.document_type,
        document_type_confidence = excluded.document_type_confidence,
        document_type_source = excluded.document_type_source,
        document_type_evidence = excluded.document_type_evidence,
        document_identity_key = excluded.document_identity_key,
        verification_status = 'active',
        verification_message = NULL,
        updated_at = excluded.updated_at
      RETURNING *
    `).bind(
      crypto.randomUUID(),
      params.p_user_id,
      params.p_url,
      params.p_domain,
      params.p_title ?? null,
      params.p_frequency,
      params.p_document_type,
      params.p_document_type_confidence,
      params.p_document_type_source ?? null,
      scalar(params.p_document_type_evidence ?? []),
      params.p_document_identity_key,
      timestamp,
      timestamp,
      params.p_user_id,
      params.p_url,
      params.p_user_id,
      params.p_limit,
    ).first<Record<string, unknown>>()
    if (!row) {
      const error = databaseError("monitor_limit_reached")
      error.code = "P0001"
      throw error
    }
    return normalizeRow("monitoring_subscriptions", row)
  }

  if (name === "claim_monitoring_alert_email") {
    const timestamp = params.p_now ?? nowIso()
    const row = await database.prepare(`
      UPDATE monitoring_alerts
      SET email_status = 'sending',
          email_attempts = email_attempts + 1,
          email_last_attempt_at = ?,
          email_last_error = NULL
      WHERE id = ?
        AND is_email_sent = 0
        AND email_status IN ('pending', 'failed')
        AND email_next_attempt_at <= ?
      RETURNING *
    `).bind(timestamp, params.p_alert_id, timestamp).first<Record<string, unknown>>()
    return row ? normalizeRow("monitoring_alerts", row) : null
  }

  throw new Error(`Unsupported database operation: ${name}`)
}

export class DatabaseClient {
  readonly binding: D1DatabaseLike

  constructor(binding: D1DatabaseLike) {
    this.binding = binding
  }

  from(table: string): DatabaseQueryBuilder {
    return new DatabaseQueryBuilder(this.binding, table)
  }

  async rpc(name: string, params: Record<string, any> = {}): Promise<DatabaseResult<any>> {
    try {
      return { data: await runRpc(this.binding, name, params), error: null, count: null }
    } catch (reason) {
      return { data: null, error: databaseError(reason), count: null }
    }
  }
}

export function createDatabaseClient(binding: D1DatabaseLike): DatabaseClient {
  return new DatabaseClient(binding)
}
