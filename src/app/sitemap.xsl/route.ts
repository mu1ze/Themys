import { SITEMAP_XSL, SITEMAP_XSL_CONTENT_TYPE } from "@/lib/sitemap-stylesheet"

/** Serves the XSLT stylesheet referenced by `sitemap.xml`. */
export const dynamic = "force-static"

export function GET() {
  return new Response(SITEMAP_XSL, {
    headers: {
      "content-type": SITEMAP_XSL_CONTENT_TYPE,
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  })
}
