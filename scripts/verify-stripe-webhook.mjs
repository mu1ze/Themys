import Stripe from "stripe"

const requiredEvents = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "refund.created",
  "refund.updated",
  "refund.failed",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
  "charge.dispute.funds_withdrawn",
  "charge.dispute.funds_reinstated",
])

const apiKey = process.env.STRIPE_SECRET_KEY
if (!apiKey) {
  throw new Error("STRIPE_SECRET_KEY is required to verify the Stripe webhook")
}

// This verifies the deployed endpoint, not whichever local development origin
// happens to be present in .env. Preview/staging deployments can override it.
const webhookUrl = process.env.STRIPE_WEBHOOK_URL ?? "https://themys.ca/api/webhooks/stripe"
const parsedWebhookUrl = new URL(webhookUrl)
if (parsedWebhookUrl.protocol !== "https:") {
  throw new Error("STRIPE_WEBHOOK_URL must use HTTPS")
}
const stripe = new Stripe(apiKey)
const endpoints = await stripe.webhookEndpoints.list({ limit: 100 })
const endpoint = endpoints.data.find((candidate) => candidate.url === webhookUrl)

if (!endpoint) {
  throw new Error(`No Stripe webhook endpoint is configured for ${webhookUrl}`)
}
if (endpoint.status !== "enabled") {
  throw new Error(`Stripe webhook endpoint is ${endpoint.status}, not enabled`)
}

const configuredEvents = new Set(endpoint.enabled_events)
const missingEvents = [...requiredEvents].filter((event) => !configuredEvents.has(event))
if (missingEvents.length > 0) {
  throw new Error(`Stripe webhook endpoint is missing required events: ${missingEvents.join(", ")}`)
}

console.log(`Stripe ${endpoint.livemode ? "live" : "test"} webhook verified: ${webhookUrl}`)
