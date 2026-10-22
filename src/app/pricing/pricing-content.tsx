"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { CheckCircle2, Coins } from "lucide-react"

import { createCheckoutSession } from "@/app/actions/checkout"
import { TrustBadges } from "@/components/trust-badges"
import { trackEvent } from "@/lib/track"
import { PLAN_DISPLAY_NAME, PLAN_ENTITLEMENTS } from "@/lib/entitlements"

const freeFeatures = [
  `${PLAN_ENTITLEMENTS.free.monthlyReviews} reviews per month`,
  `${PLAN_ENTITLEMENTS.free.monitorLimit} watched service`,
  "Dashboard monitoring alerts",
  "1 contract review trial",
]

const baseFeatures = [
  `${PLAN_ENTITLEMENTS.base.monthlyReviews} reviews per month`,
  `${PLAN_ENTITLEMENTS.base.monitorLimit} watched services`,
  "Email change alerts",
  "Export reports (PDF)",
]

const advancedFeatures = [
  `${PLAN_ENTITLEMENTS.advanced.monthlyReviews} reviews per month`,
  `${PLAN_ENTITLEMENTS.advanced.monitorLimit} watched services`,
  "Email alerts and PDF export",
  "Paste and PDF upload",
  "Playbooks",
]

const prices = {
  baseMonthly: "$2.49",
  baseAnnual: "$2.08",
  advancedMonthly: "$4.99",
  advancedAnnual: "$4.16",
}

function FeatureRow({
  children,
  white = false,
}: {
  children: string
  white?: boolean
}) {
  return (
    <li className="flex items-start gap-2.5">
      <CheckCircle2
        className={
          white
            ? "mt-0.5 h-4 w-4 shrink-0 text-[var(--ds-sienna)]"
            : "mt-0.5 h-4 w-4 shrink-0 text-[var(--ds-text)]"
        }
        strokeWidth={2}
      />
      <span
        className={
          white
            ? "text-[15px] leading-6 text-[var(--ds-sienna)]"
            : "text-[15px] leading-6 text-[var(--ds-text-secondary)]"
        }
      >
        {children}
      </span>
    </li>
  )
}

export type PricingPriceIds = {
  baseMonthly: string
  baseAnnual: string
  advancedMonthly: string
  advancedAnnual: string
  credits10: string
  credits50: string
  credits200: string
}

