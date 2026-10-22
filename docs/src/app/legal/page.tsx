import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Legal | Themys",
  description: "Themys Privacy Policy, Terms of Service, and Refund Policy.",
};

const mail = "admin@themys.ca";
const updated = "September 22, 2026";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8 border-t pt-9 first:border-t-0 first:pt-0" style={{ borderColor: "var(--legal-border, #263244)" }}>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-4 space-y-4 text-[15px] leading-7 text-[var(--legal-muted,#a4b0c2)]">{children}</div>
    </section>
  );
}

function Subheading({ children }: { children: React.ReactNode }) {
  return <h3 className="pt-2 text-base font-semibold text-inherit">{children}</h3>;
}

function ProviderRow({ name, purpose, data }: { name: string; purpose: string; data: string }) {
  return (
    <tr className="border-t align-top" style={{ borderColor: "var(--legal-border, #263244)" }}>
      <th scope="row" className="px-4 py-3 text-left font-semibold text-inherit">{name}</th>
      <td className="px-4 py-3">{purpose}</td>
      <td className="px-4 py-3">{data}</td>
    </tr>
  );
}

export default function LegalPage() {
  return (
    <article className="mx-auto max-w-3xl">
      <div className="rounded-2xl border p-7 sm:p-10" style={{ borderColor: "var(--legal-border, #263244)", background: "var(--legal-surface, #111827)" }}>
        <p className="text-sm font-semibold text-blue-400">THEMYS LEGAL</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Privacy, clearly stated.</h1>
        <p className="mt-4 max-w-2xl leading-7 text-slate-400">
          These policies apply to Themys at <a className="text-blue-400 underline underline-offset-4" href="https://themys.ca">themys.ca</a>,
          its web app, APIs, documentation, and monitoring email service. The planned browser extension is coming soon and is not currently available.
          Effective and last updated {updated}.
        </p>
        <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-100">
          These policies are a plain-language product disclosure, not legal advice. They must be reviewed by qualified counsel before launch and before being relied on for a particular jurisdiction or use case.
        </p>
        <nav className="mt-7 flex flex-wrap gap-3 text-sm font-medium" aria-label="Legal policies">
          <a className="rounded-full border px-4 py-2 hover:border-blue-400" href="#privacy">Privacy Policy</a>
          <a className="rounded-full border px-4 py-2 hover:border-blue-400" href="#terms">Terms of Service</a>
          <a className="rounded-full border px-4 py-2 hover:border-blue-400" href="#refunds">Refund Policy</a>
        </nav>
      </div>

      <div className="mt-10 space-y-12">
        <Section id="privacy" title="Privacy Policy">
          <p>
            Themys (&quot;Themys&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates the Service. We are currently using Themys as the operating name rather than stating that a corporation or other incorporated entity exists. Our privacy contact is <a className="text-blue-400 underline underline-offset-4" href={`mailto:${mail}`}>{mail}</a>.
            This policy describes personal information and document content processed when you use the Service.
          </p>

          <Subheading>Information we collect</Subheading>
          <ul className="list-disc space-y-2 pl-5">
            <li><strong className="text-inherit">Account and profile data:</strong> name, email address, Clerk account and session identifiers, country or state, target-clause preferences, strict-mode preference, and sign-up attribution such as UTM campaign values.</li>
            <li><strong className="text-inherit">Document and product data:</strong> public URLs you submit, text retrieved from those URLs, text you paste or upload, text submitted through the API, scan results, quoted clauses, explanations, structured extraction, history, monitoring subscriptions, snapshots, alerts, and notification state.</li>
            <li><strong className="text-inherit">Billing data:</strong> plan, subscription and entitlement state, credits, Stripe customer/subscription/invoice/payment references, purchase-policy acknowledgement, refund requests, dispute references, amounts, currency, and billing status. Themys does not receive or store full payment-card numbers.</li>
            <li><strong className="text-inherit">Operational and support data:</strong> IP address and user-agent information used for rate limits and abuse prevention, request paths and timing, security events, documentation feedback, and support correspondence.</li>
            <li><strong className="text-inherit">Measurement data:</strong> first-party page-view and product-funnel events. Anonymous events use a one-way hash of the request IP and user-agent rather than storing that fingerprint in the usage-events table as plaintext. We do not currently use a third-party advertising or cross-site analytics SDK.</li>
          </ul>

          <Subheading>Cookies and similar storage</Subheading>
          <p>
            Clerk uses cookies or related browser storage to maintain authentication. The web app may set short first-party attribution cookies when a landing-page URL contains UTM parameters. These are used to connect a later sign-up with the referring campaign. You can block non-essential cookies in your browser, but blocking authentication storage can prevent sign-in and account features from working.
          </p>

          <Subheading>How we use information</Subheading>
          <ul className="list-disc space-y-2 pl-5">
            <li>Authenticate accounts, maintain sessions, and provide scans, results, history, APIs, monitoring, and email alerts.</li>
            <li>Retrieve public documents, detect document identity, compare monitoring snapshots, and generate source-grounded explanations and review guidance.</li>
            <li>Process subscriptions and credit purchases, calculate plan limits, prevent abuse, and reconcile usage.</li>
            <li>Secure, debug, measure, maintain, and improve the Service, including reliability and conversion measurement.</li>
            <li>Comply with law, enforce our Terms, respond to requests, and protect Themys, users, and third parties.</li>
          </ul>

          <Subheading>Service providers and international processing</Subheading>
          <p>
            We use processors and infrastructure providers to deliver the Service. They receive only the information needed for their role, but their own terms and privacy policies also apply. Processing may occur in Canada, the United States, or other countries in which a provider operates.
          </p>
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--legal-border, #263244)" }}>
            <table className="min-w-full border-collapse text-left text-sm">
              <caption className="sr-only">Themys service providers and processing purposes</caption>
              <thead style={{ background: "var(--legal-border, #263244)" }}>
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold text-inherit">Provider</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-inherit">Role</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-inherit">Examples of data</th>
                </tr>
              </thead>
              <tbody>
                <ProviderRow name="Clerk" purpose="Authentication and account management" data="Account email, name, account/session identifiers, and authentication metadata" />
                <ProviderRow name="Cloudflare D1" purpose="Relational database for user-owned application records" data="Profiles, scan findings, monitoring records, API-key metadata, usage events, and billing references" />
                <ProviderRow name="Cloudflare R2" purpose="Private object storage for raw extracted scan text" data="Raw document text addressed by an opaque server-side object key; objects are not publicly addressable" />
                <ProviderRow name="Cloudflare Workers and KV" purpose="Application hosting, request processing, caching, network security, and the private monitoring-email Worker" data="Requests, cached public-document text and analysis, alert email contents, recipient and sender addresses" />
                <ProviderRow name="Stripe" purpose="Checkout, subscriptions, credits, invoices, and payment processing" data="Email, customer/subscription/payment references, amounts, currency, and billing status; card data is handled by Stripe" />
                <ProviderRow name="TypeSafe AI" purpose="Clause detection and source-location judgments when configured and eligible for the scan" data="Segmented document text, configured questions and source options, plus request and usage metadata" />
                <ProviderRow name="OpenRouter and selected model providers" purpose="Structured extraction and fallback or custom-target analysis, restricted by the application to endpoints that advertise zero data retention" data="The document text and analysis instructions needed to return structured results, plus routing and usage metadata" />
                <ProviderRow name="Jina Reader" purpose="Public-page text extraction when configured" data="The submitted public URL; Jina fetches the page and returns its content" />
                <ProviderRow name="ToS;DR" purpose="Optional public reference data used to supplement a scan" data="The service domain or ToS;DR identifier; no Themys account data or submitted document text" />
                <ProviderRow name="Google favicon service" purpose="Display service icons in the web app and planned extension" data="The public service domain, IP address, and ordinary browser request information such as user agent" />
                <ProviderRow name="Sentry" purpose="Error and performance monitoring" data="Scrubbed error, route, timing, and stack information; request bodies, auth headers, emails, and user identifiers are removed before sending" />
              </tbody>
            </table>
          </div>

          <Subheading>AI and model-provider processing</Subheading>
          <p>
            When configured, Themys sends document text and typed questions to TypeSafe AI for clause detection and source-location judgments on scans without custom target clauses. OpenRouter is used for structured extraction and may also be used for clause analysis when TypeSafe is unavailable, fails validation, or the scan includes custom target clauses. Themys requests zero-data-retention (ZDR) routing for OpenRouter requests, limiting those requests to model-provider endpoints that advertise that they will not retain request content. This OpenRouter routing setting does not apply to TypeSafe AI. OpenRouter may still process account, routing, and usage metadata under its own policy, and its account-level logging settings are separate from downstream-provider routing. Provider terms, locations, and technical practices can change, so this is not a promise that every intermediary retains no metadata. Themys does not use your documents to train its own model. Do not submit confidential, sensitive, regulated, or third-party personal information unless you have authority and have assessed the provider terms and settings that apply to your request.
          </p>

          <Subheading>Retention, deletion, and caches</Subheading>
          <ul className="list-disc space-y-2 pl-5">
            <li>Account scan metadata, clauses, explanations, and structured extraction remain in Cloudflare D1 until the scan or account is deleted. Raw extracted text is kept in a private Cloudflare R2 object linked from the scan row. A scan deletion removes it from the user-facing history using the current soft-delete workflow; the underlying record may remain for operational cleanup.</li>
            <li>Monitoring subscriptions, snapshots, and alerts remain while the subscription is active. Removing a subscription or deleting the account cascades through those user-owned monitoring records.</li>
            <li>Public-page text cached in Cloudflare KV has a seven-day TTL, and cached scan analysis has a thirty-day TTL. The shared D1 explanation cache is reused only during its thirty-day validity period; an expired cache row can remain until operational cleanup. Account deletion purges current text and analysis cache keys derived from the account&apos;s saved scans. These content-addressed caches are not an account archive and may also be regenerated or remain independently when another request references the same public document.</li>
            <li>Usage, security, error, and payment records are retained for as long as reasonably necessary for accounting, fraud prevention, service security, dispute resolution, and legal obligations. Anonymous usage-event rows use a hashed actor value and are not a user-facing history.</li>
            <li>Deleting an account from Settings cancels an active Stripe subscription before removing the Clerk identity and user-owned application rows, including profiles, scans, monitoring data, API keys, usage logs, credits, and application invoice rows. Themys may retain purchase acknowledgements, billing cases, refunds, and dispute records without a linked account where needed for accounting, fraud prevention, or legal claims. Stripe and other independent providers may retain records under their own legal and operational retention policies.</li>
          </ul>

          <Subheading>Security and disclosures</Subheading>
          <p>
            We use access controls, server-side secrets, encrypted transport, server-side ownership predicates, request validation, rate limits, and redaction before error telemetry is sent. No online service is completely secure. We may disclose information to providers listed above, when required by law or legal process, to investigate abuse or protect rights and safety, in a business transfer, or at your direction. We do not sell personal information or share it for cross-context behavioural advertising.
          </p>

          <Subheading>Your choices and rights</Subheading>
          <p>
            You can review or delete scans, disable monitoring email notifications per document, cancel subscriptions, and delete your account from the available product settings. Subject to applicable law, you may ask us to access, correct, or delete personal information by emailing <a className="text-blue-400 underline underline-offset-4" href={`mailto:${mail}`}>{mail}</a> from your account email address. We may need to verify identity and may retain information required for legal, security, fraud-prevention, or accounting reasons. Canadian residents may have rights under PIPEDA and applicable provincial law; US residents may have additional state-law rights, including access, correction, deletion, and non-discrimination rights where applicable. We do not sell or share personal information as defined by California law. You may complain to the privacy regulator with jurisdiction over you.
          </p>

          <Subheading>Children and changes</Subheading>
          <p>
            The Service is not directed to children under 13, and we do not knowingly collect information from children under 13. We may update this policy when the Service, providers, or law changes. We will update the effective date and provide any notice required by law.
          </p>
        </Section>

        <Section id="terms" title="Terms of Service">
          <p>
            These Terms govern your use of Themys, themys.ca, its APIs, documentation, monitoring email service, and any future browser extension. The extension is coming soon and is not currently available. By using the Service, you agree to these Terms and the Privacy Policy. If you do not agree, do not use the Service.
          </p>

          <Subheading>The Service is not legal advice</Subheading>
          <p>
            Themys uses automated rules and artificial-intelligence systems to produce summaries, attention levels, extractions, comparisons, and flagged clauses. The output is informational review guidance only. It is not legal advice, a legal opinion, a risk determination, or a substitute for reading the original document or consulting a qualified lawyer. Automated output can be incomplete, outdated, or wrong. You are responsible for checking quoted text against the source and making your own decisions.
          </p>

          <Subheading>Accounts and permitted use</Subheading>
          <p>
            Provide accurate account information, protect your credentials and API keys, and promptly report unauthorized access. Use the Service lawfully and only with URLs, text, and data you are authorized to submit. Do not submit confidential or sensitive information unless you have assessed the risks; the Service is designed primarily for public-facing legal documents. Do not bypass authentication, rate or plan limits, or security controls; interfere with the Service; abuse public-page retrieval; reverse engineer or copy it except as permitted by law; or resell or share access without written permission. We may suspend or terminate access to protect the Service, users, or third parties, or for a breach of these Terms.
          </p>

          <Subheading>Your content and AI processing</Subheading>
          <p>
            You retain rights you hold in submitted content. You grant Themys a limited, non-exclusive right to host, copy, transmit, retrieve, transform, and process it only to provide, secure, measure, and improve the Service and to send requested monitoring alerts. This includes sending document text and instructions to the third-party processors described in the Privacy Policy. You are responsible for having the rights and permissions needed for any URL or text you submit and for activity under your account or API key.
          </p>

          <Subheading>Monitoring and notifications</Subheading>
          <p>
            Monitoring checks public URLs on the frequency shown in the product. A change may create an in-app alert and, for eligible plans with notifications enabled, an email. Retrieval failures, source changes, model failures, provider outages, filtering, and delivery delays can prevent or delay an alert. Email notifications can be disabled per monitored document, and the alert email links back to the Monitoring page; the Service is not an emergency or legal-notice system.
          </p>

          <Subheading>Payments, cancellation, and credits</Subheading>
          <p>
            Prices, billing intervals, taxes, renewal, and applicable cancellation terms are shown before checkout. Stripe processes payments. Recurring subscriptions renew unless cancelled before the next billing period; cancellation in Settings normally takes effect at the end of the current paid period. Credit packs expire one year after purchase. The <a className="text-blue-400 underline underline-offset-4" href="#refunds">Refund Policy</a> explains when to request a refund and how unused credits are handled. Deleting an account does not replace cancellation; the account workflow attempts to stop billing before removing the account.
          </p>

          <Subheading>Ownership, availability, and liability</Subheading>
          <p>
            Themys and its licensors own the Service, software, design, documentation, and branding. Subject to these Terms, you receive a limited, revocable, non-transferable right to use the Service for its intended purpose. The Service is provided “as is” and “as available” to the fullest extent permitted by law. We do not guarantee uninterrupted, secure, error-free, accurate, complete, or continuously available Service or analysis. To the fullest extent permitted by law, Themys is not liable for indirect, incidental, special, consequential, punitive, or reliance losses arising from the Service. Nothing in these Terms excludes liability or consumer rights that cannot legally be excluded.
          </p>

          <Subheading>Changes, termination, and contact</Subheading>
          <p>
            We may change the Service or these Terms when reasonably necessary. We will post the updated effective date and provide additional notice for material changes where required. You may stop using the Service and request deletion at any time. Sections that by their nature should survive termination, including ownership, disclaimers, payment obligations, limitations, and dispute-related terms, survive. Questions about these Terms or the Privacy Policy: <a className="text-blue-400 underline underline-offset-4" href={`mailto:${mail}`}>{mail}</a>.
          </p>
        </Section>
        <Section id="refunds" title="Refund Policy">
          <p>Effective September 22, 2026. This policy applies to Themys subscriptions and prepaid credit packs. It does not limit any cancellation, refund, chargeback, or other remedy required by applicable law.</p>
          <Subheading>First subscription purchase</Subheading>
          <p>You may request a refund of your first subscription payment within 14 calendar days after purchase. We normally approve requests where the paid service has not been materially used: no more than two completed paid reviews, no report export, and no paid monitoring email delivered. Usage beyond those examples receives a manual review; it does not automatically end your rights under law.</p>
          <Subheading>Renewals and cancellation</Subheading>
          <p>You may request a refund of a subscription renewal within seven calendar days if you have not used paid-plan features after that renewal. Canceling your subscription stops future renewals and normally leaves your paid access in place until the current period ends. Cancellation alone does not refund the current period. You can manage billing and cancel from <a className="text-blue-400 underline underline-offset-4" href="https://themys.ca/settings#subscription">Settings</a>.</p>
          <Subheading>Credit packs</Subheading>
          <p>You may request a refund of an unused credit pack within 14 calendar days after purchase. When a request opens, we may temporarily hold remaining credits from that pack while reviewing it. If any purchased credit has been used, we review the circumstances manually; a full refund is not automatic. A successful full refund removes the unused credits from your account.</p>
          <Subheading>Billing errors and service failures</Subheading>
          <p>Duplicate charges, confirmed billing errors, and a material failure to provide the purchased service remain eligible for correction or refund even outside the goodwill windows above, subject to verification and applicable law. We may offer a partial refund or another reasonable correction when appropriate.</p>
          <Subheading>How to request and receive a refund</Subheading>
          <p>Sign in, open <a className="text-blue-400 underline underline-offset-4" href="https://themys.ca/settings#payments">Settings → Payments</a>, choose the transaction, and submit a billing request. If you cannot sign in or the payment is not listed, email <a className="text-blue-400 underline underline-offset-4" href={`mailto:${mail}`}>{mail}</a> from your account email with the charge date and reason. Do not send a card number. We aim to acknowledge requests within one business day and decide within five business days after receiving the information needed to review them. Approved refunds go to the original payment method through Stripe; the timing of the credit depends on the payment method and financial institution. We will tell you if Stripe reports a failed refund.</p>
          <Subheading>Disputed or unrecognized charges</Subheading>
          <p>For an unrecognized charge, use the same billing request form or email us promptly. If your card or account may be compromised, contact your financial institution as well. When a bank dispute is already open, we handle it through the card network process and avoid issuing a separate refund without checking for duplicate reimbursement.</p>
        </Section>
      </div>
    </article>
  );
}
