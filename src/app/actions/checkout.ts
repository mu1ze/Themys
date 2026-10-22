"use server"

import { currentUser } from "@clerk/nextjs/server"

import { getStripe, getStripePrices, isCreditPack } from "@/lib/stripe"
import { getUserProfileByClerkId } from "@/lib/persistence"
import { getAppOrigin } from "@/lib/app-origin"
import { getDatabaseBinding } from "@/lib/database"
import { BILLING_POLICY } from "@/lib/billing-policy"

type CheckoutSessionResult =
  | { ok: true; url: string }
  | { ok: false; error: string }

export async function createCheckoutSession(priceId: string, acceptedPolicies: boolean): Promise<CheckoutSessionResult> {
  try {
    const user = await currentUser()
    if (!user?.id) {
      return { ok: false, error: "Please sign in before starting checkout." }
    }
    if (acceptedPolicies !== true) {
      return { ok: false, error: "Please review and acknowledge the purchase and refund terms." }
    }

    const prices = getStripePrices()
    if (!Object.values(prices).includes(priceId)) {
      return { ok: false, error: "Invalid price ID." }
    }

    const email =
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses[0]?.emailAddress

    if (!email) {
      return { ok: false, error: "User email not found." }
    }

    const stripe = getStripe()
    const appUrl = getAppOrigin()

    // Checkout must not depend on a profile write succeeding first. Stripe can
    // create a customer from the verified Clerk email, and the webhook will
    // persist the subscription/customer mapping after payment.
    const profile = await getUserProfileByClerkId(user.id)
    const isCredit = isCreditPack(priceId, prices)
    if (!isCredit && profile && profile.plan !== "free" && !profile.stripeCustomerId) {
      return { ok: false, error: "Your billing account needs review before starting another subscription. Contact support." }
    }

    if (!isCredit && profile?.stripeCustomerId) {
      const existing = await stripe.subscriptions.list({
        customer: profile.stripeCustomerId,
        status: "all",
        limit: 100,
      })
      if (existing.data.some((subscription) =>
        ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"].includes(subscription.status)
      )) {
        const portal = await stripe.billingPortal.sessions.create({
          customer: profile.stripeCustomerId,
          return_url: `${appUrl}/settings#subscription`,
        })
        return { ok: true, url: portal.url }
      }
    }

    const sessionParams: Record<string, unknown> = {
      line_items: [{ price: priceId, quantity: 1 }],
      mode: isCredit ? "payment" : "subscription",
      // USD remains the Price default; an explicit CAD Price option takes
      // precedence for Canada, while Adaptive Pricing covers other currencies.
      adaptive_pricing: { enabled: true },
      // A first checkout has no database-to-Stripe customer mapping yet.
      // Stripe returns this stable, non-PII reference in every Checkout event.
      client_reference_id: user.id,
      success_url: `${appUrl}/pricing/success`,
      cancel_url: `${appUrl}/pricing/cancel`,
      metadata: {
        userId: user.id,
        priceId,
        termsVersion: BILLING_POLICY.termsVersion,
        privacyVersion: BILLING_POLICY.privacyVersion,
        refundVersion: BILLING_POLICY.refundVersion,
        acknowledgementVersion: BILLING_POLICY.acknowledgementVersion,
      },
    }

    if (profile?.stripeCustomerId) {
      sessionParams.customer = profile.stripeCustomerId
    } else {
      sessionParams.customer_email = email
    }

    const session = await stripe.checkout.sessions.create(sessionParams as Parameters<typeof stripe.checkout.sessions.create>[0])

    if (!session.url) {
      return { ok: false, error: "Failed to create checkout session." }
    }

    const productLabel = priceId === prices.baseMonthly ? "Personal monthly subscription" :
      priceId === prices.baseAnnual ? "Personal annual subscription" :
      priceId === prices.advancedMonthly ? "Founder monthly subscription" :
      priceId === prices.advancedAnnual ? "Founder annual subscription" :
      priceId === prices.credits10 ? "10 credits" :
      priceId === prices.credits50 ? "50 credits" : "200 credits"
    const amountLabel = session.amount_total != null && session.currency
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: session.currency.toUpperCase() }).format(session.amount_total / 100)
      : "the amount shown at checkout"
    const commercialTerms = isCredit
      ? `${productLabel}; quoted amount ${amountLabel}, final total shown in Stripe Checkout. One-time purchase. Credits expire one year after purchase. Unused packs may be requested for refund within 14 calendar days; used packs receive manual review.`
      : `${productLabel}; quoted amount ${amountLabel}, final total shown in Stripe Checkout. Renews at the displayed interval until canceled before the next billing period. Cancellation normally takes effect at period end. A first payment with limited paid use may be requested for refund within 14 calendar days; an unused renewal within seven calendar days.`

    // A checkout URL is returned only after its exact policy revision is
    // durable. Expire an orphan session if the local ledger is unavailable.
    try {
      const binding = getDatabaseBinding()
      await binding.prepare(`INSERT INTO purchase_acceptances
        (stripe_session_id, user_id, clerk_id, stripe_customer_id, price_id, product_kind,
         amount_minor, currency, terms_version, privacy_version, refund_version,
         acknowledgement_version, commercial_terms, status, livemode, accepted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`)
        .bind(session.id, profile?.id ?? null, user.id, profile?.stripeCustomerId ?? null,
          priceId, isCredit ? "credit_pack" : "subscription", session.amount_total ?? null,
          session.currency ?? null, BILLING_POLICY.termsVersion, BILLING_POLICY.privacyVersion,
          BILLING_POLICY.refundVersion, BILLING_POLICY.acknowledgementVersion, commercialTerms,
          session.livemode ? 1 : 0, new Date().toISOString()).run()
    } catch (recordError) {
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined)
      throw recordError
    }

    return { ok: true, url: session.url }
  } catch (error) {
    console.error(
      "[checkout] failed to create checkout session",
      error instanceof Error ? error.name : "UnknownError",
    )
    return {
      ok: false,
      error: "Checkout is temporarily unavailable.",
    }
  }
}
