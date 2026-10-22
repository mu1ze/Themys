import { createHash } from "node:crypto"

import {
  createCloudflareD1AdminClient,
  deleteCloudflareR2Object,
  getCloudflareR2Object,
  uploadCloudflareR2Object,
} from "./lib/cloudflare-admin.mjs"

const PAGE_SIZE = 250
const WRITE_BATCH_SIZE = 50

const TABLES = [
  { name: "users", conflict: "id" },
  { name: "regulations", conflict: "code", transform: transformRegulation },
  { name: "scans", conflict: "id", transform: transformScan },
  { name: "clauses", conflict: "id" },
  { name: "blocklist_items", conflict: "id" },
  { name: "tos_cache", conflict: "url_hash" },
  { name: "explanations_cache", conflict: "clause_hash" },
  { name: "credit_packs", conflict: "id" },
  { name: "invoices", conflict: "id", resumeConflicts: ["stripe_invoice_id", "stripe_payment_id"] },
  { name: "stripe_events", conflict: "id" },
  { name: "full_extraction_sections", conflict: "id" },
  { name: "full_extraction_points", conflict: "id" },
  { name: "docs_feedback", conflict: "id" },
  { name: "monitoring_subscriptions", conflict: "id" },
  { name: "tos_snapshots", conflict: "id", transform: transformTosSnapshot },
  { name: "monitoring_alerts", conflict: "id" },
  { name: "clause_compliance_tags", conflict: "id", transform: transformComplianceTag },
  { name: "api_keys", conflict: "id" },
  { name: "api_usage_logs", conflict: "id" },
  { name: "api_rate_limits", conflict: "bucket_key" },
  { name: "usage_reservations", conflict: "id" },
  { name: "credit_usage_reservations", conflict: "id" },
  { name: "usage_events", conflict: "id" },
]

const args = new Set(process.argv.slice(2))
const apply = args.has("--apply")
const verifyOnly = args.has("--verify-only")
const resume = args.has("--resume")

if (apply && verifyOnly) throw new Error("Choose either --apply or --verify-only")
if (apply && !args.has("--source-writes-paused")) {
  throw new Error("--apply requires --source-writes-paused after the application has entered maintenance mode")
}

const sourceUrl = required("SOURCE_POSTGREST_URL").replace(/\/$/, "")
const sourceServiceRole = required("SOURCE_POSTGREST_SERVICE_ROLE")
const database = createCloudflareD1AdminClient()
const destinationColumns = new Map()
const destinationIdentitySets = new Map()
const regulationIdMap = new Map()
const sourceCounts = new Map()
const destinationCountsBefore = new Map()
const migratedObjects = { expected: 0, verified: 0 }
const deferredPreviousScans = []

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function sourceHeaders(extra = {}) {
  return {
    apikey: sourceServiceRole,
    Authorization: `Bearer ${sourceServiceRole}`,
    ...extra,
  }
}

function sourceTableUrl(table, offset, limit) {
  const url = new URL(`${sourceUrl}/rest/v1/${encodeURIComponent(table)}`)
  url.searchParams.set("select", "*")
  url.searchParams.set("limit", String(limit))
  url.searchParams.set("offset", String(offset))
  const conflict = TABLES.find((definition) => definition.name === table)?.conflict
  if (conflict) url.searchParams.set("order", `${conflict}.asc`)
  return url
}

