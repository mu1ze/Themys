import { access, readdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"

import { collectSitemapEntries, renderSitemapXml } from "./sitemap-source.mjs"

const root = resolve(import.meta.dirname, "..")
const output = resolve(root, "out")
const content = resolve(root, "src/app/content")

const markdownFiles = (await readdir(content)).filter((name) => name.endsWith(".md"))
const expectedPages = [
  resolve(output, "index.html"),
  ...markdownFiles.map((name) => resolve(output, name.replace(/\.md$/, ""), "index.html")),
]

await Promise.all(expectedPages.map((file) => access(file)))

const home = await readFile(resolve(output, "index.html"), "utf8")
if (!home.includes("/_next/")) {
  throw new Error("Exported documentation assets are missing the root asset path")
}

// The sitemap is generated into public/ before the export. Fail loudly if it is
// missing or no longer matches the content directory it is derived from.
const expectedEntries = await collectSitemapEntries(root)
const expectedXml = renderSitemapXml(expectedEntries)
const emittedXml = await readFile(resolve(output, "sitemap.xml"), "utf8")
if (emittedXml !== expectedXml) {
  throw new Error(
    "Exported sitemap.xml does not match src/app/content — run `pnpm build` so scripts/generate-sitemap.mjs regenerates it",
  )
}

const emittedUrls = [...emittedXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
if (emittedUrls.length !== expectedEntries.length) {
  throw new Error(
    `Sitemap lists ${emittedUrls.length} URLs but ${expectedEntries.length} were expected`,
  )
}
for (const name of markdownFiles) {
  const slug = name.replace(/\.md$/, "")
  if (!emittedUrls.some((url) => url.endsWith(`/${slug}/`))) {
    throw new Error(`Sitemap is missing the exported page /${slug}/`)
  }
}

await access(resolve(output, "sitemap.xsl"))
await access(resolve(output, "robots.txt"))

const robots = await readFile(resolve(output, "robots.txt"), "utf8")
if (!robots.includes("Sitemap: https://docs.themys.ca/sitemap.xml")) {
  throw new Error("Exported robots.txt does not advertise the sitemap")
}

console.log(
  `Verified ${expectedPages.length} exported documentation pages and a ${emittedUrls.length}-URL sitemap at the custom domain root`,
)
