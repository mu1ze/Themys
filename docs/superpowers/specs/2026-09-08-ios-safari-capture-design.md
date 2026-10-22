# Themys iOS Safari capture — product design

*Date: 2026-09-08*  
*Status: approved foundation — implementation follows this spec*  
*Inputs: grilling lock (capture-first, hybrid pipes, on-device privacy, iOS Safari-first, badge-then-credit, Safari overlay)*

This spec is the product. It does not replace [the founder-extension spec](2026-08-12-founder-extension-product-design.md). The Chrome extension remains the desktop product. This surface is phone capture in Safari.

---

## 1. Intent

Themys on iPhone exists to **catch a legal URL while the person is still in Safari**, badge it on-device, and let them spend a review credit without leaving the page.

The app is not a dashboard. History is attached so they can reopen a glance. Always-on hostname filtering across other apps is a sequel, not a launch gate.

We do not decrypt HTTPS. We do not store a browse log. We do not market “works in every app.”

---

## 2. Locked decisions

| Decision | Lock |
|----------|------|
| Job | Capture-first. History is attached. |
| v1 OS | iOS. Android is a sequel. |
| Accurate pipe | Safari Web Extension: real URL paths, DOM/heading score, I-Agree detector. |
| Automatic | Detect and badge. Do not analyze until the user taps Scan. |
| Credits | Same wallet as web. Badge is free (no network). Scan spends a monthly review credit. Empty credits → teaser + upgrade. |
| Interrupt | In-Safari overlay. Never block other apps. |
| Auth | Same Clerk account as web. iOS app is the auth host. Extension reads the session from the App Group / shared Keychain. |
| Privacy | No CA, no TLS intercept, no domain upload, no persisted observation stream. URL leaves the device only on Scan. |
| Filter sequel | Request Network Extension entitlement in parallel. Ship hostname matching only after entitlement and App Review. Kill Packet Tunnel if Apple rejects it as a content filter. Do not use iOS 26 `NEURLFilter` (block-list API; URLs are never revealed to the app). |
| Client header | `X-Themys-Client: safari-ios`. Do not impersonate `extension`. |
| Scan row | Persist as source `extension` (same overlay capture job, not a new product type). Usage events use `safari-ios`. |

---

## 3. Who this is for

The same two audiences as the extension spec, at the moment they are on an iPhone in Safari:

- **Founders / operators** reviewing a vendor page in Safari.
- **Regular people** about to tap Accept on a Terms page or I-Agree modal.

Not this year: MDM/supervised-device content filters as the consumer product, Chrome on iOS, Instagram/TikTok in-app browsers.

---

## 4. Product surfaces

### 4.1 Safari Web Extension (the product)

On-device detection (no network):

- URL segment scoring and exclusions from the shared package extracted from `extension/content.js`.
- Heading / title / body legal-signal scoring.
- I-Agree checkbox / inline / modal detector from `extension/popup-detector.js`.
- Origin dismiss map (`themys-dismissed`, 24h) in extension local storage. Never uploaded.

If detection is high-confidence and the origin is not dismissed:

- Show the collapsed **Terms** badge. Still no network.
- **Scan** spends a credit via `POST /api/analyze` with Clerk JWT and `X-Themys-Client: safari-ios`.
- **Dismiss** writes the origin map and removes the badge.
- Signed out: Scan opens the iOS app sign-in (`themys://sign-in`) with a return to Safari. Do not dump the user on a random dashboard.
- No credits: badge stays; expand shows the existing limit-check teaser + upgrade (`POST /api/extension/limit-check`).

Overlay after a successful scan (stay on the page):

- Collapsed: brand + attention badge + flag count.
- Expanded: summary, Flagged, Pushback (3 items). “Open in Themys” for full extraction.
- Disclaimer: not legal advice.

Do not auto-analyze. Desktop Chrome may keep its existing auto-scan preference; Safari v1 does not.

### 4.2 Containing iOS app (thin)

SwiftUI. Not Expo.

1. **Onboarding (the core UX):** Sign in with Clerk. Then enable the Safari extension (Settings → Safari → Extensions → Themys) with a button into Settings. If this step fails, the app is a dead history list.
2. **History:** `POST /api/scans/history`. Title, domain, attention, flag count, time. Tap opens a glance; “Open in Themys” goes to `https://themys.ca/scan/results?id=…`.
3. **Glance:** attention label, flag count, up to 3 pushback items when the analyze payload is still on device; otherwise open the web results. Do not port the three-pane web workspace.
4. **Settings:** auto-detect on/off (shared with the extension via App Group + `browser.storage`), monthly reviews remaining and purchased credits shown separately, sign out.

