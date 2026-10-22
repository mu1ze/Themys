# Themys iOS and macOS Safari capture

Native iOS app + iOS Safari Web Extension, plus a macOS host app and macOS Safari Web Extension. The iOS target uses Clerk shared-session Keychain storage; macOS Safari uses the web-session bridge because the iOS App Group session model does not apply to macOS.

v1 does **not** include a VPN. Hostname filtering is documented in [`NETWORK_EXTENSION.md`](NETWORK_EXTENSION.md).

## Generate the Xcode project

`Themys.xcodeproj` is committed. Use Xcode 26 or newer (Swift 6.2, required by Clerk 1.5.4). Prefer the committed project, or regenerate:

```bash
pnpm ios:sync
cd ios
# optional: brew install xcodegen && xcodegen generate
open Themys.xcodeproj
```

Then in Xcode:

1. Set your Development Team on both targets.
2. Enable App Group `group.ca.themys.app` on both targets (Identifiers in the Developer portal).
3. Replace `CLERK_PUBLISHABLE_KEY` in `Themys/Info.plist` with the same Clerk app as themys.ca. Add `themys://` to Clerk allowed redirect URLs.
4. File → Add Package Dependencies if `xcodegen` did not resolve [Clerk iOS](https://github.com/clerk/clerk-ios) 1.5.4 or later (`ClerkKit` and `ClerkKitUI` in the app; `ClerkKit` in the extension). Add `themys://callback` to Clerk allowed redirect URLs.
5. Run on a device, open Settings → Safari → Extensions → Themys, allow all websites.
6. In Safari, open a `/terms` URL. Airplane mode should still show the Terms badge.

## Sync shared JS

`pnpm ios:sync` copies `packages/tos-detection/themys-detection.js`, `extension/overlay.js`, and `extension/popup-detector.js` into the Safari extension resources and rewrites `config.js`.

`artifacts/extension/*` is the canonical packaged JavaScript implementation for this workflow. The macOS sync reads `artifacts/extension/production` by default, copies the same background/content/scan/auth logic, and adds only a small Safari `browser` API adapter. The platform folders are packaging targets, not separate implementations.

`pnpm macos:safari:sync` generates the macOS Safari resources. Open `ios/Themys.xcodeproj`, choose the `ThemysMac` scheme, set the development team, build, and enable Themys in Safari → Settings → Extensions. The macOS target is configured for macOS 14 and later.

## Privacy copy (App Store)

> Themys looks at the page address on your device. If it looks like Terms, we badge it. We only send that address to Themys when you tap Scan.

Do not claim browsing-history collection. Do not claim “works in every app.”

## Session sharing and release verification

Both targets use Clerk 1.5.4+ shared-session sync with Keychain service
`ca.themys.clerk` and access group `group.ca.themys.app`. The app publishes its
public Clerk key into App Group preferences; credentials remain in Keychain.
The extension initializes Clerk only when Scan requests a session, reconciles
shared storage, and requests a fresh token itself. Detection and preference
reads do not initialize Clerk or make authentication requests. App foreground
timers are not required for Safari scanning. Existing installations using the
previous Clerk storage configuration may need to sign in once after updating.

Sign in is a user-initiated `themys://sign-in?return=…` navigation from Safari.
The app validates the return scheme and returns to the page after authentication.
The extension does not use `NSExtensionContext.open` to launch the containing app.

Before release, build both targets in Xcode and verify on a signed device:

1. Sign in, return to Safari, leave the containing app in the background for at
   least two minutes, then scan linked Terms. Repeat without reopening the app.
2. Sign out in the app; a subsequent Safari scan must request authentication.
3. Cancel the Safari prompt to open Themys; Sign in must remain available.
4. Dismiss an agreement; other agreements on that origin must stay hidden for
   24 hours, then become eligible again. Disable detection and confirm no widget.
5. With no monthly reviews but purchased credits available, confirm both balances
   appear separately. With both exhausted, confirm the zero state and upgrade UI.

Local JavaScript tests and Swift parsing do not replace these device checks.

## Independent checks

Run `pnpm ios:test` from the repository root. The Safari JavaScript/native source
contract checks have their own workflow; they do not run in `pnpm test:unit`.
The macOS resource contract is covered by `src/lib/safari-macos.test.ts`. A local
Command Line Tools installation can parse the Swift sources, but a full signed
Safari build still requires the full Xcode installation and a Developer ID/team.
The website excludes `ios/` from linting, typechecking, and server tracing.
