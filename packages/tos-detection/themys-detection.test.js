import assert from "node:assert/strict"
import test from "node:test"
import { createRequire } from "node:module"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const detection = require("./themys-detection.js")

test("URL scoring rewards terms path segments and ignores marketing homepages", () => {
  assert.equal(detection.scoreURL("/terms"), 2)
  assert.ok(detection.scoreURL("/legal/terms-of-service") >= 4)
  assert.equal(detection.scoreURL("/pricing"), 0)
})

test("search and feed paths are excluded even when the host is a vendor", () => {
  assert.equal(
    detection.isExcludedPage({ hostname: "google.com", pathname: "/search", search: "?q=terms" }),
    true,
  )
  assert.equal(
    detection.isExcludedPage({ hostname: "policies.google.com", pathname: "/terms" }),
    false,
  )
  assert.equal(detection.isExcludedPage({ hostname: "example.com", pathname: "/terms-of-use" }), false)
})

test("combined page score crosses the detection threshold on a typical ToS page", () => {
  const bodyText = [
    "Please read these terms of service.",
    "You agree that we may collect and share data.",
    "Last updated: 1 January 2026.",
    "Section 1.1 Liability and indemnify.",
    "Governing law, arbitration, jurisdiction, waive, hereinafter, notwithstanding.",
  ].join(" ")
  const scored = detection.scorePage({
    hostname: "example.com",
    pathname: "/terms",
    title: "Example Terms of Service",
    headingTexts: ["Terms of Service"],
    bodyText,
  })
  assert.equal(scored.excluded, false)
  assert.ok(scored.urlScore >= 2)
  assert.ok(scored.combined >= detection.DETECTION_THRESHOLD)
  assert.equal(detection.isHighConfidenceLegalPage(scored), true)
})

test("I-Agree popup scoring requires agreement language plus a terms link", () => {
  const score = detection.scorePopupDetection({
    text: "By clicking Continue you agree to our Terms of Service",
    linkHref: "https://example.com/terms",
    hasButton: true,
    inDialog: true,
    isInline: true,
  })
  assert.ok(score >= detection.POPUP_MIN_CONFIDENCE)
  assert.ok(
    detection.scorePopupDetection({ text: "Subscribe to our newsletter", hasButton: true }) <
      detection.POPUP_MIN_CONFIDENCE,
  )
})

test("page detection rejects legal-looking marketing and settings pages without substantive legal text", () => {
  assert.equal(detection.isHighConfidenceLegalPage({ urlScore: 2, domScore: 3, combined: 5 }), false)
  assert.equal(detection.isHighConfidenceLegalPage({ urlScore: 2, domScore: 4, combined: 6 }), true)
  assert.equal(detection.isHighConfidenceLegalPage({ urlScore: 0, domScore: 7, combined: 7 }), true)
})

test("popup detection rejects marketing copy, cookie notices, newsletters, and missing legal links", () => {
  const base = {
    linkHref: "https://example.com/terms",
    hasButton: true,
    inDialog: false,
    isInline: true,
  }
  assert.equal(detection.isHighConfidencePopupDetection({ ...base, text: "You agree to things you never read" }), false)
  assert.equal(detection.isHighConfidencePopupDetection({ ...base, text: "By clicking Accept all cookies, you consent to our privacy policy and manage preferences" }), false)
  assert.equal(detection.isHighConfidencePopupDetection({ ...base, text: "I agree to the Terms of Service and promotional email updates" }), false)
  assert.equal(detection.isHighConfidencePopupDetection({ ...base, text: "I agree to the Terms of Service", linkHref: "" }), false)
  assert.equal(detection.isHighConfidencePopupDetection({ ...base, text: "I agree to the privacy policy", linkHref: "https://example.com/privacy-settings" }), false)
  assert.equal(detection.isHighConfidencePopupDetection({ ...base, text: "By creating an account, you agree to our Terms of Service" }), true)
})

test("hostname shape matcher only fires on legal host labels, never www.example.com", () => {
  assert.equal(detection.matchesHostnameShape("legal.stripe.com"), true)
  assert.equal(detection.matchesHostnameShape("terms.example.com"), true)
  assert.equal(detection.matchesHostnameShape("privacy.foo.io"), true)
  assert.equal(detection.matchesHostnameShape("www.example.com"), false)
  assert.equal(detection.matchesHostnameShape("example.com"), false)
  assert.equal(detection.matchesHostnameShape("notterms.example.com"), false)
})

test("sitemap helper recognizes legal paths without fetching", () => {
  assert.equal(detection.sitemapUrlLooksLegal("https://example.com/privacy-policy"), true)
  assert.equal(detection.sitemapUrlLooksLegal("https://example.com/blog/hello"), false)
})

test("package lives next to this test file so both extensions can copy the same script", () => {
  const here = dirname(fileURLToPath(import.meta.url))
  assert.match(here, /tos-detection$/)
})
