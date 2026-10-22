# `@themys/tos-detection`

Shared Terms-page heuristics for the Chrome MV3 extension and the iOS Safari Web Extension.

Load `themys-detection.js` as a classic content script **before** overlay/content scripts. It assigns `globalThis.ThemysDetection` and does not call the network or write storage.

`themys-capture-policy.js` is the product policy that sits next to it: auto-scan defaults off, onboarding completes once, and only `http(s)` URLs are valid sign-in return targets. Chrome content scripts load it immediately after detection.

Source of truth is this directory. `scripts/build-extension.mjs` copies both scripts into Chrome artifacts. `scripts/sync-ios-safari-extension.mjs` copies detection into the Safari extension resources.
