/* Themys landing — implemented from the approved "Combined" design (desktop,
   tablet and mobile artboards). All motion is CSS-only (landing.module.css);
   this stays a server component. */

import Link from "next/link";

import s from "./landing.module.css";

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");

const HERO_DOCS = [
  { slot: s.docA, host: "northwind.example", title: "Terms of Service", bars: [95, 80, 88, 60], hi: 1 },
  { slot: s.docB, host: "northwind.example", title: "Privacy Policy", bars: [85, 92, 70], hi: 2 },
  { slot: s.docC, host: "vendor_msa.pdf · 14 pp", title: "Vendor contract", bars: [90, 75, 84, 50], hi: 2 },
];

const HERO_FINDINGS = [
  { row: s.row1, tone: s.caution, label: "Terms change on posting" },
  { row: s.row2, tone: s.caution, label: "Data shared with partners" },
  { row: s.row3, tone: s.warning, label: "Uncapped liability for you" },
];

const DOC_TYPES = ["Terms of Service", "Privacy Policies", "Terms of Use", "Vendor contracts", "PDF uploads", "Pasted text"];

const SCAN_FINDINGS = [
  { anim: s.f1, tone: s.caution, sev: "Caution", title: "Terms change on posting" },
  { anim: s.f2, tone: s.caution, sev: "Caution", title: "Data shared with partners" },
  { anim: s.f3, tone: s.warning, sev: "Warning", title: "You waive class actions" },
];

const WATCHLIST = [
  { logo: "P", name: "Payments provider", doc: "Terms of Service", delay: "0.3s" },
  { logo: "N", name: "Northwind Cloud", doc: "Privacy Policy", changed: true },
  { logo: "A", name: "AI assistant", doc: "Terms of Use", delay: "1.9s" },
  { logo: "E", name: "Email platform", doc: "Privacy Policy", delay: "2.7s", optional: true },
];

const PLANS = [
  {
    name: "Free",
    price: "$0",
    features: ["15 reviews per month", "1 watched service", "Dashboard alerts", "1 contract review trial"],
    cta: "Get started free",
    href: "/sign-up",
  },
  {
    name: "Founder",
    price: "$4.99",
    features: ["50 reviews per month", "25 watched services", "Email alerts and PDF", "Paste and PDF upload · playbooks"],
    cta: "See Founder",
    href: "/pricing",
    highlight: true,
  },
  {
    name: "Personal",
    price: "$2.49",
    features: ["30 reviews per month", "10 watched services", "Email alerts", "PDF export"],
    cta: "See Personal",
    href: "/pricing",
  },
];

function Ctas({ vendorHref, consumerHref }: { vendorHref: string; consumerHref: string }) {
  return (
    <div className={s.ctas}>
      <Link className={s.pill} href={vendorHref}>
        Review a contract
      </Link>
      <Link className={cx(s.pill, s.pillGhost)} href={consumerHref}>
        Check an app&rsquo;s terms
      </Link>
    </div>
  );
}

