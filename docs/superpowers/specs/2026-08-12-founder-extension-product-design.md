# Themys product design — extension-first, founder-paid

*Date: 2026-08-12*  
*Status: draft for review — not an implementation plan*  
*Inputs: product-value evaluation (Aug 2026), founder-extension direction, user lock (founders pay + keep a consumer paid tier, paste + PDF upload in v1, spec before code)*

This spec is the product, not the tickets. Implementation plans come after you approve it.

---

## 1. Intent

Themys helps someone **decide what to do before they agree**, then **watch the deal after they agree**.

The Chrome extension is the product. The web app is the dashboard, the place you drop a contract that is not a public URL, and the place decisions and watchlists live.

We do not sell “more scans per day.” We do not pretend to be a law firm. We do not write homepage copy for enterprise procurement.

---

## 2. Who this is for

Two audiences, one product. One of them pays for a different reason than the other.

| Audience | Job | How they enter | What they pay for |
|----------|-----|----------------|-------------------|
| **Founders / operators** (primary revenue) | Sign or walk away from vendor paper (SaaS ToS, MSA, DPA, contractor agreement) | Extension on a vendor site, or paste/upload in the dashboard | Reviews of private contracts, pushback lists, vendor watchlist with email, PDF, playbooks |
| **Regular people** (distribution + secondary revenue) | Not click Accept blindly; know when a service they already use changes the deal | Extension on a ToS page or “I agree” modal | **Change-monitoring email**, not scan volume. Free overlay is the default. |

**Not this year (self-serve only):** enterprise legal/procurement (SSO, DPA, sales cycle), law firms as an ICP (counsel, formed entity, E&O, a different claim). A lawyer can use the founder product as an individual. We do not market to them.

**Teams:** no seats, orgs, or SSO. First “team” unlock later is a **working share link** (today share copies an authed URL nobody else can open). Not in this spec’s v1 except as a noted follow-on.

---

## 3. Positioning

**Homepage promise (founder-facing, consumer-usable):**

> Before you sign, see the clauses you can still push back on.

**Not:** “Know what you agree to” as the whole product. That is curiosity. Curiosity does not pay.

**Not:** legal advice, risk determination, or “we reviewed this for you.” Keep the existing disclaimer. Change the *job* around it: review guidance for a **vendor decision**, not a grade.

**Overlay (consumer and founder, in-page):** attention badge + flagged clauses + a short pushback list. Consumer copy stays humble: you may still have to Accept. Founder copy assumes they can still walk or negotiate.

**Dashboard:** vendor workspace, not analytics theater.

---

## 4. Product surfaces

### 4.1 Extension — the product

Already built: ToS URL + heading/DOM scoring, SPA history hooks, “I agree” modal detector, Shadow DOM overlay (attention + flagged + extraction), Clerk auth via `/extension-auth`, in-page analyze (no redirect to the scanner), monitor subscribe.

**v1 must finish the in-page loop so the website is not the product:**

1. **Publish to Chrome Web Store.** Until it is installed, there is no product. Public copy stops saying “coming soon” only after the listing is live.
2. **Stay on the page after sign-in.** `?return=` is appended today and ignored. After auth, return to the tab that triggered it.
3. **Monitor unsubscribe works.** Overlay must send `subscriptionId`. Toggle off must succeed.
4. **Dismiss memory.** `themys-dismissed` is written and not read. Honor it for that origin/session.
5. **Options actually exist.** Wire `extension/options/` into the manifest (or delete the dead page). Auto-scan on/off and playbook live here, not only on `/settings`.
6. **Scan this page / selection.** Not only `/terms` URLs. User can scan the current page text or selected text (Gmail, Docs, Notion, DocuSign). The background already sends up to 50k `innerText`. This is how we beat “paste into Gemini.”
7. **Do not eject to the web app for the core job.** Overlay shows results. “Open in dashboard” is optional. PDF, pricing, and empty-history can still open the site.

**Overlay result, v1:**

- Collapsed: brand + attention badge + flag count (keep).
- Expanded: summary, Flagged, Extraction (keep).
- **New primary block: Pushback** — 3 items max, from existing `recommendedAction` plus playbook hits. Each item: clause quote, why it matters, suggested ask (copy). Actions: copy ask, monitor this vendor, open in dashboard.
- Consumer vs founder is the same UI. Playbook and “save decision” are how founders go deeper, not a second overlay.

### 4.2 Web app — the dashboard

Replace `/dashboard` vanity KPIs (total scans, misnamed “clauses needing attention,” attention delta hardcoded to 0, credits sparkline of zeros, 30-day empty chart, six-category radar).

**Vendor workspace, useful at 0, 1, or 3 reviews:**

