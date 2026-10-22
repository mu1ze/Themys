/**
 * Single source of truth for the docs sitemap: the URL set, the XML
 * serializer, and the XSLT stylesheet.
 *
 * `docs` is a static export (`output: "export"`), so a route handler cannot
 * serve /sitemap.xml — the file is generated into `public/` before
 * `next build` and copied into `out/` (see scripts/generate-sitemap.mjs).
 * scripts/verify-export.mjs re-derives the same list and fails the build if
 * the emitted file drifts from it.
 */
import { readdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"

import matter from "gray-matter"

export const DOCS_ORIGIN = (process.env.DOCS_ORIGIN ?? "https://docs.themys.ca").replace(/\/$/, "")

export const SITEMAP_XSL_CONTENT_TYPE = "text/xsl; charset=utf-8"

/**
 * Consumer-facing pages only: documentation and the legal page. There is no
 * private surface in this app (no auth, no dashboards) — it is a static export
 * of public content.
 *
 * `trailingSlash: true` in next.config.ts makes `/quick-start/` the canonical
 * form, so every URL keeps its trailing slash; `/` stays bare.
 */
const STATIC_PAGES = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/legal/", changeFrequency: "yearly", priority: 0.3, hasLastModified: false },
]

const DOC_PAGE_DEFAULTS = { changeFrequency: "monthly", priority: 0.7 }

/** Frontmatter keys honoured as a page's last deliberate change. */
const LASTMOD_FRONTMATTER_KEYS = ["updated", "date"]

/**
 * Absolute URL for a page path. Home stays `/`, everything else keeps the
 * trailing slash `trailingSlash: true` puts in the canonical link.
 */
export function absoluteUrl(path) {
  return path === "/" ? `${DOCS_ORIGIN}/` : `${DOCS_ORIGIN}${path}`
}

function toDate(value) {
  if (!value) return undefined
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? undefined : date
}

/**
 * Every public docs URL.
 *
 * `lastmod` is only emitted when a document carries an `updated`/`date`
 * frontmatter key. File mtimes are deliberately not used: in CI a checkout
 * resets them to the build time, which would stamp every page as modified on
 * every deploy — the one thing that makes crawlers ignore lastmod entirely.
 */
export async function collectSitemapEntries(root = resolve(import.meta.dirname, "..")) {
  const contentDir = resolve(root, "src/app/content")
  const markdownFiles = (await readdir(contentDir)).filter((name) => name.endsWith(".md")).sort()

  const docEntries = await Promise.all(
    markdownFiles.map(async (name) => {
      const slug = name.replace(/\.md$/, "")
      const raw = await readFile(resolve(contentDir, name), "utf8")
      const { data } = matter(raw)
      const lastModified = LASTMOD_FRONTMATTER_KEYS.map((key) => toDate(data[key])).find(Boolean)

      return {
        url: absoluteUrl(`/${slug}/`),
        lastModified,
        ...DOC_PAGE_DEFAULTS,
      }
    }),
  )

  const staticEntries = STATIC_PAGES.map((page) => ({
    url: absoluteUrl(page.path),
    lastModified: undefined,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }))

  return [...staticEntries, ...docEntries]
}

function escapeXml(value) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char],
  )
}

function line(tag, value) {
  return `  <${tag}>${escapeXml(value)}</${tag}>`
}

/**
 * Sitemaps-protocol XML. The stylesheet PI is what makes a browser render this
 * as a table instead of raw text; crawlers ignore it.
 */
export function renderSitemapXml(entries, stylesheetHref = "/sitemap.xsl") {
  const body = entries
    .map((entry) => {
      const parts = [line("loc", entry.url)]
      if (entry.lastModified) parts.push(line("lastmod", entry.lastModified.toISOString()))
      if (entry.changeFrequency) parts.push(line("changefreq", entry.changeFrequency))
      if (entry.priority !== undefined) parts.push(line("priority", String(entry.priority)))
      return `<url>\n${parts.join("\n")}\n</url>`
    })
    .join("\n")

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<?xml-stylesheet type="text/xsl" href="${escapeXml(stylesheetHref)}"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    body,
    `</urlset>`,
    ``,
  ].join("\n")
}

/**
 * XSLT 1.0 stylesheet. Served by worker.ts with an explicit `text/xsl` content
 * type — browsers silently skip a stylesheet whose MIME type is not an XSL or
 * XML type, and a `.xsl` asset is not guaranteed one.
 */
export const SITEMAP_XSL = `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>Themys Docs — XML sitemap</title>
        <style>
          :root { color-scheme: light dark; }
          body {
            margin: 0 auto; padding: 3rem 1.5rem 5rem; max-width: 54rem;
            background: #ffffff; color: #0f172a;
            font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
          }
          @media (prefers-color-scheme: dark) {
            body { background: #0b1220; color: #e6edf7; }
            .lede, th, .meta, footer { color: #93a3b8; }
            table, th, td { border-color: #1e293b; }
            th { background: #111c2e; }
            code { background: #16233a; }
            a { color: #60a5fa; }
          }
          h1 { font-size: 1.75rem; margin: 0 0 .4rem; letter-spacing: -.02em; }
          .lede { margin: 0 0 2rem; color: #55637a; max-width: 42rem; }
          code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .92em;
                 background: #f1f5f9; padding: .1rem .35rem; border-radius: .25rem; }
          h2 { font-size: .82rem; margin: 2.25rem 0 .6rem; color: #55637a;
               text-transform: uppercase; letter-spacing: .08em; font-weight: 600; }
          .count { font-weight: 400; opacity: .7; }
          table { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0;
                  border-radius: .5rem; overflow: hidden; }
          th, td { text-align: left; padding: .65rem .85rem; border-bottom: 1px solid #eef2f7; }
          th { background: #f8fafc; font-size: .75rem; text-transform: uppercase;
               letter-spacing: .05em; font-weight: 600; }
          tr:last-child td { border-bottom: 0; }
          a { color: #2563eb; text-decoration-thickness: 1px; text-underline-offset: 2px; }
          .path { word-break: break-all; }
          .meta { color: #55637a; white-space: nowrap; font-variant-numeric: tabular-nums; }
          footer { margin-top: 2.5rem; padding-top: 1.25rem; border-top: 1px solid #e2e8f0;
                   color: #55637a; font-size: .9rem; }
        </style>
      </head>
      <body>
        <h1>XML sitemap</h1>
        <p class="lede">
          The machine-readable sitemap for <code>docs.themys.ca</code> — the file search engines
          read directly. It lists public documentation and legal pages only. A browser-friendly
          rendering is below.
        </p>

        <h2>Pages <span class="count">(<xsl:value-of select="count(sm:urlset/sm:url)"/> URLs)</span></h2>
        <table>
          <thead>
            <tr>
              <th scope="col">URL</th>
              <th scope="col">Last modified</th>
              <th scope="col">Change freq.</th>
              <th scope="col">Priority</th>
            </tr>
          </thead>
          <tbody>
            <xsl:for-each select="sm:urlset/sm:url">
              <tr>
                <td class="path"><a href="{sm:loc}"><xsl:value-of select="sm:loc"/></a></td>
                <td class="meta"><xsl:value-of select="substring(sm:lastmod, 1, 10)"/></td>
                <td class="meta"><xsl:value-of select="sm:changefreq"/></td>
                <td class="meta"><xsl:value-of select="sm:priority"/></td>
              </tr>
            </xsl:for-each>
          </tbody>
        </table>

        <footer>
          Raw XML: <a href="/sitemap.xml">/sitemap.xml</a> · Product site:
          <a href="https://themys.ca/">themys.ca</a>
        </footer>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
`
