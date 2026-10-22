import assert from "node:assert/strict"
import test from "node:test"

import {
  PUBLIC_PAGES,
  buildSitemapEntries,
  renderSitemapXml,
} from "./sitemap-entries.ts"
import { SITEMAP_XSL, SITEMAP_XSL_CONTENT_TYPE } from "./sitemap-stylesheet.ts"

const ORIGIN = "https://themys.ca"

test("sitemap advertises only consumer-facing pages", () => {
  const urls = buildSitemapEntries(ORIGIN).map((entry) => entry.url)

  assert.deepEqual(urls, [`${ORIGIN}/`, `${ORIGIN}/pricing`, `${ORIGIN}/features`])

  // Transactional, private, or duplicate-intent surfaces must never appear.
  const banned = [
    "/sign-up",
    "/sign-in",
    "/pricing/success",
    "/pricing/cancel",
    "/extension-auth",
    "/landing-v2",
    "/dashboard",
    "/scan",
    "/history",
    "/settings",
    "/monitoring",
    "/admin",
    "/api",
  ]
  for (const url of urls) {
    const { pathname } = new URL(url)
    for (const prefix of banned) {
      assert.equal(
        pathname === prefix || pathname.startsWith(`${prefix}/`),
        false,
        `${url} is not consumer-facing`,
      )
    }
  }
})

test("sitemap entries are unique and fully described", () => {
  const entries = buildSitemapEntries(ORIGIN)
  const urls = entries.map((entry) => entry.url)

  assert.equal(new Set(urls).size, urls.length)
  assert.equal(entries.length, PUBLIC_PAGES.length)
  for (const entry of entries) {
    assert.ok(entry.lastModified instanceof Date, `${entry.url} needs a lastmod`)
    assert.ok(entry.changeFrequency, `${entry.url} needs a changefreq`)
    assert.equal(typeof entry.priority, "number")
    assert.ok(!Number.isNaN(entry.lastModified.getTime()))
  }
})

test("lastmod is a stable content date, never request time", () => {
  const first = buildSitemapEntries(ORIGIN)
  const second = buildSitemapEntries(ORIGIN)

  assert.deepEqual(
    first.map((entry) => entry.lastModified?.toISOString()),
    second.map((entry) => entry.lastModified?.toISOString()),
  )
  for (const entry of first) {
    assert.ok(
      (entry.lastModified as Date).getTime() <= Date.now(),
      `${entry.url} lastmod must not be in the future`,
    )
  }
})

test("origin handling produces absolute, well-formed URLs", () => {
  assert.equal(buildSitemapEntries(ORIGIN)[0].url, "https://themys.ca/")
  assert.equal(buildSitemapEntries("http://localhost:3000")[1].url, "http://localhost:3000/pricing")
})

test("rendered XML is Sitemaps-protocol valid and links the stylesheet", () => {
  const entries = buildSitemapEntries(ORIGIN)
  const xml = renderSitemapXml(entries)

  // The PI must precede the root element or browsers ignore it.
  const piIndex = xml.indexOf("<?xml-stylesheet")
  assert.ok(piIndex > -1)
  assert.ok(piIndex < xml.indexOf("<urlset"))
  assert.ok(xml.includes('href="/sitemap.xsl"'))
  assert.ok(xml.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'))

  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
  assert.deepEqual(locs, entries.map((entry) => entry.url))
  assert.equal((xml.match(/<url>/g) ?? []).length, entries.length)
  assert.equal((xml.match(/<\/url>/g) ?? []).length, entries.length)
  assert.ok(xml.trimEnd().endsWith("</urlset>"))
})

test("XML escaping keeps malformed values from breaking the document", () => {
  const xml = renderSitemapXml([{ url: "https://themys.ca/a&b<c" }])

  assert.ok(xml.includes("a&amp;b&lt;c"))
  assert.ok(!xml.includes("a&b<c"))
})

test("stylesheet is served as text/xsl and matches the emitted sitemap namespace", () => {
  assert.ok(SITEMAP_XSL_CONTENT_TYPE.includes("text/xsl"))
  assert.ok(SITEMAP_XSL.includes('xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9"'))
  assert.ok(SITEMAP_XSL.includes("sm:urlset/sm:url"))
  assert.ok(SITEMAP_XSL.includes("xsl:for-each"))
})
