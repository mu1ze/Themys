import { CANONICAL_PRODUCTION_ORIGIN, getAppOrigin } from "./app-origin.ts"

/**
 * Sitemap data for the public marketing site.
 *
 * Built as plain data rather than the `app/sitemap.ts` MetadataRoute
 * convention so `app/sitemap.xml/route.ts` can emit the raw XML with an
 * `xml-stylesheet` processing instruction — MetadataRoute has no hook for it.
 */

/** Rebuild hourly: cheap, and keeps deploys from being the only freshness signal. */
export const SITEMAP_REVALIDATE_SECONDS = 3600

export type ChangeFrequency =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never"

export type PublicPage = {
  /** Path on the canonical origin. */
  path: string
  changeFrequency: ChangeFrequency
  priority: number
  /**
   * Last deliberate copy change, taken from the git history of the page.
   *
   * Never `new Date()`: a lastmod that moves on every request is treated as
   * unreliable and discarded by crawlers, which is worse than omitting it.
   */
  lastModified: Date
}

/**
 * Consumer-facing pages only: what a signed-out visitor can read.
 *
 * `/features` describes the app surfaces (dashboard, scan, results, history,
 * monitoring, developer API) in public prose. It exists because those routes
 * sit behind Clerk and answer a crawler with a sign-in redirect, so this is the
 * only form in which their content can be indexed.
 *
 * Deliberately absent:
 * - `/sign-up`, `/sign-in` — transactional auth screens, not content. They
 *   must not be advertised for indexing.
 * - `/pricing/success`, `/pricing/cancel` — post-checkout states.
 * - `/extension-auth` — extension handshake, useless without the extension.
 * - `/dashboard`, `/scan`, `/history`, `/settings`, `/monitoring` — behind
 *   Clerk middleware (`src/lib/proxy-routing.ts`) and disallowed in robots.txt.
 * - `/admin` — redirects to the admin host (admin.themys.ca).
 * - `/landing-v2` — an unlinked visual variant of `/`, so listing it would
 *   have two URLs compete for the same intent.
 */
export const PUBLIC_PAGES: PublicPage[] = [
  {
    path: "/",
    changeFrequency: "weekly",
    priority: 1,
    lastModified: new Date("2026-09-06T00:00:00.000Z"),
  },
  {
    path: "/pricing",
    changeFrequency: "monthly",
    priority: 0.8,
    lastModified: new Date("2026-09-04T00:00:00.000Z"),
  },
  {
    path: "/features",
    changeFrequency: "monthly",
    priority: 0.8,
    lastModified: new Date("2026-09-12T00:00:00.000Z"),
  },
]

export type SitemapEntry = {
  url: string
  lastModified?: Date
  changeFrequency?: ChangeFrequency
  priority?: number
}

/**
 * Absolute origin for sitemap URLs. Falls back to the canonical production
 * origin rather than throwing, so a missing APP_URL degrades to a usable
 * sitemap instead of a 500 on /sitemap.xml.
 */
export function resolveSitemapOrigin(): string {
  try {
    return getAppOrigin()
  } catch {
    return CANONICAL_PRODUCTION_ORIGIN
  }
}

const absolute = (origin: string, path: string) =>
  path === "/" ? `${origin}/` : `${origin}${path}`

/** Every public URL, deduped, in declaration order. */
export function buildSitemapEntries(origin: string): SitemapEntry[] {
  const entries: SitemapEntry[] = []
  const seen = new Set<string>()

  for (const page of PUBLIC_PAGES) {
    const url = absolute(origin, page.path)
    if (seen.has(url)) continue
    seen.add(url)
    entries.push({
      url,
      lastModified: page.lastModified,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })
  }

  return entries
}

const escapeXml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char] as string,
  )

const line = (tag: string, value: string) => `  <${tag}>${escapeXml(value)}</${tag}>`

/**
 * Sitemaps-protocol XML. The stylesheet PI is what makes a browser render
 * this as a table instead of a wall of text; crawlers ignore it.
 */
export function renderSitemapXml(
  entries: SitemapEntry[],
  stylesheetHref = "/sitemap.xsl",
): string {
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