### 4.3 Hostname filter (sequel, not v1)

Best-effort pipe for apps that are not Safari:

- On-device hostname **label** match only: `legal.`, `terms.`, `privacy.`, `tos.`, `eula.`
- No persistence of unmatched DNS/SNI.
- Notification, never a block.
- Scan still requires an explicit tap and a credit.

Do not include a VPN permission screen in the v1 binary. Entitlement request can start now; shipping is gated on Apple.

---

## 5. Architecture

```
Safari page → Safari Web Extension (on-device score / badge)
                    ↓ user taps Scan + Clerk JWT
              themys.ca API (analyze, limit-check, history)
                    ↓
              overlay on the page
iOS app  → App Group / Keychain token → extension
iOS app  → POST /api/scans/history
```

**Repo**

- `packages/tos-detection/` — shared heuristics. Chrome MV3 and Safari both load this script. No Next.js imports.
- `ios/` — Xcode app + Safari Web Extension target.
- Root D1/API remains the scan store. No mobile-only database.

**Auth**

- Clerk iOS SDK in both native targets. Clerk shared-session identity stays in Keychain (App Group); the native extension obtains a fresh JWT on each explicit scan.
- Extension background asks the native `SafariWebExtensionHandler` to reload shared Clerk state and obtain the token. It does not open `/extension-auth` as the primary path.
- APIs already accept `Authorization: Bearer <Clerk JWT>` via `resolveRequestAuth`.

**Client header**

- Parse `X-Themys-Client` into `web` | `extension` | `safari-ios` | `api_key`.
- `safari-ios` is a usage-events `client_type` (D1 check expanded). Scan rows stay `source = extension` when the request is overlay capture with page text.

---

## 6. Privacy and App Store copy

Privacy Nutrition: we do **not** collect browsing history.

Settings / permission copy:

> Themys looks at the page address on your device. If it looks like Terms, we badge it. We only send that address to Themys when you tap Scan.

No VPN screen in v1. No local proxy. No installed CA.

Overlay, App Store description, and privacy policy keep informational / not legal advice.

---

## 7. Credits and empty states

| State | Behavior |
|-------|----------|
| Signed out | Badge may appear. Scan opens app sign-in, then returns to Safari. |
| Signed in, credits remaining | Scan → analyze → overlay body. |
| Signed in, no credits | Badge stays. Expand shows teaser + upgrade (limit-check 402). |
| Wrong page / extract failed before analyze | Overlay says we were wrong. Dismiss. Do not charge if analyze never ran. |
| Analyze ran and returned empty | Follow existing API billing semantics. Do not invent a second rule. |

---

## 8. Out of scope (v1)

- Android.
- Network Extension / VPN / DNS proxy in the shipping binary.
- TLS inspection or a custom CA.
- Storing URL observation streams.
- Rebuilding web scan-results UI.
- Chrome on iOS; in-app browsers (Instagram, TikTok, SFSafariViewController in other apps).
- Blocking navigation.
- New Stripe product or scan-volume SKU.
- Launch-blocking on the Chrome Web Store listing.

---

## 9. Success (falsifiable)

- TestFlight Safari, airplane mode: a known `/terms` URL shows the Terms badge (proves on-device).
- Scan on Wi-Fi: overlay attention matches the web analysis for that URL; a history row appears in the app.
- Dismiss: the same origin does not badge again for 24 hours.
- Empty credits: teaser, not a crash.
- Enable-extension onboarding is completed by a new TestFlight tester without a Slack walkthrough.

If testers install the app and never enable the Safari extension, v1 has failed regardless of history UI quality.

---

## 10. Build order

1. Shared detection package + tests.
2. Safari Web Extension overlay talking to staging with a test Clerk user.
3. SwiftUI shell: Clerk, Keychain/App Group, onboarding, history, glance, credits.
4. `X-Themys-Client: safari-ios` on analyze / history / limit-check / events.
5. TestFlight + App Store privacy copy.
6. Parallel: Network Extension entitlement request and hostname-matcher design that stores nothing.