export function PricingContent({
  priceIds,
}: {
  priceIds: PricingPriceIds | null
}) {
  const [isAnnual, setIsAnnual] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [acceptedPolicies, setAcceptedPolicies] = useState(false)
  const [, startTransition] = useTransition()

  useEffect(() => {
    trackEvent("pricing_view", { billing: isAnnual ? "annual" : "monthly" })
    // Track the initial pricing-page view once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleCheckout(priceId: string | null, key: string) {
    if (!priceId) {
      setCheckoutError("Billing is temporarily unavailable. Please try again later.")
      return
    }

    setLoading(key)
    setCheckoutError(null)
    startTransition(async () => {
      try {
        const result = await createCheckoutSession(priceId, acceptedPolicies)
        if (!result.ok) {
          throw new Error(result.error)
        }

        trackEvent("checkout_start", { plan: key, billing: isAnnual ? "annual" : "monthly" })
        window.location.assign(result.url)
      } catch (error) {
        console.error("Unable to start Stripe checkout", error)
        setCheckoutError(
          error instanceof Error && error.message
            ? error.message
            : "Checkout is temporarily unavailable. Please try again shortly.",
        )
      } finally {
        setLoading(null)
      }
    })
  }

  const creditPacks = [
    { size: "10 credits", price: "$1.99", priceId: priceIds?.credits10 ?? null },
    { size: "50 credits", price: "$7.99", priceId: priceIds?.credits50 ?? null },
    { size: "200 credits", price: "$24.99", priceId: priceIds?.credits200 ?? null },
  ]

  const billingReady = priceIds !== null

  return (
    <>
      <label className="mx-auto mb-7 flex max-w-[720px] items-start gap-3 rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)] p-4 text-sm leading-6 text-[var(--ds-text-secondary)]">
        <input type="checkbox" checked={acceptedPolicies} onChange={(event) => setAcceptedPolicies(event.target.checked)} className="mt-1 size-4" />
        <span>I understand that subscriptions renew until canceled, cancellation normally takes effect at the end of the paid period, and credit packs expire after one year. I have reviewed the <a className="underline" href="https://docs.themys.ca/legal#terms" target="_blank" rel="noreferrer">Terms</a>, <a className="underline" href="https://docs.themys.ca/legal#privacy" target="_blank" rel="noreferrer">Privacy Policy</a>, and <a className="underline" href="https://docs.themys.ca/legal#refunds" target="_blank" rel="noreferrer">Refund Policy</a>.</span>
      </label>
      <div className="flex items-center justify-center gap-3">
        <span
          className={`text-sm font-medium ${!isAnnual ? "text-foreground" : "text-[var(--ds-text-dim)]"}`}
        >
          Monthly
        </span>
        <button
          onClick={() => setIsAnnual(!isAnnual)}
          type="button"
          className="relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full bg-primary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          role="switch"
          aria-checked={isAnnual}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-[var(--ds-card)] shadow-lg ring-0 transition-transform duration-200 ${
              isAnnual ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
        <span
          className={`text-sm font-medium ${isAnnual ? "text-foreground" : "text-[var(--ds-text-dim)]"}`}
        >
          Annual
        </span>
        {isAnnual && (
          <span className="rounded-full bg-[var(--ds-peach)] px-2.5 py-0.5 text-[15px] font-medium text-[var(--ds-sienna)]">
            Save 17%
          </span>
        )}
      </div>

      {!billingReady && (
        <div className="mx-auto mt-6 max-w-[1120px] rounded-[20px] bg-[var(--ds-peach)] px-4 py-3 text-[15px] text-[var(--ds-sienna)]">
          Billing is temporarily unavailable. The pricing page is still readable,
          but checkout is disabled until the Stripe runtime config is restored.
        </div>
      )}

      <section className="mx-auto mt-12 grid max-w-[1120px] gap-px bg-[var(--ds-border)] md:grid-cols-2 lg:grid-cols-3">
        <article className="relative flex h-full flex-col bg-[var(--ds-peach)] p-6 md:p-8">
          <p className="text-[15px] font-medium uppercase tracking-[0.12em] text-[var(--ds-sienna)]">
            Most popular
          </p>
          <div className="mt-3 space-y-2">
            <h2 className="text-[20px] font-medium leading-tight text-[var(--ds-sienna)]">
              {PLAN_DISPLAY_NAME.advanced}
            </h2>
            <div className="flex items-baseline gap-1">
              <span className="text-[36px] font-medium leading-none text-[var(--ds-sienna)]">
                {isAnnual ? prices.advancedAnnual : prices.advancedMonthly}
              </span>
              <span className="text-[15px] text-[var(--ds-sienna)]/80">/month</span>
            </div>
            {isAnnual && (
              <p className="text-[15px] font-medium text-[var(--ds-sienna)]">
                Billed annually
              </p>
            )}
          </div>

          <ul className="mt-6 space-y-4">
            {advancedFeatures.map((feature) => (
              <FeatureRow key={feature} white>
                {feature}
              </FeatureRow>
            ))}
          </ul>

          <button
            onClick={() =>
              handleCheckout(isAnnual ? priceIds?.advancedAnnual ?? null : priceIds?.advancedMonthly ?? null, "advanced")
            }
            disabled={loading === "advanced" || !billingReady}
            className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-full bg-[var(--ds-sienna)] px-5 text-[16px] text-[var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-50"
          >
            {loading === "advanced" ? "Loading..." : "Choose Founder"}
          </button>
        </article>

        <article className="flex h-full flex-col bg-[var(--ds-bg)] p-6 md:p-8">
          <div className="space-y-2">
            <h2 className="text-[20px] font-medium leading-tight text-[var(--ds-text)]">
              {PLAN_DISPLAY_NAME.base}
            </h2>
            <div className="flex items-baseline gap-1">
              <span className="text-[36px] font-medium leading-none text-[var(--ds-text)]">
                {isAnnual ? prices.baseAnnual : prices.baseMonthly}
              </span>
              <span className="text-[15px] text-[var(--ds-text-secondary)]">/month</span>
            </div>
            {isAnnual && (
              <p className="text-[15px] font-medium text-[var(--ds-text-secondary)]">
                Billed annually
              </p>
            )}
            <p className="text-[15px] text-[var(--ds-text-secondary)]">
              Best for watching apps you already use
            </p>
          </div>

          <ul className="mt-6 space-y-4">
            {baseFeatures.map((feature) => (
              <FeatureRow key={feature}>{feature}</FeatureRow>
            ))}
          </ul>

          <button
            onClick={() =>
              handleCheckout(isAnnual ? priceIds?.baseAnnual ?? null : priceIds?.baseMonthly ?? null, "base")
            }
            disabled={loading === "base" || !billingReady}
            className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-full bg-[var(--ds-accent)] px-5 text-[16px] text-[var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-50"
          >
            {loading === "base"
              ? "Loading..."
              : "Choose Personal"}
          </button>
        </article>

        <article className="flex h-full flex-col bg-[var(--ds-bg)] p-6 md:p-8">
          <div className="space-y-2">
            <h2 className="text-[20px] font-medium leading-tight text-[var(--ds-text)]">
              Free
            </h2>
            <div className="flex items-baseline gap-1">
              <span className="text-[36px] font-medium leading-none text-[var(--ds-text)]">
                $0
              </span>
              <span className="text-sm text-[var(--ds-text-secondary)]">/month</span>
            </div>
          </div>

          <ul className="mt-6 space-y-4">
            {freeFeatures.map((feature) => (
              <FeatureRow key={feature}>{feature}</FeatureRow>
            ))}
          </ul>

          <Link
            href="/sign-up"
            className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-full border border-[var(--ds-text)] px-5 text-[16px] text-[var(--ds-text)] transition hover:bg-[var(--ds-card-hover)]"
          >
            Get Started Free
          </Link>
        </article>
      </section>

      {checkoutError && (
        <p className="mx-auto mt-4 max-w-[1120px] text-center text-sm text-red-700" role="alert">
          {checkoutError}
        </p>
      )}

      <section id="credits" className="mx-auto mt-12 max-w-[1120px]">
        <div className="text-center">
          <h2 className="text-[28px] font-bold leading-tight text-foreground">
            Add-on Credits
          </h2>
          <p className="mt-3 text-[16px] leading-6 text-[var(--ds-text-secondary)]">
            Need more scans or AI explanations? Purchase credits anytime.
          </p>
        </div>

        <div className="mt-8 grid border-y border-[var(--ds-border)] sm:grid-cols-2 lg:grid-cols-3 lg:divide-x lg:divide-[var(--ds-border)]">
          {creditPacks.map((pack) => (
            <div
              key={pack.size}
              className="flex flex-col border-b border-[var(--ds-border)] p-6 last:border-b-0 lg:border-b-0"
            >
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-primary" />
                <span className="text-lg font-bold text-foreground">
                  {pack.size}
                </span>
              </div>
              <div className="mt-4">
                <span className="text-4xl font-bold text-foreground">
                  {pack.price}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--ds-text-secondary)]">
                Extra scans or AI explanations beyond your plan limit. Credits expire 12 months after purchase.
              </p>
              <button
                onClick={() =>
                  handleCheckout(pack.priceId, `credit-${pack.size}`)
                }
                disabled={loading === `credit-${pack.size}` || !billingReady}
                className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full border border-primary px-5 text-sm font-medium text-primary transition hover:bg-[var(--ds-info-bg)] disabled:opacity-50"
              >
                {loading === `credit-${pack.size}`
                  ? "Loading..."
                  : `Buy ${pack.size}`}
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="mx-auto mt-12 max-w-[1120px]">
        <TrustBadges />
      </div>
    </>
  )
}
