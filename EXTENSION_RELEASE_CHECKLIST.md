# Chrome extension release gate

The extension remains **coming soon** until every item below has current
evidence. Do not change public copy or add a Web Store link from a local build
alone.

- [ ] Chrome Web Store listing exists under the verified Themys publisher account.
- [ ] Store listing URL, publisher identity, screenshots, description, and support URL are verified in a signed-in browser session.
- [ ] Declared permissions and host permissions match the reviewed minimum; no new permission is added without a privacy review.
- [ ] Privacy disclosure explains auth storage, legal-page access, network calls, and data deletion.
- [ ] Production artifact passes `pnpm extension:validate:prod` and contains only the canonical `https://themys.ca` origin.
- [ ] The manifest has exactly one `externally_connectable` match for `https://themys.ca/*`, and the service worker rejects messages whose sender is not the exact origin and `/extension-auth` path.
- [ ] The website and production extension artifact come from the same auth-protocol revision; no legacy page-message build is published or retained as the release candidate.
- [ ] `node scripts/verify-extension-runtime.mjs` passes its worker, forged-origin, token-expiry, sign-out, and credential-log checks against the production artifact.
- [ ] Authenticated production E2E covers sign-in, token expiry, scan, history, profile, monitoring, and sign-out.
- [ ] A disposable production account is used for smoke testing and its data is deleted afterward.
- [ ] Web Store review is approved and the published listing opens successfully from the docs and landing page.
- [ ] Only after all evidence is attached: change “Chrome extension coming soon” to “Available on the Chrome Web Store” in public copy.

Until then, the web app at [themys.ca](https://themys.ca) is the supported
workflow and no public page should link to a placeholder listing.
