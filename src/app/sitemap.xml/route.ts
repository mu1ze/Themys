import {
  SITEMAP_REVALIDATE_SECONDS,
  buildSitemapEntries,
  renderSitemapXml,
  resolveSitemapOrigin,
} from "@/lib/sitemap-entries"

/**
 * ISR: rebuild hourly. Must stay a literal — Next statically analyses segment
 * config exports and rejects imported values ("Invalid segment configuration
 * export").
 */
export const revalidate = 3600

export function GET() {
  const xml = renderSitemapXml(buildSitemapEntries(resolveSitemapOrigin()))

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": `public, max-age=0, s-maxage=${SITEMAP_REVALIDATE_SECONDS}, must-revalidate`,
    },
  })
}