| Block | Empty (0) | Sparse (1–3) | Later |
|-------|-----------|--------------|-------|
| **Install / drop** | Install extension CTA + drop a contract (URL / paste / PDF) | Same, smaller | Stays |
| **Needs a decision** | Hidden | Open reviews with no Sign / Negotiate / Walk away | Queue |
| **Watchlist** | “Watch a vendor from the extension or after a review” | Monitored vendors + last check + last change | Email status |
| **Recent pushback** | Hidden | Last 3 pushback lists, copy again | History |

Primary dashboard CTA: **Install the extension** if not installed (we cannot perfectly detect this; use a dismissible banner + docs). Secondary: **Review a contract**.

`/scan/new` remains a dashboard tool for URL / paste / upload, not the homepage job. Homepage CTA is install extension first, then “or review a contract.”

`/monitoring` folds conceptually into Watchlist. The route can stay; the dashboard should not be a fifth place to discover it.

### 4.3 Input — URL, paste, and PDF upload (v1)

Paste was removed 2026-07-16. `POST /api/analyze` still accepts `text`. There is no file upload.

**v1 web review supports three sources, one output:**

1. **Public URL** — current path.
2. **Paste text** — restore. For MSAs, email forwards, in-app sheets that are not a URL.
3. **File upload** — PDF required in v1; DOCX if cheap. Extract text server-side, then the same analyze pipeline. Reject scanned-image PDFs with a clear error (no OCR in v1 unless it is already trivial).

Extension: current page URL (existing), current page text / selection (new). No file picker in the overlay in v1; “open dashboard to upload” is enough.

**Quota:** a paste or upload counts as a **contract review**, same as an uncached URL scan. Cached public URL still counts as a scan slot with no extra AI slot (existing usage policy).

### 4.4 Results — decision, not a score

The user asked: will I get hurt, and what should I do?

The product already generates `recommendedAction` and hides it. v1 shows it.

**Every completed review has a decision state:**

- `open` (default)
- `sign` — accept as-is
- `negotiate` — using the pushback list
- `walk_away`

Decision is stored on the scan. Dashboard “Needs a decision” is `open` reviews. This is the persistence ChatGPT does not have.

**Pushback list (web + overlay):**

- Max 3 items on the overlay; full list on the web result.
- Each item: quoted clause, why it matters, suggested ask (from `recommendedAction` / playbook).
- Copy-all as a short email to the vendor.
- PDF (paid) includes the pushback list and the decision if set. Disclaimer stays: not legal advice.

Do not lead the result with a gauge. Attention level stays as a badge. The first screen is the pushback list and the decision control.

### 4.5 Playbooks

Today: personal “target clauses” + strict mode in settings. Marketed “custom blocklists” have no UI. Kill blocklists from the price card.

**Playbooks are named presets of target clauses:**

| Playbook | Default topics | Who |
|----------|----------------|-----|
| **Consumer app** (default for new consumer accounts) | Data sharing, auto-renewal, arbitration, account termination | Regular people |
| **SaaS vendor** (default for founder signup path) | Data processing, liability cap, indemnification, termination for convenience, price-change, audit/DPA | Founders |
| **Contractor / services** | IP assignment, non-solicit, payment, termination | Founders |

User can still add custom topics (existing target-clauses). Strict mode stays.

Playbook is chosen in extension options and in settings. It is sent with analyze (existing profile API). Overlay ranks playbook hits first in Pushback.

v1 ships the three presets. No user-authored “create a playbook from scratch” editor beyond custom topics.

---

## 5. Pricing structure (numbers not locked)

Stop selling 5 / 25 / 100 **daily scans**. That ladder assumes a volume this ICP does not have.

**What is scarce:**

- For consumers: **watched services with email** (the only recurring job).
- For founders: **contract reviews** (paste/upload + private docs) and **watched vendors with email**.

**Proposed ladder (structure only — prices TBD):**

| Plan | Who | Included | Not included |
|------|-----|----------|--------------|
| **Free** | Everyone | Extension overlay, small monthly review cap, 1 watched vendor, **dashboard alerts only** | Email, PDF, paste/upload beyond a tiny trial (see open question), playbooks beyond Consumer app |
| **Personal** (consumer paid — keep this) | People who want “tell me when Instagram changes the deal” | Email on watched services, more watch slots than Free, PDF of public-URL scans | Not positioned as a contract desk. No need for 25 scans/day. |
| **Founder** (primary paid) | Operators signing vendors | Paste + PDF, SaaS/contractor playbooks, pushback + decision, PDF, email watchlist sized for a small stack, history | Not seats, not SSO, not “legal review” |

**Credits:** keep as burst for a procurement / fundraising week. Not the main ladder. Same 12-month expiry.

**Remove from the price card until real:** custom blocklists, batch review tools, “unlimited AI,” Advanced as a scan-volume SKU.

**Lifetime:** stays admin-only. Not on the public page.

**Open pricing questions (do not ship copy until answered):**

