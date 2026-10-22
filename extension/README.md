# Themys Chrome extension builds (coming soon)

The extension is not currently available in the Chrome Web Store. These build
and validation commands maintain release readiness without implying public
availability. See the repository [release gate](../EXTENSION_RELEASE_CHECKLIST.md)
before publishing any listing.

The committed `extension/` directory is the single source. Detection heuristics live in
`packages/tos-detection/` and are copied into the artifact as `detection/themys-detection.js`.
Do not edit an artifact under `artifacts/extension/`; those directories and ZIPs are generated.

## Build and validate

- Development: `pnpm extension:build:dev` (`http://localhost:3000`)
- Staging: `THEMYS_STAGING_ORIGIN=https://staging.example.com pnpm extension:build:staging`
- Production: `pnpm extension:build:prod` (`https://themys.ca` by default)
- CI validation: `pnpm extension:validate:prod`

Set `THEMYS_EXTENSION_PUBLIC_KEY` to Chrome's base64-encoded public key when a
stable unpacked extension ID is required. The builder injects it only into the
generated manifest; environment-specific configuration never changes source.

The builder emits an unpacked directory and a Chrome Web Store ZIP, then fails
if a production artifact contains localhost, insecure HTTP, `themys.ai`, an
unexpected host permission, a weakened extension-page CSP, extra permissions,
credential-sensitive logging, or a weakened auth-message origin check. The CI
validation command rebuilds its own artifact and does not rely on a prior build.

## Permission rationale

- `storage`: saves the current session token, expiry, preferences, onboarding,
  and the last scan on this device.
- `alarms`: expires stored credentials and keeps the MV3 worker available.
- `activeTab`: sends an explicitly requested result to the active page.
- `<all_urls>` content-script matches: detects Terms pages on the site the user
  is visiting. Network access is not granted to every site; `host_permissions`
  contains only the environment's canonical Themys application origin.

## Authentication lifecycle

Only `/extension-auth` on the configured app origin may send a token through
the browser's `externally_connectable` channel. The manifest allowlists that
origin and the service worker independently checks the sender URL. Tokens are
never broadcast through the page or exposed to content-script message
listeners. Stored JWTs
include their decoded expiration time and are cleared on expiry, API 401, or
sign-out. Before an authenticated operation, an expired token is refreshed by
opening the signed-in app bridge in an inactive tab. If the web session also
expired, the user is sent through the visible sign-in flow again. Token values
and response bodies must never be logged.

Before Web Store release, load the generated production directory unpacked,
run sign-in/sign-out, expiry refresh, scan, history, profile, and monitoring,
then upload the generated ZIP. Keep the configured application origin in
Clerk's allowed web origins. Clerk runs on `/extension-auth` at that web origin;
the extension origin itself does not host Clerk and does not belong in Clerk's
origin allowlist. A manifest public key is useful only when a stable unpacked
extension ID is required before the Web Store assigns the release ID.
