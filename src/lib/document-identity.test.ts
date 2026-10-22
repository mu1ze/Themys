import assert from "node:assert/strict"
import test from "node:test"

import { classifyDocument, identifyDocument } from "./document-identity.ts"

test("separates privacy policies from footer references to terms", () => {
  const result = classifyDocument({
    url: "https://example.com/legal/privacy-policy",
    text: `Privacy Policy

This Privacy Policy describes the personal information we collect, how we use your information,
and the privacy rights available to you. See also our Terms of Service.`,
  })

  assert.equal(result.type, "privacy_policy")
  assert.equal(result.confidenceLevel, "high")
  assert.equal(result.needsReview, false)
})

test("recognizes privacy statements as privacy policies", () => {
  const result = identifyDocument({
    url: "https://example.com/legal/privacy-statement",
    text: "Privacy Statement\nThis Privacy Statement explains the personal data we collect and your privacy rights.",
  })

  assert.equal(result.type, "privacy_policy")
  assert.ok(result.identityKey)
})

test("keeps Terms of Use distinct from Terms of Service", () => {
  const termsOfUse = identifyDocument({
    url: "https://example.com/web-app/terms-of-use",
    text: "Terms of Use\nThese Terms of Use govern your use of the web application.",
  })
  const termsOfService = identifyDocument({
    url: "https://example.com/product/terms-of-service",
    text: "Terms of Service\nThese Terms of Service govern the product and related services.",
  })

  assert.equal(termsOfUse.type, "terms_of_use")
  assert.equal(termsOfService.type, "terms_of_service")
  assert.notEqual(termsOfUse.identityKey, termsOfService.identityKey)
})

test("does not guess when strong document labels conflict", () => {
  const result = classifyDocument({
    text: "Terms of Use and Privacy Policy\nPlease read the Terms of Use and Privacy Policy.",
  })

  assert.equal(result.type, "unknown")
  assert.equal(result.needsReview, true)
})

test("normalizes tracking parameters without merging distinct paths", () => {
  const base = identifyDocument({
    url: "https://www.example.com/legal/terms/?utm_source=email#top",
    text: "Terms of Service\nThese Terms of Service govern the service.",
  })
  const tracked = identifyDocument({
    url: "https://example.com/legal/terms",
    text: "Terms of Service\nThese Terms of Service govern the service.",
  })
  const differentProduct = identifyDocument({
    url: "https://example.com/product/terms",
    text: "Terms of Service\nThese Terms of Service govern the service.",
  })

  assert.equal(base.identityKey, tracked.identityKey)
  assert.notEqual(base.identityKey, differentProduct.identityKey)
})

test("leaves pasted documents without a URL unlinked", () => {
  const result = identifyDocument({
    text: "Privacy Policy\nThis Privacy Policy explains how we collect personal data.",
  })

  assert.equal(result.type, "privacy_policy")
  assert.equal(result.identityKey, null)
})
