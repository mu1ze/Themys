"use client";

import Link from "next/link";

import { motion } from "motion/react";
import { SectionReveal, InteractiveCard, InteractiveButton, ScrollProgressBar } from "@/components/landing-v2/motion-components";
import { AppDemo } from "@/components/landing-v2/app-demo";

/* Inline icons matching current landing page */
const Shield = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M12 2L19 5.5V13C19 17.5 15.5 21 12 22C8.5 21 5 17.5 5 13V5.5L12 2Z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="0.5"/>
    <line x1="12" y1="7" x2="12" y2="16" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="8.5" y1="9" x2="15.5" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    <polyline points="12,16 11,17.5 13,17.5" fill="currentColor" opacity="0.8"/>
  </svg>
);

const ArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default function LandingV2Page() {
  const chromeStoreUrl = process.env.NEXT_PUBLIC_CHROME_STORE_URL?.trim() || null

  return (
    <main className="min-h-screen bg-[#ffffff] text-[#17191c] antialiased" style={{ fontFamily: "var(--font-sohne), ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
      <ScrollProgressBar />
      {/* ═══════ HERO ═══════ */}
      <section className="relative overflow-hidden px-6 pt-28 pb-20 lg:pt-36 lg:pb-28">
        <div className="mx-auto max-w-[1200px]">
          <div className="mx-auto max-w-3xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#ececec] bg-[#fafafb] px-4 py-1.5 text-sm font-medium text-[#777b86]"
            >
              <Shield /> Privacy-first ToS analysis
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="text-[90px] font-normal leading-[1.3] tracking-[-2.25px] text-[#17191c] sm:text-[64px] lg:text-[90px]"
              style={{ fontFamily: "var(--font-signifier), ui-serif, Georgia, serif" }}
            >
              Before you sign, see the clauses you can still push back on.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto mt-6 max-w-xl text-xl leading-[1.35] text-[#777b86]"
            >
              Themys highlights the asks worth sending before you sign a vendor, or the clauses worth a second look in an app you already use.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto mt-10 grid w-full max-w-2xl gap-4 sm:grid-cols-2"
            >
              <div className="flex flex-col rounded-2xl border border-[#ececec] bg-white p-5 text-left">
                <p className="text-sm font-semibold text-[#17191c]">I&apos;m signing a vendor</p>
                <p className="mt-2 flex-1 text-sm leading-6 text-[#777b86]">
                  Paste or upload the paper, get a pushback list, then record sign, negotiate, or walk away.
                </p>
                <InteractiveButton href="/sign-up?intent=founder" className="mt-4 h-11 rounded-full bg-[#17191c] px-5 text-sm font-medium text-white hover:opacity-90">
                  Review a contract
                </InteractiveButton>
              </div>
              <div className="flex flex-col rounded-2xl border border-[#ececec] bg-white p-5 text-left">
                <p className="text-sm font-semibold text-[#17191c]">I&apos;m checking an app</p>
                <p className="mt-2 flex-1 text-sm leading-6 text-[#777b86]">
                  Scan the page you&apos;re already on and watch the services that matter.
                </p>
                <InteractiveButton href="/sign-up?intent=personal" className="mt-4 h-11 rounded-full bg-[#17191c] px-5 text-sm font-medium text-white hover:opacity-90">
                  Create a Personal account
                </InteractiveButton>
                {chromeStoreUrl ? (
                  <a
                    href={chromeStoreUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 text-center text-sm font-medium text-[#17191c]"
                  >
                    Install the Chrome extension
                  </a>
                ) : (
                  <span className="mt-2 text-center text-sm text-[#a3a6af]">Chrome extension coming soon</span>
                )}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Interactive floating artifact cards */}
        <div className="mx-auto mt-20 max-w-4xl px-4">
          <SectionReveal>
            <InteractiveCard className="bg-[#ffffff] overflow-hidden rounded-[20px] shadow-[0_0_0_1px_rgba(4,23,43,0.05),_0_20px_25px_-5px_rgba(0,0,0,0.1),_0_8px_10px_-6px_rgba(0,0,0,0.06)]">
              <div className="grid gap-6 p-6 md:grid-cols-[240px_1fr] md:p-8">
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#ececec] bg-[#f2f2f3] p-6">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[#17191c] to-[#17191c]/70 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                    <Shield />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#979799]">Privacy</p>
                  <p className="text-center text-sm leading-5 text-[#777b86]">Terms analyzed in real time</p>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#fbe1d1] px-2.5 py-0.5 text-[11px] font-bold text-[#5d2a1a]">Needs attention</span>
                    <span className="text-sm text-[#a3a6af]">4 clauses flagged</span>
                  </div>
                  <h3 className="text-xl font-bold text-[#17191c] tracking-tight">Sample ToS Analysis</h3>
                  <p className="text-sm leading-6 text-[#777b86]">
                    This demonstration agreement allows broad data sharing, mandatory arbitration, and unilateral changes — all highlighted in plain English.
                  </p>
                  <div className="space-y-2.5">
                    {[
                      { label: "Data sharing", level: "High", desc: "May share identifiers with analytics partners." },
                      { label: "Arbitration", level: "High", desc: "Mandatory binding arbitration waives class actions." },
                      { label: "Terms change", level: "Medium", desc: "Can modify agreement with limited notice." },
                    ].map((item) => (
                      <div key={item.label} className="flex items-start gap-3 rounded-xl border border-[#ececec] bg-[#fafafb] p-3 transition hover:bg-[#f2f2f3]">
                        <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${item.level === "High" ? "bg-[#5d2a1a]" : "bg-[#f59e0b]"}`} />
                        <div>
                          <p className="text-sm font-semibold text-[#17191c]">{item.label}</p>
                          <p className="mt-0.5 text-xs text-[#a3a6af]">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </InteractiveCard>
          </SectionReveal>
        </div>
      </section>

      {/* ═══════ PROBLEM ═══════ */}
      <section className="border-y border-[#ececec] bg-[#fafafb] py-20 sm:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <SectionReveal>
              <p className="text-sm font-semibold uppercase tracking-[0.1em] text-[#979799]">The problem</p>
              <h2
                className="mt-3 text-[64px] font-normal leading-[1.3] tracking-[-0.96px] text-[#17191c] sm:text-[44px] lg:text-[64px]"
                style={{ fontFamily: "var(--font-signifier), ui-serif, Georgia, serif" }}
              >
                You agree to things you never read
              </h2>
            </SectionReveal>
          </div>

          <SectionReveal delay={0.15}>
            <div className="mx-auto mt-14 grid max-w-4xl border-y border-[#ececec] sm:grid-cols-3">
              {[
                { title: "Read the source", label: "Keep the original public document in view while you review the findings." },
                { title: "Focus your review", label: "Use attention levels and quoted clauses to decide what deserves a closer look." },
                { title: "Track changes", label: "Monitor the specific legal documents that matter to you and review alerts over time." },
              ].map((s) => (
                <motion.div
                  key={s.title}
                  className="border-b border-[#ececec] p-6 text-center last:border-b-0 sm:border-b-0 sm:border-r sm:border-r-[#ececec] sm:last:border-r-0"
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p className="text-lg font-semibold text-[#17191c]">{s.title}</p>
                  <p className="mt-2 text-sm leading-6 text-[#777b86]">{s.label}</p>
                </motion.div>
              ))}
            </div>
          </SectionReveal>
          <SectionReveal delay={0.2}>
            <p className="mx-auto mt-8 max-w-2xl text-center text-base text-[#777b86]">
              Companies bury risky clauses — broad data sharing, mandatory arbitration, unilateral changes — in walls of text. You click &quot;Accept&quot; without knowing what you gave away.
            </p>
          </SectionReveal>
        </div>
      </section>

      {/* ═══════ HOW IT WORKS ═══════ */}
      <section id="how-it-works" className="py-20 sm:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <SectionReveal>
              <p className="text-sm font-semibold uppercase tracking-[0.1em] text-[#979799]">How it works</p>
              <h2
                className="mt-3 text-[64px] font-normal leading-[1.3] tracking-[-0.96px] text-[#17191c] sm:text-[44px] lg:text-[64px]"
                style={{ fontFamily: "var(--font-signifier), ui-serif, Georgia, serif" }}
              >
                Three steps to clarity
              </h2>
            </SectionReveal>
          </div>

          <SectionReveal delay={0.1}>
            <div className="mx-auto mt-14 grid max-w-5xl border-y border-[#ececec] lg:grid-cols-3 lg:divide-x lg:divide-[#ececec]">
              {[
                { step: "01", title: "Enter a URL", desc: "Open the web app and enter a public Terms of Service or Privacy Policy URL.", color: "bg-[#f2f2f3] text-[#17191c]" },
                { step: "02", title: "AI analysis", desc: "Our multi-model pipeline extracts text, identifies clauses worth reviewing, and assigns a qualitative attention level.", color: "bg-[#fbe1d1] text-[#5d2a1a]" },
                { step: "03", title: "Plain English results", desc: "Get flagged clauses with severity ratings, quoted text, and explanations anyone can understand.", color: "bg-[#f2f2f3] text-[#17191c]" },
              ].map((s) => (
                <InteractiveCard key={s.step} className="relative border-b border-[#ececec] p-6 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0">
                  <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold uppercase tracking-widest ${s.color}`}>
                    {s.step}
                  </div>
                  <h3 className="text-lg font-bold text-[#17191c] tracking-tight">{s.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#777b86]">{s.desc}</p>
                </InteractiveCard>
              ))}
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* ═══════ FEATURES ═══════ */}
      <section id="features" className="border-t border-[#ececec] bg-[#fafafb] py-20 sm:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <SectionReveal>
              <p className="text-sm font-semibold uppercase tracking-[0.1em] text-[#979799]">Features</p>
              <h2
                className="mt-3 text-[64px] font-normal leading-[1.3] tracking-[-0.96px] text-[#17191c] sm:text-[44px] lg:text-[64px]"
                style={{ fontFamily: "var(--font-signifier), ui-serif, Georgia, serif" }}
              >
                Everything you need to stay informed
              </h2>
            </SectionReveal>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl gap-16 lg:grid-cols-2 lg:gap-10">
            {/* Feature 1 — Interactive card */}
            <SectionReveal delay={0}>
              <InteractiveCard className="flex flex-col gap-6 p-8 lg:p-10">
                <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#fbe1d1] px-3 py-1 text-xs font-semibold text-[#5d2a1a]">Instant attention levels</div>
                <h3 className="text-2xl font-bold tracking-tight text-[#17191c]">Every clause rated</h3>
                <p className="text-base leading-7 text-[#777b86]">
                  Every scan highlights clauses worth reviewing with qualitative attention levels based on clause severity, category weighting, and jurisdiction context.
                </p>
                <ul className="space-y-3">
                  {[
                    "Traffic-light attention levels (red / amber / green)",
                    "Category breakdown: privacy, arbitration, data sharing, liability",
                    "Jurisdiction-aware review guidance for your location",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-[#777b86]">
                      <span className="mt-0.5 text-emerald-600 shrink-0">{Check()}</span> {item}
                    </li>
                  ))}
                </ul>
              </InteractiveCard>
            </SectionReveal>

            <SectionReveal delay={0.1}>
              <InteractiveCard className="flex flex-col gap-6 p-8 lg:p-10">
                <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#f2f2f3] px-3 py-1 text-xs font-semibold text-[#17191c]">Deep analysis</div>
                <h3 className="text-2xl font-bold tracking-tight text-[#17191c]">Full extraction breakdown</h3>
                <p className="text-base leading-7 text-[#777b86]">
                  Beyond flagging risks, Themys breaks the entire agreement into organized sections — data collection, billing, IP rights, arbitration — with key points for each.
                </p>
                <ul className="space-y-3">
                  {[
                    "Section-by-section accordion view",
                    "Quoted text from the original agreement",
                    "Severity ratings per clause (info / caution / warning)",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-[#777b86]">
                      <span className="mt-0.5 text-emerald-600 shrink-0">{Check()}</span> {item}
                    </li>
                  ))}
                </ul>
              </InteractiveCard>
            </SectionReveal>
          </div>
        </div>
      </section>

      {/* ═══════ APP DEMO ═══════ */}
      <section className="border-t border-[#ececec] bg-[#fafafb] py-20 sm:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <SectionReveal>
              <p className="text-sm font-semibold uppercase tracking-[0.1em] text-[#979799]">See it in action</p>
              <h2
                className="mt-3 text-[64px] font-normal leading-[1.3] tracking-[-0.96px] text-[#17191c] sm:text-[44px] lg:text-[64px]"
                style={{ fontFamily: "var(--font-signifier), ui-serif, Georgia, serif" }}
              >
                The actual scan result
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-lg leading-[1.5] text-[#777b86]">
                Scroll to watch the Themys app reveal itself — attention gauge, flagged clauses, and the full extraction breakdown, built entirely in code to match the real product.
              </p>
            </SectionReveal>
          </div>

          <AppDemo />
        </div>
      </section>



      {/* ═══════ PRICING ═══════ */}
      <section id="pricing" className="py-20 sm:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <SectionReveal>
              <p className="text-sm font-semibold uppercase tracking-[0.1em] text-[#979799]">Pricing</p>
              <h2
                className="mt-3 text-[64px] font-normal leading-[1.3] tracking-[-0.96px] text-[#17191c] sm:text-[44px] lg:text-[64px]"
                style={{ fontFamily: "var(--font-signifier), ui-serif, Georgia, serif" }}
              >
                Simple, transparent pricing
              </h2>
            </SectionReveal>
          </div>

          <SectionReveal delay={0.1}>
            <div className="mx-auto mt-14 grid max-w-4xl border-y border-[#ececec] lg:grid-cols-3 lg:divide-x lg:divide-[#ececec]">
              {[
                {
                  name: "Free",
                  price: "$0",
                  period: "/month",
                  features: ["15 reviews per month", "1 watched service", "Dashboard alerts", "1 contract review trial", "Extension overlay"],
                  cta: "Get started free",
                  href: "/sign-up",
                  highlight: false,
                },
                {
                  name: "Personal",
                  price: "$2.49",
                  period: "/month",
                  features: ["30 reviews per month", "10 watched services", "Email alerts", "PDF export"],
                  cta: "See Personal",
                  href: "/pricing",
                  highlight: false,
                },
                {
                  name: "Founder",
                  price: "$4.99",
                  period: "/month",
                  features: ["50 reviews per month", "25 watched services", "Email alerts and PDF", "Paste and PDF upload", "Playbooks"],
                  cta: "See Founder",
                  href: "/pricing",
                  highlight: true,
                },
              ].map((plan) => (
                <InteractiveCard
                  key={plan.name}
                  className={`relative flex flex-col p-6 ${plan.highlight ? "bg-[#fbe1d1]" : "bg-white"}`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#17191c] px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-md">
                      Most Popular
                    </div>
                  )}
                  <h3 className="text-lg font-bold text-[#17191c] tracking-tight">{plan.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-[#17191c]">{plan.price}</span>
                    <span className="text-sm text-[#777b86]">{plan.period}</span>
                  </div>
                  <ul className="mt-6 flex-1 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-[#777b86]">
                        <span className="mt-0.5 text-emerald-600 shrink-0">{Check()}</span> {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.href}
                    className={`mt-8 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition hover:scale-[1.02] active:scale-[0.98] ${
                      plan.highlight
                        ? "bg-[#17191c] text-white shadow-lg shadow-[#17191c]/20 hover:shadow-[#17191c]/30"
                        : "border border-[#17191c] text-[#17191c] hover:bg-[#f2f2f3]"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </InteractiveCard>
              ))}
            </div>
          </SectionReveal>

          <SectionReveal delay={0.15}>
            <p className="mt-6 text-center text-sm text-[#a3a6af]">
              Need more? Add-on credit packs available: 10 credits $1.99 · 50 credits $7.99 · 200 credits $24.99
            </p>
          </SectionReveal>
        </div>
      </section>

      {/* ═══════ FINAL CTA ═══════ */}
      <section className="border-t border-[#ececec] bg-[#fafafb] py-20 sm:py-28">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
          <SectionReveal>
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#17191c] text-white shadow-xl shadow-[#17191c]/20">
              <Shield />
            </div>
            <h2 className="text-3xl font-medium tracking-tight text-[#17191c] sm:text-4xl lg:text-[52px] lg:leading-[1.15]" style={{ fontFamily: "var(--font-signifier), ui-serif, Georgia, serif" }}>
              Stop clicking &quot;Accept&quot; blindly
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-lg leading-[1.5] text-[#777b86]">
              Know exactly what you agree to. Start scanning Terms of Service for free — no credit card required.
            </p>
          </SectionReveal>

          <SectionReveal delay={0.15}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <motion.a
                href="/sign-up"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-[#17191c] px-8 text-base font-medium text-white shadow-xl shadow-[#17191c]/15 transition hover:shadow-2xl hover:shadow-[#17191c]/20"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                Start scanning free <ArrowRight />
              </motion.a>
              <a
                href={chromeStoreUrl ?? "#"}
                aria-disabled={!chromeStoreUrl}
                target={chromeStoreUrl ? "_blank" : undefined}
                rel={chromeStoreUrl ? "noopener noreferrer" : undefined}
                className={
                  chromeStoreUrl
                    ? "inline-flex h-12 items-center gap-2 rounded-full border border-[#ececec] bg-[#ffffff] px-8 text-base font-semibold text-[#17191c]"
                    : "inline-flex h-12 cursor-not-allowed items-center gap-2 rounded-full border border-[#ececec] bg-[#ffffff] px-8 text-base font-semibold text-[#a3a6af]"
                }
              >
                {chromeStoreUrl ? "Install the Chrome extension" : "Chrome extension coming soon"}
              </a>
            </div>
          </SectionReveal>
        </div>
      </section>
    </main>
  );
}