async function sourcePage(table, offset = 0, limit = PAGE_SIZE) {
  const response = await fetch(sourceTableUrl(table, offset, limit), {
    headers: sourceHeaders({ Prefer: "count=exact" }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) {
    throw new Error(`Source read for ${table} failed with HTTP ${response.status}`)
  }
  const rows = await response.json()
  if (!Array.isArray(rows)) throw new Error(`Source read for ${table} returned an invalid payload`)
  const totalValue = response.headers.get("content-range")?.split("/").at(-1)
  const total = totalValue && totalValue !== "*" ? Number(totalValue) : null
  return { rows, total: Number.isFinite(total) ? total : null }
}

async function sourceCount(table) {
  const page = await sourcePage(table, 0, 1)
  return page.total ?? page.rows.length
}

async function destinationCounts() {
  const results = await database.binding.batch(TABLES.map((definition) =>
    database.binding.prepare(`SELECT COUNT(*) AS count FROM "${definition.name}"`)
  ))
  return new Map(TABLES.map((definition, index) => [
    definition.name,
    Number(results[index]?.results?.[0]?.count ?? 0),
  ]))
}

async function columnsFor(table) {
  if (destinationColumns.has(table)) return destinationColumns.get(table)
  const result = await database.binding.prepare(`PRAGMA table_info("${table}")`).all()
  const columns = new Set((result.results ?? []).map((row) => row.name).filter(Boolean))
  if (columns.size === 0) throw new Error(`Destination table ${table} is missing; apply D1 migrations first`)
  destinationColumns.set(table, columns)
  return columns
}

async function preloadDestinationColumns() {
  const results = await database.binding.batch(TABLES.map((definition) =>
    database.binding.prepare(`PRAGMA table_info("${definition.name}")`)
  ))
  for (let index = 0; index < TABLES.length; index++) {
    const table = TABLES[index].name
    const columns = new Set((results[index]?.results ?? []).map((row) => row.name).filter(Boolean))
    if (columns.size === 0) throw new Error(`Destination table ${table} is missing; apply D1 migrations first`)
    destinationColumns.set(table, columns)
  }
}

async function preloadDestinationIdentities() {
  const results = await database.binding.batch(TABLES.map((definition) =>
    database.binding.prepare(
      `SELECT ${identityColumns(definition).map((column) => `"${column}"`).join(", ")} FROM "${definition.name}"`,
    )
  ))
  for (let index = 0; index < TABLES.length; index++) {
    const definition = TABLES[index]
    destinationIdentitySets.set(
      definition.name,
      identityTokenSet(definition, results[index]?.results ?? []),
    )
  }
}

function identityColumns(definition) {
  return [definition.conflict, ...(definition.resumeConflicts ?? [])]
}

function identityToken(column, value) {
  return value === null || value === undefined ? null : JSON.stringify([column, value])
}

function identityTokenSet(definition, rows) {
  const tokens = new Set()
  for (const row of rows) {
    for (const column of identityColumns(definition)) {
      const token = identityToken(column, row[column])
      if (token !== null) tokens.add(token)
    }
  }
  return tokens
}

function hasDestinationIdentity(definition, row, identities) {
  return identityColumns(definition).some((column) => {
    const token = identityToken(column, row[column])
    return token !== null && identities?.has(token)
  })
}

function filterDestinationColumns(row, columns) {
  return Object.fromEntries(Object.entries(row).filter(([column]) => columns.has(column)))
}

function allowsPostCutoverDestinationRows(definition) {
  return verifyOnly || resume
}

function regulationId(code) {
  return `reg_${String(code).toLowerCase()}`
}

async function transformRegulation(row) {
  const id = regulationId(row.code)
  regulationIdMap.set(row.id, id)
  return { ...row, id }
}

async function transformComplianceTag(row) {
  const regulation_id = regulationIdMap.get(row.regulation_id)
  if (!regulation_id) throw new Error("A compliance tag references an unknown regulation")
  return { ...row, regulation_id }
}

function transformTosSnapshot(row) {
  return {
    ...row,
    flagged_count: row.flagged_count ?? 0,
    clause_count: row.clause_count ?? 0,
  }
}

function scanObjectKey(row) {
  return `scans/${row.user_id}/${row.id}/raw.txt`
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

async function transformScan(row) {
  const previousScanId = row.previous_scan_id ?? null
  if (previousScanId) deferredPreviousScans.push({ id: row.id, previous_scan_id: previousScanId })

  if (row.is_deleted || typeof row.raw_text !== "string" || row.raw_text.length === 0) {
    if (apply) await deleteCloudflareR2Object(scanObjectKey(row))
    return { ...row, previous_scan_id: null, raw_text: null, document_object_key: null }
  }

  const key = scanObjectKey(row)
  migratedObjects.expected++
  if (apply) {
    await uploadCloudflareR2Object(key, row.raw_text)
  }
  return {
    ...row,
    previous_scan_id: null,
    raw_text: null,
    document_object_key: key,
  }
}

async function writeRows(table, conflict, rows) {
  for (let index = 0; index < rows.length; index += WRITE_BATCH_SIZE) {
    const batch = rows.slice(index, index + WRITE_BATCH_SIZE)
    const result = resume
      ? await database.from(table).insert(batch)
      : await database.from(table).upsert(batch, { onConflict: conflict })
    if (result.error) throw new Error(`Destination write for ${table} failed`, { cause: result.error })
  }
}

async function migrateTable(definition) {
  const columns = await columnsFor(definition.name)
  const existingIdentities = destinationIdentitySets.get(definition.name)
  let offset = 0
  let migrated = 0
  let preserved = 0
  while (true) {
    const { rows } = await sourcePage(definition.name, offset)
    if (rows.length === 0) break
    const transformed = []
    for (const row of rows) {
      if (hasDestinationIdentity(definition, row, existingIdentities)) {
        // Compliance-tag transforms need the stable regulation id mapping even
        // when that regulation already exists in the active D1 destination.
        if (definition.name === "regulations") await transformRegulation(row)
        preserved++
        continue
      }
      const result = definition.transform ? await definition.transform(row) : row
      transformed.push(filterDestinationColumns(result, columns))
      for (const column of identityColumns(definition)) {
        const token = identityToken(column, result[column])
        if (token !== null) existingIdentities?.add(token)
      }
    }
    if (apply) await writeRows(definition.name, definition.conflict, transformed)
    migrated += transformed.length
    offset += rows.length
    if (rows.length < PAGE_SIZE) break
  }
  const preservedMessage = preserved > 0 ? `; preserved ${preserved} existing D1 rows` : ""
  console.log(`${definition.name}: ${apply ? "migrated" : "planned"} ${migrated} rows${preservedMessage}`)
}

async function restorePreviousScanLinks() {
  if (!apply) return
  for (const link of deferredPreviousScans) {
    const result = await database.from("scans")
      .update({ previous_scan_id: link.previous_scan_id })
      .eq("id", link.id)
    if (result.error) throw new Error("Failed to restore scan version links", { cause: result.error })
  }
}

async function collectCounts() {
  const [sources, destinations] = await Promise.all([
    Promise.all(TABLES.map((definition) => sourceCount(definition.name))),
    destinationCounts(),
  ])
  for (let index = 0; index < TABLES.length; index++) {
    const definition = TABLES[index]
    const source = sources[index]
    const destination = destinations.get(definition.name) ?? 0
    sourceCounts.set(definition.name, source)
    destinationCountsBefore.set(definition.name, destination)
  }
}

function printCountComparison() {
  console.log("Source → D1 row-count comparison")
  for (const definition of TABLES) {
    const source = sourceCounts.get(definition.name) ?? 0
    const destination = destinationCountsBefore.get(definition.name) ?? 0
    const difference = destination - source
    const status = difference === 0
      ? "match"
      : difference > 0
        ? `D1 has ${difference} additional row${difference === 1 ? "" : "s"}`
        : `D1 is missing at least ${Math.abs(difference)} row${difference === -1 ? "" : "s"}`
    console.log(`${definition.name}: source=${source}, D1=${destination} (${status})`)
  }
}

async function verifyCounts() {
  let mismatches = 0
  const [sourcesAfter, destinationsAfter] = await Promise.all([
    Promise.all(TABLES.map((definition) => sourceCount(definition.name))),
    destinationCounts(),
  ])
  for (let index = 0; index < TABLES.length; index++) {
    const definition = TABLES[index]
    const sourceAfter = sourcesAfter[index]
    const destinationAfter = destinationsAfter.get(definition.name) ?? 0
    const sourceBefore = sourceCounts.get(definition.name)
    const destinationMatchesSource =
      destinationAfter === sourceBefore
      || (allowsPostCutoverDestinationRows(definition) && destinationAfter >= sourceBefore)
    if (sourceAfter !== sourceBefore || !destinationMatchesSource) {
      mismatches++
      console.error(
        `${definition.name}: source before=${sourceBefore}, source after=${sourceAfter}, destination=${destinationAfter}`,
      )
    } else if (destinationAfter > sourceBefore) {
      console.warn(
        `${definition.name}: allowing ${destinationAfter - sourceBefore} destination-only post-cutover rows`,
      )
    }
  }
  if (mismatches > 0) throw new Error(`Migration verification found ${mismatches} row-count mismatches`)
}

async function sourceIdentities(definition) {
  const identities = []
  let offset = 0
  while (true) {
    const { rows } = await sourcePage(definition.name, offset)
    identities.push(...rows.map((row) => row[definition.conflict]))
    offset += rows.length
    if (rows.length < PAGE_SIZE) break
  }
  return identities
}

async function destinationIdentities(definition) {
  const identities = []
  let offset = 0
  while (true) {
    const result = await database.binding
      .prepare(
        `SELECT "${definition.conflict}" AS identity FROM "${definition.name}" ORDER BY "${definition.conflict}" ASC LIMIT ? OFFSET ?`,
      )
      .bind(PAGE_SIZE, offset)
      .all()
    const rows = result.results ?? []
    identities.push(...rows.map((row) => row.identity))
    offset += rows.length
    if (rows.length < PAGE_SIZE) break
  }
  return identities
}

async function destinationIdentityRows(definition) {
  const rows = []
  let offset = 0
  const columns = identityColumns(definition).map((column) => `"${column}"`).join(", ")
  while (true) {
    const result = await database.binding
      .prepare(
        `SELECT ${columns} FROM "${definition.name}" ORDER BY "${definition.conflict}" ASC LIMIT ? OFFSET ?`,
      )
      .bind(PAGE_SIZE, offset)
      .all()
    const page = result.results ?? []
    rows.push(...page)
    offset += page.length
    if (page.length < PAGE_SIZE) break
  }
  return rows
}

async function sourceIdentityRows(definition) {
  const rows = []
  let offset = 0
  while (true) {
    const page = await sourcePage(definition.name, offset)
    rows.push(...page.rows)
    offset += page.rows.length
    if (page.rows.length < PAGE_SIZE) break
  }
  return rows
}

function identityDigest(identities) {
  const hash = createHash("sha256")
  const serialized = identities
    .map((identity) => JSON.stringify(identity))
    .sort()
  for (const identity of serialized) hash.update(`${identity}\n`)
  return hash.digest("hex")
}

async function verifyIdentities() {
  for (const definition of TABLES) {
    if (allowsPostCutoverDestinationRows(definition) && definition.resumeConflicts) {
      const [sourceRows, destinationRows] = await Promise.all([
        sourceIdentityRows(definition),
        destinationIdentityRows(definition),
      ])
      const destinationTokens = identityTokenSet(definition, destinationRows)
      const missing = sourceRows.filter((row) => !hasDestinationIdentity(definition, row, destinationTokens))
      if (missing.length > 0) {
        throw new Error(`Identity verification failed for ${definition.name}: ${missing.length} source rows are missing`)
      }
      continue
    }

    const [source, destination] = await Promise.all([
      sourceIdentities(definition),
      destinationIdentities(definition),
    ])

    if (allowsPostCutoverDestinationRows(definition)) {
      const destinationIds = new Set(destination.map((identity) => JSON.stringify(identity)))
      const missing = source.filter((identity) => !destinationIds.has(JSON.stringify(identity)))
      if (missing.length > 0) {
        throw new Error(`Primary-key verification failed for ${definition.name}: ${missing.length} source identities are missing`)
      }
      continue
    }

    if (identityDigest(source) !== identityDigest(destination)) {
      throw new Error(`Primary-key verification failed for ${definition.name}`)
    }
  }
}

async function verifyScanObjects() {
  migratedObjects.expected = 0
  migratedObjects.verified = 0
  let offset = 0
  while (true) {
    const { rows } = await sourcePage("scans", offset)
    if (rows.length === 0) break
    const ids = rows.map((row) => row.id)
    const destination = await database.from("scans")
      .select("id, document_object_key")
      .in("id", ids)
    if (destination.error) throw new Error("Could not verify destination scan metadata", { cause: destination.error })
    const keys = new Map((destination.data ?? []).map((row) => [row.id, row.document_object_key]))

    for (const row of rows) {
      const shouldHaveObject = !row.is_deleted && typeof row.raw_text === "string" && row.raw_text.length > 0
      const expectedKey = shouldHaveObject ? scanObjectKey(row) : null
      if ((keys.get(row.id) ?? null) !== expectedKey) {
        throw new Error(`Destination object metadata does not match scan ${row.id}`)
      }
      const object = await getCloudflareR2Object(scanObjectKey(row))
      if (!shouldHaveObject) {
        if (object !== null) throw new Error(`Deleted or empty scan ${row.id} still has an R2 document`)
        continue
      }
      migratedObjects.expected++
      if (object === null || sha256(object) !== sha256(row.raw_text)) {
        throw new Error(`R2 integrity verification failed for scan ${row.id}`)
      }
      migratedObjects.verified++
    }
    offset += rows.length
    if (rows.length < PAGE_SIZE) break
  }
}

console.log(apply ? "Cloudflare migration apply" : verifyOnly ? "Cloudflare migration verification" : "Cloudflare migration dry run")
await collectCounts()
printCountComparison()

const existingUsers = destinationCountsBefore.get("users") ?? 0
if (apply && existingUsers > 0 && !resume) {
  throw new Error("Destination already contains users; rerun with --resume only after confirming this is the same migration")
}

if (!verifyOnly) {
  await preloadDestinationColumns()
  if (apply && resume) await preloadDestinationIdentities()
  for (const definition of TABLES) await migrateTable(definition)
  await restorePreviousScanLinks()
}

if (apply || verifyOnly) {
  await verifyCounts()
  await verifyIdentities()
  await verifyScanObjects()
  if (apply && migratedObjects.verified !== migratedObjects.expected) {
    throw new Error("Not every expected scan body passed R2 integrity verification")
  }
}

console.log(
  apply
    ? `Migration verified: ${migratedObjects.verified} private scan objects and all relational row counts match.`
    : verifyOnly
      ? "Verification passed: source and destination row counts match."
      : `Dry run complete: ${migratedObjects.expected} active scan bodies would move to private R2.`,
)
