import assert from "node:assert/strict"

const baseUrl = (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "")
const expectProduction = process.env.EXPECT_PRODUCTION_HEADERS === "1"
const targetUrl = new URL(baseUrl)
const allowLocalProductionHeaders =
  process.env.ALLOW_LOCAL_HTTP_PRODUCTION_HEADERS === "1" &&
  (targetUrl.hostname === "localhost" || targetUrl.hostname === "127.0.0.1")

if (expectProduction && !allowLocalProductionHeaders) {
  assert.equal(targetUrl.protocol, "https:", "Production header verification requires HTTPS")
}

function assertSecurityHeaders(response, label) {
  const csp = response.headers.get("content-security-policy") ?? ""
  assert.match(csp, /default-src 'self'/, `${label} is missing default-src`)
  assert.match(csp, /frame-ancestors 'none'/, `${label} can be framed`)
  assert.match(csp, /object-src 'none'/, `${label} allows objects`)
  assert.match(csp, /https:\/\/\*\.clerk\.com/, `${label} CSP is missing Clerk`)
  assert.match(csp, /https:\/\/js\.stripe\.com/, `${label} CSP is missing Stripe`)
  assert.match(csp, /https:\/\/\*\.ingest\.sentry\.io/, `${label} CSP is missing Sentry`)
  assert.match(csp, /https:\/\/\*\.ingest\.us\.sentry\.io/, `${label} CSP is missing Sentry US ingest`)
  assert.doesNotMatch(csp, /supabase\.co/i, `${label} CSP still exposes a retired Supabase endpoint`)
  assert.equal(response.headers.get("x-frame-options"), "DENY", `${label} is missing frame denial`)
  assert.equal(response.headers.get("x-content-type-options"), "nosniff", `${label} is missing nosniff`)
  assert.equal(
    response.headers.get("referrer-policy"),
    "strict-origin-when-cross-origin",
    `${label} has the wrong referrer policy`,
  )
  assert.match(response.headers.get("permissions-policy") ?? "", /camera=\(\)/, `${label} permits camera`)
  assert.equal(
    response.headers.get("cross-origin-opener-policy"),
    "same-origin-allow-popups",
    `${label} has the wrong opener policy`,
  )

  if (expectProduction) {
    assert.doesNotMatch(csp, /'unsafe-eval'/, `${label} production CSP allows eval`)
    assert.match(csp, /upgrade-insecure-requests/, `${label} does not upgrade insecure requests`)
    assert.match(
      response.headers.get("strict-transport-security") ?? "",
      /max-age=31536000.*includeSubDomains.*preload/i,
      `${label} is missing production HSTS`,
    )
  }
}

const pageResponse = await fetch(`${baseUrl}/`, { redirect: "manual" })
assert.equal(pageResponse.status, 200, `Home page returned ${pageResponse.status}`)
assertSecurityHeaders(pageResponse, "Home page")
await pageResponse.body?.cancel()

const apiResponse = await fetch(`${baseUrl}/api/monitor`, { redirect: "manual" })
assert.equal(apiResponse.status, 401, `Anonymous monitoring API returned ${apiResponse.status}`)
assertSecurityHeaders(apiResponse, "Monitoring API")
await apiResponse.body?.cancel()

if (expectProduction && !allowLocalProductionHeaders) {
  const httpUrl = new URL(baseUrl)
  httpUrl.protocol = "http:"
  const httpResponse = await fetch(httpUrl, { redirect: "manual" })
  assert.ok([301, 307, 308].includes(httpResponse.status), `HTTP origin returned ${httpResponse.status}`)
  const location = httpResponse.headers.get("location") ?? ""
  assert.equal(new URL(location).protocol, "https:", "HTTP origin did not redirect to HTTPS")
  await httpResponse.body?.cancel()
}

console.log(
  `Security headers verified against ${baseUrl}: page, dynamic API, CSP integrations, anti-framing, MIME, referrer, permissions, and opener${expectProduction ? ", HSTS, production CSP, and HTTP-to-HTTPS redirect" : ""}`,
)
