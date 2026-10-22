# Network Extension sequel (not v1)

v1 of the iOS app is a Safari Web Extension. This file is the entitlement and design note for the later hostname pipe. Do not add a VPN permission screen to the shipping binary until Apple approves the entitlement and we have a TestFlight build that stores nothing.

## Why this is a sequel

Apple’s Network Extension guidance (WWDC25):

- Use Packet Tunnel **only** to tunnel IP traffic.
- System-wide `NEFilterDataProvider` on iOS is for **supervised** devices.
- iOS 26 `NEURLFilter` can block a known URL list via Bloom filter + PIR. The URL is **never revealed to the app**, so it cannot trigger a Themys scan.

A fake “local VPN” that inspects hostnames is exactly the Packet Tunnel misuse Apple calls out. Treat App Review rejection of that pattern as a kill criterion.

## Entitlement request (start now, ship later)

1. Apple Developer → Account → Identifiers → App ID `ca.themys.app`.
2. Additional Capabilities → request **Network Extensions**.
3. In the request, describe a **privacy-preserving DNS/hostname observer**, not a VPN product:
   - On-device only.
   - Match host labels `legal.`, `terms.`, `privacy.`, `tos.`, `eula.` using `HostnameMatcher`.
   - Discard non-matches immediately. Do not upload a browse log.
   - User-visible notification only. Never block the other app.
   - Scan still requires an explicit tap and a review credit.
4. Preferred APIs, in order:
   1. `NEDNSSettingsManager` / on-device DNS proxy **if** Apple will grant it for this use.
   2. Cut the sequel rather than ship Packet Tunnel as a content filter.
5. After approval, add the capability to a **new** app version. Keep it out of the v1 entitlements file.

## Product rules (immutable)

- No CA, no TLS intercept, no MITM proxy.
- No persistence of unmatched DNS/SNI.
- Notification, not interstitial.
- Same Clerk wallet: detection free, analyze spends a credit.
- Do not market “works in every app” until this sequel actually ships.

Implementation sketch lives in [`Themys/FilterSequel/HostnameMatcher.swift`](Themys/FilterSequel/HostnameMatcher.swift) and [`packages/tos-detection/themys-detection.js`](../packages/tos-detection/themys-detection.js) (`matchesHostnameShape`).