1. Dollar amounts for Personal and Founder (monthly + annual).
2. Whether Free includes **one** paste/upload as a founder trial, or paste/upload is Founder-only from the first file.
3. Watchlist sizes: e.g. Free 1 / Personal 10 / Founder 25 — confirm.
4. Whether Personal and Founder are two Stripe products or one paid product with a “use case” toggle (not recommended: different jobs, different upgrade prompts).

Until those are answered, engineering can still build the surfaces gated by **capabilities** (`emailAlerts`, `exportReports`, `contractUpload`, `monitorLimit`) rather than by the names Base/Advanced.

**Rename in product copy:** Base → Personal or Founder mapping to be decided with prices. Do not keep “Base/Advanced” if we are no longer selling scan volume.

---

## 6. What we stop doing

- Selling 25 vs 100 scans/day as the upgrade reason.
- Treating Reddit upvotes as PMF in marketing.
- Dashboard radar, 30-day scan histogram, credits sparkline of zeros, hardcoded attention delta.
- Marketing blocklists and batch.
- Claiming “from your browser” while the extension is coming soon.
- Homepage CTAs that send every plan to `/sign-up` as if checkout were the first job. First job is **install the extension**.
- Positioning as a tool for lawyers or enterprise teams.

---

## 7. Competitive stance (product implications)

| Alternative | How we win without lying |
|-------------|--------------------------|
| Click Accept | We do not “win” for iPhone-class adhesion. We win when the user can still walk or negotiate (founders). Overlay must not guilt consumers who cannot refuse. |
| ChatGPT paste | One click on the page + memory (this vendor, last review, this playbook, this decision). |
| ToS;DR | Clause-level pushback, private contracts, change email. Not letter grades. |
| Harvey / Ironclad | We do not compete. Different buyer and claim. |

---

## 8. Legal and trust (constraints, not a legal spec)

- Keep “not legal advice” on overlay, results, PDF, FAQ, Terms.
- Counsel sign-off of current consumer policies remains a **launch gate** for the live site; this redesign does not replace it.
- Operator still has no corporation represented as formed. Do not sell to firms until that and counsel are real.
- Paste/upload increases sensitivity (private contracts). v1: same account-scoped storage, same ZDR routing, no training-on-your-docs claim we cannot keep. Call this out to counsel before upload ships.
- Soft-delete and 30-day analysis cache: disclose; do not silently share one customer’s MSA analysis with another. Public-URL cache may stay; **paste/upload must not enter the public analysis cache.**

---

## 9. Out of scope (v1)

- Clerk organizations, seats, SSO, audit logs, DPA/BAA packaging.
- OCR for image-only PDFs.
- In-extension notification inbox (email + dashboard alerts are enough).
- Public share links (follow-on; first team feature).
- Developer API as a GTM motion (it can stay experimental).
- Rebuilding the overlay inside the web app.
- New attention-level taxonomy. Keep Standard / Worth reviewing / Needs attention.

---

## 10. Success (how we know this spec is right)

Falsifiable, from the earlier evaluation:

- If free users hit a **scan-volume** cap and convert on “more scans,” the old packaging was right and this spec is wrong.
- If they convert on **email monitoring**, Personal is the consumer wedge.
- If founders convert on **paste/upload + pushback + watchlist**, Founder is the wedge.
- If nobody converts, this is a free extension with a distribution problem, not a SaaS. Then we stop adding dashboard features and only ship the Store listing.

Instrumentation already has `paywall_view`, `checkout_start`, activated-user funnel. Add events: `extension_installed` (best-effort), `decision_set`, `contract_upload`, `playbook_used`, `monitor_email_on`. Do not build a new analytics product; tag the existing funnel.

---

## 11. Suggested build order (after spec approval)

Not tickets — sequence so we do not reshape the dashboard before anyone can install the product:

1. Extension publish + in-page loop fixes (return URL, unsubscribe, dismiss, options).
2. Pushback list + decision on web results and overlay (`recommendedAction` is already stored).
3. Restore paste + PDF upload; exclude private text from public cache.
4. Replace `/dashboard` with vendor workspace; kill vanity charts.
5. Playbooks (three presets) on top of target clauses.
6. Pricing copy + entitlement rename once dollar amounts are chosen.
7. Homepage: install-first, founder promise, stop “coming soon.”

---

## 12. Open questions for you

Answer these before an implementation plan. I will not invent them.

1. **Personal vs Founder prices** (monthly and annual).
2. **Free paste/upload:** one trial contract, or Founder-only?
3. **Watchlist sizes** per plan.
4. **PDF in v1:** paid-only (current) or included on Personal and Founder?
5. **Homepage:** founder-led with “also for anyone who clicks Accept,” or two paths (I’m signing a vendor / I’m checking an app)?
6. **Account creation:** required before first overlay result (current) or allow one anonymous overlay then gate save/monitor/decision?
