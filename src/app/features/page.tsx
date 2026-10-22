import Link from "next/link"
import type { Metadata } from "next"
import { auth } from "@clerk/nextjs/server"

import { SiteFooter } from "@/components/site-footer"
import { TrustBadges } from "@/components/trust-badges"
import { PageViewTracker } from "@/components/pageview-tracker"

/**
 * Public, indexable feature page.
 *
 * The app surfaces it describes (dashboard, scan, results, history,
 * monitoring, developer API) all sit behind Clerk, so Google can only ever
 * fetch a sign-in redirect for them. This page is the crawlable description of
 * those surfaces — every claim here is grounded in docs/src/app/content/*.md.
 */

const CHROME_STORE_URL = process.env.NEXT_PUBLIC_CHROME_STORE_URL?.trim() || null

export const metadata: Metadata = {
  title: "Features",
  description:
    "Scan a terms of service or vendor contract, review flagged clauses with quoted text, record your decision, and get alerted when the document changes.",
  alternates: {
    canonical: "/features",
  },
  openGraph: {
    title: "Features | Themys",
    description:
      "Scan a terms of service or vendor contract, review flagged clauses with quoted text, record your decision, and get alerted when the document changes.",
    url: "/features",
    images: [
      {
        url: "/themys-og.png",
        width: 1200,
        height: 630,
        alt: "Themys features — scan, review, decide, watch",
      },
    ],
  },
  twitter: {
    title: "Features | Themys",
    description:
      "Scan a terms of service, review flagged clauses in plain English, and track what changes.",
    images: [{ url: "/themys-og.png", alt: "Themys features" }],
  },
}

const movements = [
  {
    step: "01",
    title: "Scan",
    detail:
      "Enter a public Terms of Service or Privacy Policy URL, paste vendor paper, or upload a PDF. Each analysis counts as one review against your plan.",
  },
  {
    step: "02",
    title: "Review",
    detail:
      "Read flagged clauses with the quoted original text, a severity rating, a category, and a plain-English explanation.",
  },
  {
    step: "03",
    title: "Decide",
    detail:
      "Record sign, negotiate, or walk away against the review, and collect the suggested asks worth sending before you sign.",
  },
  {
    step: "04",
    title: "Watch",
    detail:
      "Put a service on your radar and Themys checks the document again, raising an alert when something you cared about changes.",
  },
]

/** A bullet is either prose, or prose whose leading token is code (mono). */
type SurfacePoint = string | { text: string; mono: true }

const surfaces: {
  name: string
  meta: string
  body: string
  points: SurfacePoint[]
}[] = [
  {
    name: "Scan",
    meta: "Web app",
    body:
      "Start a review from the dashboard with Scan a website, Paste your text, or Upload a PDF. Public URLs work without a copy of the document; pasted text and PDFs are for vendor paper you already hold.",
    points: [
      "Public Terms or Privacy URLs, pasted text, or PDF upload",
      "Paste and PDF upload are available on the Founder plan",
      "One review is counted per successful analysis",
    ],
  },
  {
    name: "Results",
    meta: "Per document",
    body:
      "Each review opens on an attention level, then the flagged clauses: the quoted passage, the category it falls under, and why it was raised. Severity is rated Informational, Caution, or Warning so the document reads as a set of decisions rather than a wall of legalese.",
    points: [
      "Attention level for the document as a whole",
      "Flagged clauses with quoted text and an explanation",
      "Categories covering privacy, arbitration, data sharing, and liability",
    ],
  },
  {
    name: "Full extraction",
    meta: "Per document",
    body:
      "Below the flags, the full extraction keeps the original document in view: section titles, bullet-point key points in plain English, and a summary you can skim before reading further.",
    points: [
      "Section-by-section key points",
      "Plain-English summary",
      "The quoted source text stays next to every finding",
    ],
  },
  {
    name: "History",
    meta: "Across documents",
    body:
      "Every review you have run stays in History, searchable by document or service name, with the decision you recorded. Two scans of the same document can be compared side by side to see what moved.",
    points: [
      "Search older scans by document or service",
      "Decisions recorded per review: sign, negotiate, or walk away",
      "Compare two scans of the same document",
    ],
  },
  {
    name: "Monitoring",
    meta: "Ongoing",
    body:
      "Watched services sit on your radar. Themys re-reads the document and raises an alert when it changes, so you hear about a reworded clause without re-reading the whole thing.",
    points: [
      "Watched services with unread alerts surfaced first",
      "Alert limits follow your plan",
      "Email alerts on paid plans, or turn notifications off",
    ],
  },
  {
    name: "Dashboard",
    meta: "Starting point",
    body:
      "The dashboard gathers the work in progress: reviews with an open decision, watched services with unread alerts, and the asks worth raising from recent reviews.",
    points: [
      "Pick up where you left off",
      "On your radar: watched services and unread alerts",
      "Worth a conversation: suggested asks from recent reviews",
    ],
  },
  {
    name: "Settings",
    meta: "Account",
    body:
      "Profile, preferences, subscription, credits, and payment history live in Settings, along with account deletion if you want out.",
    points: [
      "Subscription, credits, and payment history",
      "Profile and preferences",
      "Delete your account",
    ],
  },
  {
    name: "Developer API",
    meta: "Experimental",
    body:
      "The API exposes the same extraction and analysis pipeline for programmatic use, with keys you create and revoke from Settings. Endpoints, authentication, and response limits are documented in full.",
    points: [
      { text: "POST /api/extract for readable text from a public URL", mono: true },
      {
        text: "POST /api/analyze and POST /api/analyze/batch for review findings",
        mono: true,
      },
      "Experimental — the interface may change",
    ],
  },
]

