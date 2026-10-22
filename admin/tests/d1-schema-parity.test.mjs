import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const repositoryRoot = join(import.meta.dirname, "..", "..");

function combinedSql(directory) {
  return readdirSync(join(repositoryRoot, directory))
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(join(repositoryRoot, directory, file), "utf8"))
    .join("\n");
}

function createdTables(sql) {
  return new Set([...sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+(?:public\.)?["`]?([a-zA-Z_][\w]*)/gi)]
    .map((match) => match[1])
    .filter((table) => !table.endsWith("_new")));
}

test("D1 schema and migration copy cover every legacy Supabase table", () => {
  const supabaseTables = createdTables(combinedSql("supabase/migrations"));
  const d1Tables = createdTables(combinedSql("d1/migrations"));
  const migrationScript = readFileSync(
    join(repositoryRoot, "scripts/migrate-legacy-postgrest-to-cloudflare.mjs"),
    "utf8",
  );
  const adminInventory = readFileSync(
    join(repositoryRoot, "src/features/admin/data-inventory.ts"),
    "utf8",
  );
  const copiedTables = new Set(
    [...migrationScript.matchAll(/\{ name: "([a-z_]+)"/g)].map((match) => match[1]),
  );
  const visibleInAdmin = new Set(
    [...adminInventory.matchAll(/\{ table: "([a-z_]+)"/g)].map((match) => match[1]),
  );

  // Billing operations are D1-only additions after the legacy PostgREST copy.
  for (const table of supabaseTables) assert.ok(d1Tables.has(table), `${table} missing from D1`);
  assert.deepEqual([...copiedTables].sort(), [...supabaseTables].sort());
  assert.deepEqual([...visibleInAdmin].sort(), [...d1Tables].sort());
  assert.equal(supabaseTables.size, 23);
});

test("admin inventory batches counts without a compound SELECT", () => {
  const server = readFileSync(
    join(repositoryRoot, "src/features/admin/metrics/server.ts"),
    "utf8",
  );
  assert.match(server, /binding\.batch/);
  assert.doesNotMatch(server, /UNION ALL/);
});

test("cache inventory paginates within the active KV list limit", () => {
  const queries = readFileSync(
    join(repositoryRoot, "src/lib/admin-queries.ts"),
    "utf8",
  );
  const start = queries.indexOf("export async function getCacheOverview");
  const end = queries.indexOf("export async function getSystemHealth", start);
  const cacheOverview = queries.slice(start, end);
  assert.match(cacheOverview, /limit: 999/);
  assert.doesNotMatch(cacheOverview, /limit: 10000/);
});

test("resume migration preserves active D1 rows instead of overwriting them", () => {
  const migration = readFileSync(
    join(repositoryRoot, "scripts/migrate-legacy-postgrest-to-cloudflare.mjs"),
    "utf8",
  );
  assert.match(migration, /preloadDestinationIdentities/);
  assert.match(migration, /hasDestinationIdentity\(definition, row, existingIdentities\)/);
  assert.match(migration, /resumeConflicts: \["stripe_invoice_id", "stripe_payment_id"\]/);
  assert.match(migration, /resume\s*\?\s*await database\.from\(table\)\.insert\(batch\)/);
});

test("admin development reads the populated remote Cloudflare data bindings", () => {
  const config = JSON.parse(readFileSync(join(repositoryRoot, "admin/wrangler.jsonc"), "utf8"));
  const d1 = config.d1_databases.find((binding) => binding.binding === "DB");
  const r2 = config.r2_buckets.find((binding) => binding.binding === "DOCUMENTS_BUCKET");
  const dataCache = config.kv_namespaces.find((binding) => binding.binding === "CACHE_KV");
  const nextCache = config.kv_namespaces.find((binding) => binding.binding === "NEXT_INC_CACHE_KV");

  assert.equal(d1.database_id, "237af800-948d-47ee-bdb2-c5d4500ca937");
  assert.equal(d1.remote, true);
  assert.equal(r2.remote, true);
  assert.equal(dataCache.remote, true);
  assert.notEqual(nextCache.remote, true);
});

test("users table keeps render callbacks inside the client boundary", () => {
  const page = readFileSync(join(repositoryRoot, "src/app/admin/users/page.tsx"), "utf8");
  const usersList = readFileSync(
    join(repositoryRoot, "src/components/admin/users-list-client.tsx"),
    "utf8",
  );

  assert.match(page, /<UsersListClient/);
  assert.doesNotMatch(page, /getRowKey=|rowHref=|render:\s*\(/);
  assert.match(usersList, /^"use client";/);
  assert.match(usersList, /getRowKey=\{\(row\) => row\.id\}/);
  assert.match(usersList, /rowHref=\{\(row\) => `\/admin\/users\/\$\{row\.id\}`\}/);
});

test("clickable admin rows navigate directly instead of using a covered overlay link", () => {
  const table = readFileSync(
    join(repositoryRoot, "src/components/admin/admin-table.tsx"),
    "utf8",
  );

  assert.match(table, /onClick=\{\(event\) => openRow\(event, href\)\}/);
  assert.match(table, /router\.push\(href\)/);
  assert.doesNotMatch(table, /className="absolute inset-0 z-0"/);
});

test("scan directory deduplicates and paginates in D1 without a silent row cap", () => {
  const queries = readFileSync(
    join(repositoryRoot, "src/lib/admin-queries.ts"),
    "utf8",
  );
  const start = queries.indexOf("export async function listAllScans");
  const end = queries.indexOf("export async function getAdminScanDetail", start);
  const scanDirectory = queries.slice(start, end);

  assert.match(scanDirectory, /ROW_NUMBER\(\) OVER/);
  assert.match(scanDirectory, /GROUP BY substr\(raw_text_hash, 1, 16\)/);
  assert.match(scanDirectory, /LIMIT \? OFFSET \?/);
  assert.doesNotMatch(scanDirectory, /4999|5000/);
});

test("dedicated admin mirrors every shared bulk scan endpoint", () => {
  const bulk = readFileSync(
    join(repositoryRoot, "admin/src/app/api/admin/scans/bulk/route.ts"),
    "utf8",
  );
  const exportRoute = readFileSync(
    join(repositoryRoot, "admin/src/app/api/admin/scans/bulk/export/route.ts"),
    "utf8",
  );

  assert.match(bulk, /export \{ POST \} from "@\/app\/api\/admin\/scans\/bulk\/route"/);
  assert.match(exportRoute, /export \{ POST \} from "@\/app\/api\/admin\/scans\/bulk\/export\/route"/);
});

test("measurement routes keep distinct decision content", () => {
  const dashboard = readFileSync(
    join(repositoryRoot, "src/components/admin/founder-dashboard.tsx"),
    "utf8",
  );

  assert.match(dashboard, /view === "growth"[\s\S]*Paywall → checkout/);
  assert.match(dashboard, /view === "revenue"[\s\S]*Recorded collections/);
  assert.match(dashboard, /view === "reliability"[\s\S]*p95 backend time/);
  assert.match(dashboard, /view === "usage"[\s\S]*Cache reuse/);
});
