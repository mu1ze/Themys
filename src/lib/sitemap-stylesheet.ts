/**
 * XSLT 1.0 stylesheet applied to /sitemap.xml through the `xml-stylesheet`
 * processing instruction, so a browser renders the sitemap as a readable
 * table instead of raw XML. Crawlers ignore the PI and read the XML.
 *
 * Served from a route handler (rather than `public/`) so the
 * `content-type: text/xsl` is guaranteed — browsers silently skip the
 * stylesheet when the MIME type is wrong.
 */
export const SITEMAP_XSL_CONTENT_TYPE = "text/xsl; charset=utf-8"

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
        <title>Themys — XML sitemap</title>
        <style>
          :root { color-scheme: light; }
          body {
            margin: 0 auto; padding: 3rem 1.5rem 5rem; max-width: 54rem;
            background: #ffffff; color: #17191c;
            font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
          }
          h1 { font-size: 1.75rem; margin: 0 0 .4rem; letter-spacing: -.02em; }
          .lede { margin: 0 0 2rem; color: #5b6167; max-width: 42rem; }
          code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .92em;
                 background: #f1f3f5; padding: .1rem .35rem; border-radius: .25rem; }
          h2 { font-size: .82rem; margin: 2.25rem 0 .6rem; color: #5b6167;
               text-transform: uppercase; letter-spacing: .08em; font-weight: 600; }
          .count { color: #8a9199; font-weight: 400; }
          table { width: 100%; border-collapse: collapse; border: 1px solid #e4e7eb;
                  border-radius: .5rem; overflow: hidden; }
          th, td { text-align: left; padding: .65rem .85rem; border-bottom: 1px solid #eef1f4; }
          th { background: #f8fafc; font-size: .75rem; text-transform: uppercase;
               letter-spacing: .05em; color: #5b6167; font-weight: 600; }
          tr:last-child td { border-bottom: 0; }
          a { color: #2563eb; text-decoration-thickness: 1px; text-underline-offset: 2px; }
          a:hover { color: #1d4ed8; }
          .path { word-break: break-all; }
          .meta { color: #5b6167; white-space: nowrap; font-variant-numeric: tabular-nums; }
          footer { margin-top: 2.5rem; padding-top: 1.25rem; border-top: 1px solid #e4e7eb;
                   color: #8a9199; font-size: .9rem; }
        </style>
      </head>
      <body>
        <h1>XML sitemap</h1>
        <p class="lede">
          The machine-readable sitemap for <code>themys.ca</code> — the file search engines read
          directly. It lists consumer-facing pages only. A browser-friendly rendering is below.
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
          Raw XML: <a href="/sitemap.xml">/sitemap.xml</a> · Documentation lives at
          <a href="https://docs.themys.ca/">docs.themys.ca</a>
        </footer>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
`
