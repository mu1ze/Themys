# Themys module boundaries

The web application, documentation site, browser extension, and iOS Safari capture
app are released independently while remaining in this repository.

## iOS package

`ios/` is a standalone Xcode application with a Safari Web Extension target. It
must not import Next.js `src/`. Detection heuristics come from
`packages/tos-detection/`. Authenticated traffic uses the same Clerk JWT APIs as
the Chrome extension, with `X-Themys-Client: safari-ios`. Both native targets
use Clerk shared-session sync in the same Keychain service/access group. On an
explicit scan, the extension reloads that identity and obtains a fresh token;
it does not depend on the containing app continuing to run in the background.

Native code is excluded from website TypeScript, ESLint, and server file
tracing. Safari tests live in `ios/tests/` and run with `pnpm ios:test` in their
own GitHub workflow. Native-only changes skip the web release workflow. Shared
API or detection changes still exercise the relevant compatibility checks.
Xcode build products and Swift package downloads are ignored by Git.

## Detection package

`packages/tos-detection/` is the shared Terms-page scorer. Chrome MV3 and the
Safari Web Extension load the same classic script. It has no Chrome, Safari, or
Next.js imports.

## Extension package

`extension/` is a standalone Manifest V3 package. Its own `package.json` and
GitHub Actions workflow build, validate, and upload the Web Store ZIP. It has
no dependency on Next.js source files. Its compatibility surface is described
by `src/contracts/extension.ts`; extension-facing responses expose the
`X-Themys-Extension-Contract` header.

Extension authentication is an explicit browser-to-extension exchange. The
web route `/extension-auth` requires an `extension_id` and calls the browser's
external messaging API. The generated manifest allowlists only the configured
application origin through `externally_connectable`, and the service worker
independently requires the exact origin and `/extension-auth` path. Session
tokens never pass through the page-wide `window.postMessage` bus. Web and
extension artifacts that implement different auth protocols are incompatible
and must be qualified from the same release revision.

## Documentation package

`docs/` is a standalone Next.js static-export package. It has its own
dependencies, lockfile, validation workflow, and Cloudflare Worker. The Worker
owns the custom domain `docs.themys.ca`, while the main application continues
to own `themys.ca`.

The documentation build may call the main application's API at
`https://themys.ca/api` at runtime, but it must not import code from the root
`src/` tree. The main application links to `https://docs.themys.ca` with a
normal document navigation so its Next.js client does not attempt to prefetch a
route compiled by a different build.

## Web features

`src/app` is routing only. Feature-owned code lives under `src/features`:

- `admin`: privileged queries and admin UI.
- `scans`: scan analysis and history behavior.
- `monitoring`: scheduled monitoring and user monitoring flows.
- `extension-api`: HTTP adapter for extension-specific compatibility concerns.

Routes may import a feature's public boundary, but feature code must not import
from `src/app`. General infrastructure remains in `src/lib` until it has a
single feature owner.

Monitoring uses the same canonical `analyzeItem` pipeline as web and Developer
API scans when a document changes. Each successful change analysis is persisted
through `persistAnalysis` with `is_monitoring_scan` set and the previous scan
linked, including clauses, compliance tags, and full extraction. The monitoring
snapshot stores the resulting `scan_id`; alert reads expose that ID so the UI
can open the normal scan-results workspace instead of maintaining a second
analysis schema. Monitoring still owns scheduling, hash comparison, document
identity checks, alert creation, and email delivery.
The full sequence, failure behavior, persistence relationships, and verification
contract are documented in `MONITORING_IMPLEMENTATION.md`.

## Scan analysis and results

`src/lib/analyze-item.ts` owns the server-side scan pipeline used by single and
batch analysis. It resolves the source text, identifies the document, checks
the eligible public cache, and runs the primary clause analysis. The analyze
routes defer optional structured extraction until after the primary Jev result
has been persisted, so extraction latency does not delay the initial response.
Authentication, quotas, persistence, and the HTTP response remain route concerns.

`src/lib/llm.ts` uses TypeSafe Jev for configured risk and actionable-right
judgments when a TypeSafe key is present and the user has no custom target
clauses. `src/lib/jev-scanner.ts` segments the document, asks Noul detection
and Choice source-location questions, validates the answers, and maps supported
findings back to source clauses. A valid empty Jev result is a completed scan.
OpenRouter analysis handles custom target clauses and serves as a fallback if
TypeSafe is unavailable or returns an invalid response. Structured extraction
is a separate OpenRouter request and may be empty without invalidating the
clause analysis. Neither provider replaces the stored original document.

The current Jev scanner applies a provisional 0.8 detection threshold and
runs sequential 30-clause Jev batches. This keeps the 90-question response
below TypeSafe's output budget while allowing larger documents to be covered;
findings are aggregated across batches and duplicate risk IDs keep the
highest-confidence source clause. Those limits and the configured question
set need calibration against representative scan data before treating
coverage or latency as settled.

`src/components/scan-results-view.tsx` assembles the saved results. Summary,
Flagged, Actionable Insights, Compliance, and Extraction share the report's
expandable finding presentation. Full Document is a separate navigation view
for stored source text and highlighted source matches. There is no results
inspector or sidecar.

## Developer API

The experimental Developer API is a versioned adapter over the shared scan
pipeline. `src/app/api/analyze/route.ts`, `src/app/api/extract/route.ts`, and
`src/app/api/analyze/batch/route.ts` retain their Clerk and extension response
contracts while returning the standard developer envelope for `tmys_` API-key
requests. Contract types, error-code mapping, and the OpenAPI document live in
`src/contracts/developer-api.ts` and `src/contracts/developer-openapi.ts`; the
HTTP header adapter lives in `src/features/developer-api/server/response.ts`.

Developer analysis is not a separate rules engine. The route resolves the API
key, profile, plan, quota, and idempotency context, then calls the same
`analyzeItem` and persistence pipeline used by the web product. Successful
analysis responses include an `analysisPolicy` snapshot so SDKs and LLM tools
can tell whether standard or strict-target-only analysis was actually applied.
Batch results preserve item order and isolate per-item failures. See
`DEVELOPER_API_IMPLEMENTATION.md` for the response contract, scope behavior,
versioning rules, and release checks.

## Database and deployment

The D1 migrations, main Cloudflare Worker configuration, and web deployment
stay at the repository root. The documentation Worker configuration stays
under `docs/`. Database configuration remains shared because the web
application and extension use the same authenticated API and data model. A
read-only legacy PostgREST migration source is retained only for the controlled
data cutover.

## Future extraction rule

Move a feature into a separate repository or deployable only after its API
contract is versioned, its release pipeline is independent, and it no longer
requires direct server-only imports from the web application.
