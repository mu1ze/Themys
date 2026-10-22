import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const sourcePath = path.join(root, "supabase/migrations/20260704000000_add_compliance_frameworks.sql")
const destinationPath = path.join(root, "d1/migrations/0002_seed_regulations.sql")
const source = await readFile(sourcePath, "utf8")
const start = source.indexOf("INSERT INTO regulations")
const endMarker = "ON CONFLICT (code) DO NOTHING;"
const end = source.indexOf(endMarker, start)

if (start < 0 || end < 0) {
  throw new Error("Could not locate the canonical regulations seed block")
}

const seed = source
  .slice(start, end + endMarker.length)
  .replace(
    "INSERT INTO regulations (code, full_name, jurisdiction, category, articles, effective_date, url)",
    "INSERT INTO regulations (id, code, full_name, jurisdiction, category, articles, effective_date, url)",
  )
  .replace(/^\('([A-Z_]+)',/gm, (_match, code) => `('reg_${code.toLowerCase()}', '${code}',`)
  .replaceAll("::jsonb", "")

await writeFile(
  destinationPath,
  `-- Generated from the canonical regulations registry.\n${seed}\n`,
  "utf8",
)