function Check() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default async function FeaturesPage() {
  const { isAuthenticated } = await auth()
  const primaryHref = isAuthenticated ? "/scan/new" : "/sign-up"

  return (
    <div className="bg-[var(--ds-bg)] text-[var(--ds-text)]">
      <PageViewTracker route="/features" />

      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-16 sm:px-6 sm:pb-20 sm:pt-24 lg:px-8">
          <div className="max-w-3xl">
            <p className="mb-6 text-[15px] font-medium uppercase tracking-[0.1em] text-[var(--ds-text-muted)]">
              Features
            </p>
            <h1 className="text-[36px] font-normal leading-[1.2] tracking-[-0.66px] text-[var(--ds-text)] sm:text-[56px] sm:leading-[1.25] sm:tracking-[-0.96px]">
              Scan a terms of service, review every clause, and track what changes.
            </h1>
            <p className="mt-6 max-w-2xl text-[17px] leading-[1.5] text-[var(--ds-text-secondary)] sm:text-[20px]">
              Themys reads a public legal document, shows you the clauses worth your attention with
              the original text beside them, keeps a record of what you decided, and tells you when
              the document changes underneath you.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href={primaryHref}
                className="inline-flex h-12 items-center rounded-full bg-[var(--ds-accent)] px-7 text-[16px] font-medium text-[var(--primary-foreground)] transition hover:opacity-90"
              >
                Scan a public URL
              </Link>
              <Link
                href="/pricing"
                className="inline-flex h-12 items-center rounded-full border border-[var(--ds-text)] px-7 text-[16px] font-medium text-[var(--ds-text)] transition hover:bg-[var(--ds-card-hover)]"
              >
                See what each plan includes
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="movements-heading"
        className="border-y border-[var(--ds-border)] py-16 sm:py-24"
      >
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <h2
            id="movements-heading"
            className="text-[28px] font-normal tracking-[-0.23px] text-[var(--ds-text)] sm:text-[36px]"
          >
            Four moves, repeated for every document
          </h2>
          <div className="mt-12 grid gap-px bg-[var(--ds-border)] sm:grid-cols-2 lg:grid-cols-4">
            {movements.map((movement) => (
              <div key={movement.step} className="bg-[var(--ds-bg)] p-6">
                <p className="text-[15px] font-medium uppercase tracking-widest text-[var(--ds-text-dim)]">
                  Step {movement.step}
                </p>
                <h3 className="mt-2 text-[20px] font-medium text-[var(--ds-text)]">
                  {movement.title}
                </h3>
                <p className="mt-2 text-[15px] leading-6 text-[var(--ds-text-secondary)]">
                  {movement.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="surfaces-heading" className="py-16 sm:py-24">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <h2
            id="surfaces-heading"
            className="text-[28px] font-normal tracking-[-0.23px] text-[var(--ds-text)] sm:text-[36px]"
          >
            Every surface, and what it does
          </h2>
          <div className="mt-12 border-t border-[var(--ds-border)]">
            {surfaces.map((surface) => (
              <div
                key={surface.name}
                className="grid gap-4 border-b border-[var(--ds-border)] py-8 lg:grid-cols-[220px_1fr] lg:gap-10"
              >
                <div>
                  <h3 className="text-[22px] font-normal tracking-[-0.23px] text-[var(--ds-text)]">
                    {surface.name}
                  </h3>
                  <p className="mt-1 text-[13px] uppercase tracking-[0.12em] text-[var(--ds-text-dim)]">
                    {surface.meta}
                  </p>
                </div>
                <div>
                  <p className="max-w-[62ch] text-[17px] leading-7 text-[var(--ds-text-secondary)]">
                    {surface.body}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {surface.points.map((point) => (
                      <li
                        key={typeof point === "string" ? point : point.text}
                        className="flex items-start gap-2.5 text-[15px] text-[var(--ds-text-secondary)]"
                      >
                        <span className="mt-0.5 text-[var(--ds-success)]">
                          <Check />
                        </span>
                        {typeof point === "string" ? (
                          point
                        ) : (
                          <span className="font-mono text-[14px]">{point.text}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="availability-heading"
        className="border-t border-[var(--ds-border)] bg-[var(--ds-card-hover)] py-16 sm:py-24"
      >
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="max-w-[62ch]">
            <h2
              id="availability-heading"
              className="text-[28px] font-normal tracking-[-0.23px] text-[var(--ds-text)] sm:text-[36px]"
            >
              What is available today
            </h2>
            <p className="mt-5 text-[17px] leading-7 text-[var(--ds-text-secondary)]">
              Every scan, review, and alert described above runs in the web app today.{" "}
              {CHROME_STORE_URL ? (
                <>
                  The{" "}
                  <a
                    href={CHROME_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--ds-accent)] underline underline-offset-4"
                  >
                    Chrome extension
                  </a>{" "}
                  adds in-browser scanning on top of it.
                </>
              ) : (
                "A Chrome extension is coming soon; until then the web app is the whole product."
              )}{" "}
              The developer API is experimental and may change between releases.
            </p>
            <p className="mt-5 text-[17px] leading-7 text-[var(--ds-text-secondary)]">
              Themys explains what a document says and where the asks are. It is not legal advice —
              for anything binding, involve qualified counsel.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[15px]">
              <a
                href="https://docs.themys.ca/"
                className="text-[var(--ds-accent)] underline underline-offset-4"
              >
                Read the documentation
              </a>
              <a
                href="https://docs.themys.ca/legal#privacy"
                className="text-[var(--ds-accent)] underline underline-offset-4"
              >
                How your data is handled
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-[32px] font-normal tracking-[-0.66px] text-[var(--ds-text)] sm:text-[44px]">
            Start with the document you were about to accept
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[17px] leading-8 text-[var(--ds-text-secondary)]">
            Free to start, no credit card required. Bring a public Terms URL or the vendor paper
            sitting in your downloads folder.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href={primaryHref}
              className="inline-flex h-12 items-center rounded-full bg-[var(--ds-accent)] px-8 text-[16px] font-medium text-[var(--primary-foreground)] transition hover:opacity-90"
            >
              Scan a public URL
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center rounded-full border border-[var(--ds-text)] px-8 text-[16px] font-medium text-[var(--ds-text)]"
            >
              Compare plans
            </Link>
          </div>
        </div>
      </section>

      <div className="border-t border-[var(--ds-border)] bg-[var(--ds-card)] py-4">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <TrustBadges />
        </div>
      </div>

      <SiteFooter />
    </div>
  )
}