function Hero({ vendorHref, consumerHref }: { vendorHref: string; consumerHref: string }) {
  return (
    <header className={s.hero}>
      <span className={s.kicker}>Privacy-first ToS analysis</span>
      <h1 className={s.h1}>
        All your fine print, <em>one clear briefing</em>.
      </h1>
      <p className={s.heroSub}>
        Terms, privacy policies and vendor contracts go in. What you&rsquo;re actually agreeing to comes out, clause by
        clause, in plain English.
      </p>
      <Ctas vendorHref={vendorHref} consumerHref={consumerHref} />

      <div className={s.stage} role="img" aria-label="Several legal documents combining into one plain-English briefing">
        {HERO_DOCS.map((doc) => (
          <div className={cx(s.docSlot, doc.slot)} key={doc.title}>
            <div className={s.docCard}>
              <span className={s.docHost}>{doc.host}</span>
              <span className={s.docTitle}>{doc.title}</span>
              {doc.bars.map((width, i) => (
                <span
                  className={cx(s.bar, i === doc.hi && s.barHi, i > doc.hi && s.barOptional)}
                  style={{ width: `${width}%` }}
                  key={i}
                />
              ))}
            </div>
          </div>
        ))}
        <div className={cx(s.docSlot, s.docD)}>
          <div className={s.docCard}>
            <span className={s.docTitle}>Terms of Use</span>
            <span className={s.bar} style={{ width: "90%" }} />
            <span className={cx(s.bar, s.barOptional)} style={{ width: "65%" }} />
          </div>
        </div>
        <span className={cx(s.particle, s.p1)} />
        <span className={cx(s.particle, s.p2)} />
        <span className={cx(s.particle, s.p3)} />
        <div className={s.brief}>
          <span className={s.label}>Your briefing · 3 documents</span>
          <span className={s.briefTitle}>Three things to know before you agree.</span>
          <div className={s.briefRows}>
            {HERO_FINDINGS.map((finding) => (
              <div className={cx(s.briefRow, finding.row)} key={finding.label}>
                <span className={cx(s.dot, finding.tone)} />
                {finding.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

function DocMarquee() {
  return (
    <div className={s.marquee}>
      <div className={s.marqueeTrack}>
        {[false, true].map((hidden) =>
          DOC_TYPES.map((type) => (
            <span aria-hidden={hidden || undefined} key={`${type}-${hidden}`}>
              {type} <span aria-hidden="true">&nbsp;&middot;</span>
            </span>
          )),
        )}
      </div>
    </div>
  );
}

function ScanSection() {
  return (
    <section className={cx(s.wrap, s.scanSec)} id="see-it-read">
      <span className={s.kicker}>See it read</span>
      <h2 className={s.h2}>
        Every clause read. Only the ones that matter <em>flagged</em>.
      </h2>
      <div className={s.scanCard}>
        <div className={s.scanDoc}>
          <div>
            <span className={s.scanHost}>northwind.example/terms</span>
            <span className={s.scanTitle}>Terms of Service</span>
          </div>
          <div className={s.scanBody}>
            <div className={s.scanLine} aria-hidden="true" />
            <p className={s.pOptional}>
              1.1 By accessing or using the Service you agree to be bound by these Terms and by our Privacy Policy.
            </p>
            <p>
              4.1{" "}
              <span className={cx(s.hl, s.hl1)}>
                We may modify these Terms at any time. Changes take effect upon posting, and continued use constitutes
                acceptance.
              </span>
            </p>
            <p>6.2 You are responsible for all activity under your account.</p>
            <p>
              7.2{" "}
              <span className={cx(s.hl, s.hl2)}>
                We may share identifiers associated with your account with affiliates, partners and analytics providers.
              </span>
            </p>
            <p className={s.pOptional}>11.4 The Service is provided &ldquo;as is&rdquo; without warranties of any kind.</p>
            <p>
              12.3{" "}
              <span className={cx(s.hl, s.hl3)}>
                Any dispute will be resolved by final and binding arbitration. You waive any right to a class action.
              </span>
            </p>
          </div>
        </div>
        <div className={s.scanBrief}>
          <span className={s.label}>Briefing · 31 clauses analyzed</span>
          <span className={s.scanSum}>Standard terms, with three things to know.</span>
          <div className={s.findings}>
            {SCAN_FINDINGS.map((finding) => (
              <div className={cx(s.finding, finding.anim)} key={finding.title}>
                <span className={cx(s.sev, finding.tone)}>
                  <span className={s.dot} />
                  {finding.sev}
                </span>
                <span className={s.findingTitle}>{finding.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className={s.sec} id="how-it-works">
      <div className={s.wrap}>
        <span className={s.kicker}>How it works</span>
        <h2 className={s.h2}>Three steps to clarity.</h2>
        <div className={s.steps}>
          <div className={s.step}>
            <div className={s.vignette} aria-hidden="true">
              <div className={s.vigInput}>
                <span className={s.typed}>example.com/terms</span>
                <span className={s.caret} />
              </div>
            </div>
            <div className={s.stepHead}>
              <span className={s.num}>01</span>
              <h3 className={s.h3}>Enter a URL or paper</h3>
            </div>
            <p className={s.copy}>Paste text, upload a PDF, or point at a public Terms of Service URL.</p>
          </div>
          <div className={s.step}>
            <div className={cx(s.vignette, s.sevRows)} aria-hidden="true">
              {[
                { dot: s.s1, width: 1 },
                { dot: s.s2, width: 0.75 },
                { dot: s.s3, width: 0.9 },
              ].map((row, i) => (
                <div className={s.sevRow} key={i}>
                  <span className={cx(s.sevDot, row.dot)} />
                  <span className={s.sevBar} style={{ flex: row.width }} />
                </div>
              ))}
            </div>
            <div className={s.stepHead}>
              <span className={s.num}>02</span>
              <h3 className={s.h3}>AI analysis</h3>
            </div>
            <p className={s.copy}>
              Themys extracts the text, finds the clauses that matter, and marks each as a warning, caution or note.
            </p>
          </div>
          <div className={s.step}>
            <div className={cx(s.vignette, s.vigDone)} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" strokeOpacity="0.3" />
                <path className={s.check} d="M7.5 12.5l3 3 6-6.5" />
              </svg>
              <span>3 flagged of 31, explained.</span>
            </div>
            <div className={s.stepHead}>
              <span className={s.num}>03</span>
              <h3 className={s.h3}>Plain English results</h3>
            </div>
            <p className={s.copy}>Flagged clauses with quotes, explanations and the original wording side by side.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const rows = [
    {
      title: "The report",
      copy: "A plain-English summary, flagged clauses first, each one beside the sentence it came from.",
      visual: (
        <div className={s.badges}>
          <span className={cx(s.badge, s.bHigh)}>1 warning</span>
          <span className={cx(s.badge, s.bMed)}>2 cautions</span>
          <span className={cx(s.badge, s.bDoc)}>28 standard</span>
        </div>
      ),
    },
    {
      title: "Monitoring",
      copy: "Watch a Privacy Policy or Terms page. A quiet rewording in one clause becomes an alert, not a surprise.",
      visual: (
        <div className={s.diff}>
          share with <span className={s.strike}>our affiliates</span>{" "}
          <span className={s.ins}>partners and analytics providers</span>
        </div>
      ),
    },
    {
      title: "History",
      copy: "Every document you’ve reviewed, kept and searchable. Filter by risk, export any report as a PDF.",
      visual: (
        <div className={s.skel} aria-hidden="true">
          <span style={{ width: "92%" }} />
          <span style={{ width: "70%" }} />
          <span style={{ width: "82%" }} />
        </div>
      ),
    },
    {
      title: "Developer API",
      copy: "One POST with a public URL; sections, flagged clauses and summaries come back as structured data.",
      visual: (
        <div className={s.usage} aria-hidden="true">
          {[40, 65, 50, 85, 70, 100].map((height, i) => (
            <span style={{ height: `${height}%`, animationDelay: `${i * 0.2}s` }} key={i} />
          ))}
        </div>
      ),
    },
  ];

  return (
    <section className={s.sec} id="features">
      <div className={s.wrap}>
        <span className={s.kicker}>What Themys does</span>
        <h2 className={s.h2} style={{ maxWidth: "22ch" }}>
          One reader for every agreement you touch.
        </h2>
        <div className={s.features}>
          {rows.map((row, i) => (
            <div className={s.feature} key={row.title}>
              <span className={s.num}>{String(i + 1).padStart(2, "0")}</span>
              <div className={s.featText}>
                <h3 className={s.h3}>{row.title}</h3>
                <p className={s.copy}>{row.copy}</p>
              </div>
              <div className={s.featVis}>{row.visual}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Monitoring() {
  return (
    <section className={s.sec} id="monitoring">
      <div className={s.wrap}>
        <div className={s.monHead}>
          <div>
            <span className={s.kicker}>Monitoring</span>
            <h2 className={s.h2}>
              Watch the paper you care about. <em>Get told when it moves.</em>
            </h2>
          </div>
          <p className={s.lede}>
            Each Privacy Policy, Terms of Use or Terms of Service is tracked against its own baseline, so a quiet rewording
            in one clause is an alert, not a surprise.
          </p>
        </div>
        <div className={s.monCard}>
          <div className={s.watch}>
            <div className={s.watchHead}>
              <span className={s.watchTitle}>Monitored services</span>
              <span className={s.meta}>Checked daily</span>
            </div>
            <div className={s.watchList}>
              {WATCHLIST.map((item) => (
                <div
                  className={cx(s.watchRow, item.changed && s.watchChanged, item.optional && s.watchOptional)}
                  key={item.name}
                >
                  <span className={s.logo}>{item.logo}</span>
                  <div className={s.watchName}>
                    <strong>{item.name}</strong>
                    <span className={s.meta}>{item.doc}</span>
                  </div>
                  {item.changed ? (
                    <span className={s.status}>
                      <span className={s.statusOld} aria-hidden="true">
                        No changes
                      </span>
                      <span className={s.statusNew}>1 change</span>
                    </span>
                  ) : (
                    <>
                      <span className={s.chk} style={{ animationDelay: item.delay }} />
                      <span className={cx(s.meta, s.statusQuiet)}>No changes</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className={s.alertWrap}>
            <div className={s.alert}>
              <div className={s.alertTop}>
                <span className={s.ping} />
                <span className={s.label}>New alert · Northwind Cloud</span>
                <span className={s.meta}>just now</span>
              </div>
              <span className={s.alertTitle}>§ 7.2 now shares your data more widely.</span>
              <p className={s.quote}>
                We may share identifiers with <span className={s.cStrike}>our affiliates</span>{" "}
                <span className={s.cIns}>partners and analytics providers</span> for the purposes in this Policy.
              </p>
              <span className={s.alertNote}>
                Previously limited to affiliates. Now includes third parties you have no agreement with.
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section className={s.sec} id="pricing">
      <div className={s.wrap}>
        <div className={s.priceHead}>
          <span className={s.kicker}>Pricing</span>
          <h2 className={s.h2}>Simple, transparent pricing.</h2>
          <p className={s.lede}>Start free. Personal is for watching apps. Founder is the contract desk.</p>
        </div>
        <div className={s.plans}>
          {PLANS.map((plan) => (
            <div className={cx(s.plan, plan.highlight && s.planHi)} key={plan.name}>
              <div className={s.planTop}>
                <span className={s.planName}>
                  {plan.name}
                  {plan.highlight ? " · Most popular" : null}
                </span>
                <span className={s.planPrice}>
                  {plan.price}
                  {plan.price !== "$0" ? <span className={s.planPer}> /mo</span> : null}
                </span>
              </div>
              <ul className={s.planList}>
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <Link className={cx(s.pill, s.planCta, plan.highlight ? s.pillSienna : s.pillGhost)} href={plan.href}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className={s.priceNote}>Credit packs &mdash; 10 for $1.99 · 50 for $7.99 · 200 for $24.99</p>
      </div>
    </section>
  );
}

export function LandingMain({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) {
  const vendorHref = isAuthenticated ? "/scan/new" : "/sign-up?intent=founder";
  const consumerHref = isAuthenticated ? "/scan/new" : "/sign-up?intent=personal";

  return (
    <div className={s.page}>
      <Hero vendorHref={vendorHref} consumerHref={consumerHref} />
      <DocMarquee />
      <ScanSection />
      <HowItWorks />
      <Features />
      <Monitoring />
      <Pricing />
      <section className={s.final}>
        <h2 className={s.finalH2}>
          Stop clicking &ldquo;Accept&rdquo; <em>blindly</em>.
        </h2>
        <Ctas vendorHref={vendorHref} consumerHref={consumerHref} />
      </section>
    </div>
  );
}
