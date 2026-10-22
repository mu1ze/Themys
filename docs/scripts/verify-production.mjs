const origin = (process.env.DOCS_ORIGIN ?? "https://docs.themys.ca").replace(/\/$/, "")
const attempts = 6

async function fetchWithRetry(path) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${origin}${path}`, { redirect: "follow" })
      if (response.ok) return response
      lastError = new Error(`${path} returned ${response.status}`)
    } catch (error) {
      lastError = error
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 5_000))
  }
  throw lastError
}

const homeResponse = await fetchWithRetry("/")
const home = await homeResponse.text()
if (!home.includes("Documentation") || !home.includes("/_next/")) {
  throw new Error("The deployed documentation home page is not the standalone export")
}
if (!homeResponse.headers.get("content-security-policy")) {
  throw new Error("The deployed documentation response is missing its security policy")
}

const quickStart = await (await fetchWithRetry("/quick-start/")).text()
if (!quickStart.includes("Getting Started with Themys")) {
  throw new Error("The deployed quick-start page is missing expected content")
}

const installation = await (await fetchWithRetry("/installation/")).text()
const publicDocs = `${quickStart}\n${installation}`.toLowerCase()
if (!publicDocs.includes("extension is coming soon")) {
  throw new Error("The deployed documentation does not keep the Chrome extension marked as coming soon")
}
for (const staleClaim of [
  "production extension is available",
  "visit the chrome web store listing",
  "chromewebstore.google.com/detail/themys",
]) {
  if (publicDocs.includes(staleClaim)) {
    throw new Error(`The deployed documentation contains stale extension copy: ${staleClaim}`)
  }
}

const assetPath = home.match(/\/_next\/static\/[^"']+/)?.[0]
if (!assetPath) throw new Error("Could not find a prefixed static asset in the deployed page")
await fetchWithRetry(assetPath)

// The sitemap is generated at build time; a deploy that skipped the generator
// (or a stale edge cache) would leave it missing or short of the docs.
const { collectSitemapEntries } = await import("./sitemap-source.mjs")
const expectedEntries = await collectSitemapEntries()

const sitemapResponse = await fetchWithRetry("/sitemap.xml")
if (!(sitemapResponse.headers.get("content-type") ?? "").includes("xml")) {
  throw new Error("The deployed sitemap is not served as XML")
}
const sitemap = await sitemapResponse.text()
if (!sitemap.includes('<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>')) {
  throw new Error("The deployed sitemap is missing its stylesheet reference")
}
for (const entry of expectedEntries) {
  if (!sitemap.includes(`<loc>${entry.url}</loc>`)) {
    throw new Error(`The deployed sitemap is missing ${entry.url}`)
  }
}

const stylesheetResponse = await fetchWithRetry("/sitemap.xsl")
if (!(stylesheetResponse.headers.get("content-type") ?? "").includes("text/xsl")) {
  throw new Error(
    `The deployed stylesheet is served as ${stylesheetResponse.headers.get("content-type")}, which browsers ignore`,
  )
}

const robots = await (await fetchWithRetry("/robots.txt")).text()
if (!robots.includes(`Sitemap: ${origin}/sitemap.xml`)) {
  throw new Error("The deployed robots.txt does not advertise the sitemap")
}

console.log(
  `Verified standalone documentation at ${origin}/ with a ${expectedEntries.length}-URL sitemap`,
)
