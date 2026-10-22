import test from "node:test";
import assert from "node:assert/strict";

import {
  cloudflareAdminConfig,
  sqliteLiteral,
} from "../../scripts/lib/cloudflare-admin.mjs";

test("migration tooling defaults to Wrangler OAuth without an API token", () => {
  const config = cloudflareAdminConfig({});
  assert.equal(config.apiToken, null);
  assert.equal(config.databaseName, "themys-db");
  assert.equal(config.bucketName, "themys-documents");
});

test("Wrangler D1 parameters are encoded as safe SQLite literals", () => {
  assert.equal(sqliteLiteral("O'Reilly?"), "'O''Reilly?'");
  assert.equal(sqliteLiteral(42), "42");
  assert.equal(sqliteLiteral(null), "NULL");
  assert.throws(() => sqliteLiteral(Number.NaN), /finite numbers/);
});
