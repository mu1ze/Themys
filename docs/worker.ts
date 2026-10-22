type DocsEnvironment = {
  ASSETS: { fetch(request: Request): Promise<Response> }
}

const SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://www.google.com https://*.gstatic.com",
    "font-src 'self' data:",
    "connect-src 'self' https://themys.ca https://cloudflareinsights.com",
    "frame-src https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; "),
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
}

/**
 * Static assets do not guarantee an XSL or XML content type for `.xsl`, and a
 * browser silently ignores a stylesheet served with the wrong one. Must match
 * SITEMAP_XSL_CONTENT_TYPE in scripts/sitemap-source.mjs — inlined here because
 * that module reads the filesystem and cannot be bundled into the Worker.
 */
const XSL_CONTENT_TYPE = "text/xsl; charset=utf-8"

const worker = {
  async fetch(request: Request, env: DocsEnvironment): Promise<Response> {
    const assetResponse = await env.ASSETS.fetch(request)
    const response = new Response(assetResponse.body, assetResponse)
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      response.headers.set(name, value)
    }
    if (new URL(request.url).pathname === "/sitemap.xsl") {
      response.headers.set("Content-Type", XSL_CONTENT_TYPE)
    }
    return response
  },
}

export default worker
