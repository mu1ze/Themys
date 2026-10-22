import type { Metadata } from "next"
import { ChevronDown } from "lucide-react"

import { getStripePrices } from "@/lib/stripe"
import { SiteFooter } from "@/components/site-footer"
import { PricingContent } from "./pricing-content"

// Pricing reads runtime Stripe configuration, so keep the page out of the
// build-time prerender phase.
export const dynamic = "force-dynamic"

const faqItems = [
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes, absolutely. You can cancel your subscription at any time through your account settings. If you cancel, you will maintain access to your plan features until the end of your current billing period.",
  },
  {
    question: "What counts as a scan?",
    answer:
      "Each successful analysis from the web app, API, or batch API counts as one scan.",
  },
  {
    question: "Is my data private?",
    answer:
      "We do not sell personal information. Themys processes account, billing, operational, and document data through the providers described in the Privacy Policy, including authentication, database, payment, retrieval, AI, email, and error-monitoring providers. Review the Privacy Policy before submitting confidential or sensitive content.",
  },
  {
    question: "Can I request a refund?",
    answer: "Yes. First subscription payments with limited use can be requested within 14 days; unused renewals within seven days; unused credit packs within 14 days. Billing errors and service failures are reviewed separately. See the Refund Policy and request help from Settings → Payments.",
  },
]

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, transparent pricing for Themys. Start free and upgrade when you need more scans or deeper analysis.",
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "Pricing | Themys",
    description: "Simple, transparent pricing for Themys. Start free and upgrade when you need more scans or deeper analysis.",
    images: [
      {
        url: "/themys-pricing-og.png",
        width: 1200,
        height: 630,
        alt: "Themys pricing — Simple, transparent pricing",
      },
    ],
  },
  twitter: {
    title: "Pricing | Themys",
    description: "Simple, transparent pricing for Themys. Start free and upgrade when you need more scans.",
    images: [
      {
        url: "/themys-pricing-og.png",
        alt: "Themys pricing — Simple, transparent pricing",
      },
    ],
  },
}

type PricingPageData = {
  priceIds: Awaited<ReturnType<typeof getStripePrices>> | null
}

async function loadPricingPageData(): Promise<PricingPageData> {
  const priceResult = await Promise.resolve().then(() => getStripePrices()).then(
    (priceIds) => ({ status: "fulfilled" as const, value: priceIds }),
    (reason) => ({ status: "rejected" as const, reason }),
  )

  if (priceResult.status === "rejected") {
    console.error(
      "[pricing] failed to load Stripe prices",
      priceResult.reason instanceof Error ? priceResult.reason.name : "UnknownError",
    )
  }

  return {
    priceIds: priceResult.status === "fulfilled" ? priceResult.value : null,
  }
}

function FaqItem({
  question,
  answer,
}: {
  question: string
  answer: string
}) {
  return (
    <details className="group border-b border-[var(--ds-border)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 text-left">
        <span className="text-sm font-semibold text-foreground">{question}</span>
        <ChevronDown
          className="h-5 w-5 shrink-0 text-[var(--ds-text-muted)] transition-transform duration-300 group-open:rotate-180"
          strokeWidth={2}
        />
      </summary>
      <div className="px-6 pb-6 pt-0 text-sm leading-6 text-[var(--ds-text-secondary)]">
        {answer}
      </div>
    </details>
  )
}

export default async function PricingPage() {
  const { priceIds } = await loadPricingPageData()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="mx-auto w-full max-w-[1200px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <header className="mx-auto max-w-3xl text-center">
          <h1 className="text-[32px] font-medium leading-[1.2] tracking-[-0.04em] text-foreground sm:text-[36px]">
            Simple, transparent pricing
          </h1>
          <p className="mt-3 text-[16px] leading-6 text-[var(--ds-text-secondary)]">
            Start free. Upgrade when you need more.
          </p>
        </header>

        <div className="mt-6">
          <PricingContent priceIds={priceIds} />
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm leading-6 text-[var(--ds-text-secondary)]">
            All plans include web-app scanning and cloud sync.
          </p>
          <p className="mt-2 text-xs leading-5 text-[var(--ds-text-muted)]">
            See the <a className="underline underline-offset-2 hover:text-foreground" href="https://docs.themys.ca/legal#terms">Terms</a>, <a className="underline underline-offset-2 hover:text-foreground" href="https://docs.themys.ca/legal#privacy">Privacy Policy</a>, and <a className="underline underline-offset-2 hover:text-foreground" href="https://docs.themys.ca/legal#refunds">Refund Policy</a> before checkout.
          </p>
        </div>

        <section className="mx-auto mt-14 max-w-3xl">
          <h2 className="text-center text-[28px] font-medium tracking-[-0.03em] leading-tight text-foreground">
            Frequently Asked Questions
          </h2>

          <div className="mt-8 border-t border-[var(--ds-border)]">
            {faqItems.map((item) => (
              <FaqItem key={item.question} question={item.question} answer={item.answer} />
            ))}
          </div>
        </section>
      </section>

      <SiteFooter />
    </div>
  )
}
