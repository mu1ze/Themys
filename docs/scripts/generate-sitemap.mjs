/**
 * Writes the docs sitemap into `public/`, which next build copies into `out/`.
 *
 * Runs as part of `pnpm build` (and therefore in CI) so the file can never go
 * stale relative to `src/app/content/*.md`. The generated files are ignored by
 * git — verify-export.mjs fails the build if the emitted XML drifts from the
 * content directory.
 */
import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

import {
  SITEMAP_XSL,
  collectSitemapEntries,
  renderSitemapXml,
} from "./sitemap-source.mjs"

const root = resolve(import.meta.dirname, "..")
const publicDir = resolve(root, "public")

const entries = await collectSitemapEntries(root)
await mkdir(publicDir, { recursive: true })
await writeFile(resolve(publicDir, "sitemap.xml"), renderSitemapXml(entries), "utf8")
await writeFile(resolve(publicDir, "sitemap.xsl"), SITEMAP_XSL, "utf8")

console.log(`Generated sitemap.xml with ${entries.length} public URLs (docs.themys.ca)`)
