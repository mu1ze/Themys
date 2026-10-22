import "server-only"

import Stripe from "stripe"

import { getRuntimeEnvironment } from "@/lib/runtime-env"

const STRIPE_PRICE_VARIABLES = [
  "STRIPE_PRICE_BASE_MONTHLY",
  "STRIPE_PRICE_BASE_ANNUAL",
  "STRIPE_PRICE_ADVANCED_MONTHLY",
  "STRIPE_PRICE_ADVANCED_ANNUAL",
  "STRIPE_PRICE_CREDITS_10",
  "STRIPE_PRICE_CREDITS_50",
  "STRIPE_PRICE_CREDITS_200",
] as const

type StripePriceVariable = (typeof STRIPE_PRICE_VARIABLES)[number]

export type StripePrices = {
  baseMonthly: string
  baseAnnual: string
  advancedMonthly: string
  advancedAnnual: string
  credits10: string
  credits50: string
  credits200: string
}

let stripeInstance: Stripe | null = null

function getRequiredEnvironmentValue(name: string): string {
  const value = getRuntimeEnvironment()[name]
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Stripe is not configured: missing ${name}`)
  }
  return value
}

export function getStripePrices(): StripePrices {
  const values = Object.fromEntries(
    STRIPE_PRICE_VARIABLES.map((name) => [name, getRequiredEnvironmentValue(name)]),
  ) as Record<StripePriceVariable, string>

  return {
    baseMonthly: values.STRIPE_PRICE_BASE_MONTHLY,
    baseAnnual: values.STRIPE_PRICE_BASE_ANNUAL,
    advancedMonthly: values.STRIPE_PRICE_ADVANCED_MONTHLY,
    advancedAnnual: values.STRIPE_PRICE_ADVANCED_ANNUAL,
    credits10: values.STRIPE_PRICE_CREDITS_10,
    credits50: values.STRIPE_PRICE_CREDITS_50,
    credits200: values.STRIPE_PRICE_CREDITS_200,
  }
}

export function getStripe(): Stripe {
  if (stripeInstance) return stripeInstance

  stripeInstance = new Stripe(getRequiredEnvironmentValue("STRIPE_SECRET_KEY"), {
    apiVersion: "2026-05-27.dahlia",
    // The default Stripe client selected by the Node entry point uses Node's
    // HTTP stack. This app runs in a Cloudflare Worker, where that stack can
    // stall even though the native Worker fetch succeeds. Force Stripe to use
    // the native fetch implementation for every API request.
    httpClient: Stripe.createFetchHttpClient(),
    // Give a genuine Stripe outage enough time to respond, while still keeping
    // a checkout click bounded. The native Fetch client normally returns far
    // sooner than this.
    timeout: 20_000,
    maxNetworkRetries: 0,
  })

  return stripeInstance
}

export function isCreditPack(priceId: string, prices = getStripePrices()): boolean {
  return [prices.credits10, prices.credits50, prices.credits200].includes(priceId)
}
