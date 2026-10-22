export type SecurityHeader = { key: string; value: string }

export function buildSecurityHeaders(isDevelopment: boolean): SecurityHeader[] {
  const contentSecurityPolicy = [
    "default-src 'self'",
    // @react-pdf/renderer uses Yoga's bundled WebAssembly layout engine.
    // This permits WASM compilation without enabling JavaScript eval in production.
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDevelopment ? " 'unsafe-eval'" : ""} https://*.clerk.accounts.dev https://*.clerk.com https://clerk.themys.ca https://challenges.cloudflare.com https://js.stripe.com https://static.cloudflareinsights.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://img.clerk.com https://*.clerk.com https://clerk.themys.ca https://www.google.com https://*.gstatic.com",
    "font-src 'self' data:",
    `connect-src 'self'${isDevelopment ? " http://localhost:* ws://localhost:*" : ""} https://*.clerk.accounts.dev https://*.clerk.com https://clerk.themys.ca https://api.stripe.com https://cloudflareinsights.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io`,
    "frame-src https://*.clerk.accounts.dev https://*.clerk.com https://clerk.themys.ca https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.themys.ca",
    "frame-ancestors 'none'",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ].join("; ")

  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
    ...(isDevelopment ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" }]),
  ]
}
