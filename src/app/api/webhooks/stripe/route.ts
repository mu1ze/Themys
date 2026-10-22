import { headers } from "next/headers"
import { NextResponse } from "next/server"
import type Stripe from "stripe"

import { getStripe, getStripePrices, isCreditPack } from "@/lib/stripe"
import { getDatabase, getDatabaseBinding } from "@/lib/database"
import { insertInvoice } from "@/lib/persistence"
import { readRequestText, RequestBodyTooLargeError } from "@/lib/request-body"
import { getRuntimeEnvironment } from "@/lib/runtime-env"
import { recordStripeRefund, recordStripeDispute } from "@/lib/billing-operations"
import { queueBillingNotification } from "@/lib/billing-notifications"

// Stripe webhook payloads are small (<100KB in practice). Cap the buffered
// body before signature verification so oversized posts cannot exhaust memory.
const MAX_WEBHOOK_BYTES = 1024 * 1024

type WebhookUser = { id: string; clerk_id: string }

function errorKind(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError"
}

function getSessionCustomerId(session: Stripe.Checkout.Session): string | null {
  if (!session.customer) return null
  return typeof session.customer === "string" ? session.customer : session.customer.id
}

function getCheckoutEmail(session: Stripe.Checkout.Session): string | null {
  return session.customer_details?.email ?? session.customer_email ?? null
}

async function ensureCheckoutUser(clerkId: string, email: string | null): Promise<WebhookUser> {
  const database = getDatabase()
  const lookup = await database
    .from("users")
    .select("id, clerk_id")
    .eq("clerk_id", clerkId)
    .maybeSingle()
  if (lookup.error) throw lookup.error
  if (lookup.data) return lookup.data as unknown as WebhookUser
  if (!email) throw new Error("Checkout customer email is missing and no user profile exists")

  const inserted = await database
    .from("users")
    .insert({ clerk_id: clerkId, email })
    .select("id, clerk_id")
    .single()
  if (!inserted.error && inserted.data) return inserted.data as unknown as WebhookUser

  // A concurrent webhook may have created the row first. Re-read it without
  // ever replacing the trusted email already stored for an existing account.
  const retry = await database
    .from("users")
    .select("id, clerk_id")
    .eq("clerk_id", clerkId)
    .maybeSingle()
  if (retry.error) throw retry.error
  if (retry.data) return retry.data as unknown as WebhookUser
  throw inserted.error ?? new Error("Checkout user could not be created")
}

async function getUserByStripeCustomerId(customerId: string, subscriptionId?: string | null) {
  const database = getDatabase()

  const { data: byCustomer, error: customerErr } = await database
    .from("users")
    .select("id, clerk_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle()

  if (customerErr) {
    console.error("[stripe webhook] Customer lookup failed", errorKind(customerErr))
  }

  if (byCustomer) return byCustomer

  if (subscriptionId) {
    const { data: bySub, error: subErr } = await database
      .from("users")
      .select("id, clerk_id")
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle()

    if (subErr) {
      console.error("[stripe webhook] Subscription lookup failed", errorKind(subErr))
    }

    return bySub
  }

  return null
}

function mapPlanFromPriceId(priceId: string): "base" | "advanced" | null {
  const prices = getStripePrices()

  const priceToPlan: Record<string, "base" | "advanced"> = {}
  priceToPlan[prices.baseMonthly] = "base"
  priceToPlan[prices.baseAnnual] = "base"
  priceToPlan[prices.advancedMonthly] = "advanced"
  priceToPlan[prices.advancedAnnual] = "advanced"

  return priceToPlan[priceId] ?? null
}

function mapSubscriptionStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case "active":
    case "trialing":
      return "active"
    case "past_due":
      return "past_due"
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "canceled"
    default:
      return status
  }
}

async function updateUserByDatabaseId(userId: string, updates: Record<string, unknown>) {
  const database = getDatabase()
  const { data, error } = await database
    .from("users")
    .update(updates)
    .eq("id", userId)
    .select("id")
    .maybeSingle()
  if (error) {
    console.error("[stripe webhook] User update failed", errorKind(error))
    throw error
  }
  if (!data) throw new Error(`Stripe webhook user ${userId} was not found`)
}

async function updateClerkTier(clerkId: string, tier: string) {
  try {
    const { clerkClient } = await import("@clerk/nextjs/server")
    const client = await clerkClient()
    await client.users.updateUserMetadata(clerkId, {
      publicMetadata: { tier },
    })
  } catch (err) {
    console.warn("[stripe webhook] Clerk tier update failed", errorKind(err))
  }
}

async function getClerkIdByUserId(userId: string): Promise<string | null> {
  const database = getDatabase()
  const { data } = await database
    .from("users")
    .select("clerk_id")
    .eq("id", userId)
    .maybeSingle()
  return data?.clerk_id ?? null
}

function getPriceIdFromSubscription(subscription: Stripe.Subscription): string | null {
  const firstItem = subscription.items?.data?.[0]
  if (!firstItem) return null
  const price = firstItem.price
  if (!price) return null
  return typeof price === "string" ? price : price.id
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id

  const user = await getUserByStripeCustomerId(customerId, subscription.id)
  if (!user) {
    console.warn("[stripe webhook] No user found for subscription event")
    return
  }

  const priceId = getPriceIdFromSubscription(subscription)
  const plan = priceId ? mapPlanFromPriceId(priceId) : null
  const status = mapSubscriptionStatus(subscription.status)
  const firstItem = subscription.items.data[0]
  const currentPeriodEnd = firstItem?.current_period_end ?? Math.floor(Date.now() / 1000)

  const updates: Record<string, unknown> = {
    stripe_subscription_id: subscription.id,
    subscription_status: status,
    subscription_ends_at: new Date(currentPeriodEnd * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }

  if (subscription.cancel_at_period_end) {
    updates.subscription_status = "canceling"
  } else if (plan) {
    updates.plan = plan
  }

  await updateUserByDatabaseId(user.id, updates)

  let tierForClerk: string
  if (subscription.cancel_at_period_end) {
    const currentPlan = await getUserCurrentPlan(user.id)
    tierForClerk = currentPlan ?? plan ?? "free"
  } else {
    tierForClerk = plan ?? "free"
  }
  await updateClerkTier(user.clerk_id, tierForClerk)
}

async function getUserCurrentPlan(userId: string): Promise<string | null> {
  const database = getDatabase()
  const { data } = await database
    .from("users")
    .select("plan")
    .eq("id", userId)
    .maybeSingle()
  return (data as { plan?: string } | null)?.plan ?? null
}

export async function POST(request: Request) {
  let body: string
  try {
    body = await readRequestText(request, MAX_WEBHOOK_BYTES)
  } catch (err) {
    if (err instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 })
    }
    throw err
  }
  const headersList = await headers()
  const signature = headersList.get("stripe-signature")

  const webhookSecret = getRuntimeEnvironment().STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET not configured")
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    )
  }

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    )
  }

  const stripe = getStripe()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error("[stripe webhook] Signature verification failed", errorKind(err))
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    )
  }

  console.log("[stripe webhook] Received event", event.type)

  // Do not mark an event complete until its financial side effects have
  // succeeded. The old eager insert acknowledged a retry after a failed
  // handler, which could permanently lose a paid checkout.
  let eventAlreadyRecorded = false
  const database = getDatabase()
  try {
    const { data, error } = await database
      .from("stripe_events")
      .select("id")
      .eq("id", event.id)
      .maybeSingle()
    if (error) throw error
    eventAlreadyRecorded = Boolean(data)
  } catch (idemErr) {
    // The table is a ledger, not the only source of idempotency. Credit and
    // invoice payment IDs have their own unique database constraints.
    console.warn("[stripe webhook] Event ledger lookup failed", errorKind(idemErr))
  }

  if (eventAlreadyRecorded) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session
        console.log("[stripe webhook] Checkout completed", session.mode)

        let expandedSession: Stripe.Checkout.Session | null = null
        try {
          expandedSession = await stripe.checkout.sessions.retrieve(session.id, {
            expand: ["line_items.data.price", "customer"],
          })
        } catch (expandErr) {
          console.warn("[stripe webhook] Session expansion failed", errorKind(expandErr))
          expandedSession = null
        }

        const resolvedSession = expandedSession ?? session
        if (resolvedSession.payment_status !== "paid") {
          console.log("[stripe webhook] Checkout payment pending; awaiting successful payment event")
          break
        }
        const metadata = resolvedSession.metadata as Record<string, string> | undefined
        const userId = resolvedSession.client_reference_id ?? metadata?.userId
        let checkoutUser: WebhookUser | null = null

        if (!userId) {
          throw new Error("Checkout session is missing its Clerk user reference")
        }

        {
          checkoutUser = await ensureCheckoutUser(userId, getCheckoutEmail(resolvedSession))
          const updates: Record<string, unknown> = {}

          const customerId = getSessionCustomerId(resolvedSession)
          if (customerId) updates.stripe_customer_id = customerId

          if (resolvedSession.subscription && typeof resolvedSession.subscription === "string") {
            updates.stripe_subscription_id = resolvedSession.subscription

            try {
              const sub = await stripe.subscriptions.retrieve(resolvedSession.subscription)
              const firstItem = sub.items.data[0]
              const currentPeriodEnd = firstItem?.current_period_end ?? Math.floor(Date.now() / 1000)
              updates.subscription_ends_at = new Date(currentPeriodEnd * 1000).toISOString()
            } catch (subErr) {
              console.warn("[stripe webhook] Subscription retrieval failed", errorKind(subErr))
            }
          }

          const priceId = metadata?.priceId
          const plan = priceId ? mapPlanFromPriceId(priceId) : null
          if (resolvedSession.mode === "subscription" && plan) {
            updates.plan = plan
            updates.subscription_status = "active"
          }

          if (Object.keys(updates).length > 0) {
            updates.updated_at = new Date().toISOString()
            console.log("[stripe webhook] Updating entitlement fields", Object.keys(updates))
            await updateUserByDatabaseId(checkoutUser.id, updates)
          }

          if (resolvedSession.mode === "subscription" && plan) {
            await updateClerkTier(userId, plan)
          }
        }

        let checkoutReversed = false
        // Credit pack handling
        if (resolvedSession.mode === "payment") {
          console.log("[stripe webhook] Processing credit pack payment")

          if (resolvedSession.payment_status !== "paid") {
            console.log("[stripe webhook] Payment is not settled yet; waiting for a successful payment event")
            break
          }

          const customerId = resolvedSession.customer
            ? typeof resolvedSession.customer === "string"
              ? resolvedSession.customer
              : (resolvedSession.customer as Stripe.Customer).id
            : null

          if (!customerId) throw new Error("Paid Checkout session is missing a Stripe customer")

          const lineItems = (resolvedSession as Stripe.Checkout.Session & {
            line_items?: { data: Array<{ price?: { id?: string } }> }
          }).line_items?.data ?? []

          const priceId = lineItems[0]?.price?.id
          const prices = getStripePrices()
          if (!priceId) {
            throw new Error("Paid Checkout session is missing its authoritative line-item price")
          }
          if (!isCreditPack(priceId, prices)) {
            throw new Error("Paid Checkout session contains an unknown credit-pack price")
          }
          {
            const creditMap: Record<string, number> = {
              [prices.credits10]: 10,
              [prices.credits50]: 50,
              [prices.credits200]: 200,
            }

            const credits = creditMap[priceId]
            console.log("[stripe webhook] Credits to grant:", credits)

            if (credits) {
              const user = checkoutUser ?? await getUserByStripeCustomerId(customerId)
              if (user) {
                const paymentId =
                  typeof resolvedSession.payment_intent === "string"
                    ? resolvedSession.payment_intent
                    : resolvedSession.payment_intent?.id ?? resolvedSession.id
                const reversed = await getDatabaseBinding().prepare(`SELECT 1 AS reversed
                  FROM payment_refunds WHERE stripe_payment_id = ? AND status = 'succeeded'
                  UNION ALL SELECT 1 AS reversed FROM payment_disputes
                  WHERE stripe_payment_id = ? AND status = 'lost' LIMIT 1`)
                  .bind(paymentId, paymentId).first<{ reversed: number }>()
                checkoutReversed = Boolean(reversed)
                const { data: existing, error: existingError } = await database
                  .from("credit_packs")
                  .select("id")
                  .eq("stripe_payment_id", paymentId)
                  .maybeSingle()
                if (existingError) throw existingError

                if (!existing && !reversed) {
                  const purchasedAt = new Date()
                  const expiresAt = new Date(purchasedAt)
                  expiresAt.setFullYear(expiresAt.getFullYear() + 1)

                  const { error: insertErr } = await database.from("credit_packs").insert({
                    user_id: user.id,
                    pack_size: credits,
                    credits_remaining: credits,
                    price_paid: resolvedSession.amount_total ? resolvedSession.amount_total / 100 : 0,
                    stripe_payment_id: paymentId,
                    purchased_at: purchasedAt.toISOString(),
                    expires_at: expiresAt.toISOString(),
                  })

                  if (insertErr) {
                    const raced = await database
                      .from("credit_packs")
                      .select("id")
                      .eq("stripe_payment_id", paymentId)
                      .maybeSingle()
                    if (raced.error) throw raced.error
                    if (!raced.data) {
                      throw new Error(`Failed to insert credit pack: ${insertErr.message}`)
                    }
                    console.log("[stripe webhook] Concurrent credit-pack delivery already processed")
                  } else {
                    console.log("[stripe webhook] Credit pack inserted", credits)
                  }
                } else if (existing) {
                  console.log("[stripe webhook] Credit pack payment already processed")
                } else {
                  console.warn("[stripe webhook] Reversed payment will not grant credits")
                }

                await insertInvoice({
                  userId: user.id,
                  stripePaymentId: paymentId,
                  amount: resolvedSession.amount_total ? resolvedSession.amount_total / 100 : 0,
                  currency: resolvedSession.currency ?? "usd",
                  status: reversed ? "refunded" : "paid",
                  description: `${credits} credit pack`,
                  paidAt: new Date().toISOString(),
                })
              } else {
                throw new Error(`No user found for paid Stripe customer ${customerId}`)
              }
            }
          }
        }
        await getDatabaseBinding().prepare(`UPDATE purchase_acceptances SET
          user_id = ?, stripe_customer_id = ?, stripe_payment_id = ?, stripe_invoice_id = ?,
          stripe_subscription_id = ?,
          amount_minor = ?, currency = ?, status = ?, updated_at = ?
          WHERE stripe_session_id = ?`)
          .bind(checkoutUser?.id ?? null, getSessionCustomerId(resolvedSession),
            typeof resolvedSession.payment_intent === "string"
              ? resolvedSession.payment_intent : resolvedSession.payment_intent?.id ?? null,
            typeof resolvedSession.invoice === "string"
              ? resolvedSession.invoice : resolvedSession.invoice?.id ?? null,
            typeof resolvedSession.subscription === "string"
              ? resolvedSession.subscription : resolvedSession.subscription?.id ?? null,
            resolvedSession.amount_total ?? null, resolvedSession.currency ?? null,
            checkoutReversed ? "refunded" : "paid",
            new Date().toISOString(), resolvedSession.id).run()
        if (!checkoutReversed) {
          await queueBillingNotification("purchase_confirmation", resolvedSession.id, `purchase:${resolvedSession.id}`)
        }
        break
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session
        await getDatabaseBinding().prepare(`UPDATE purchase_acceptances
          SET status = 'failed', updated_at = ? WHERE stripe_session_id = ?`)
          .bind(new Date().toISOString(), session.id).run()
        break
      }

      case "refund.created":
      case "refund.updated":
      case "refund.failed": {
        // Read the current object because Stripe can deliver snapshot events
        // out of order. A late pending event must not undo a succeeded refund.
        const refund = await stripe.refunds.retrieve((event.data.object as Stripe.Refund).id)
        await recordStripeRefund(refund, event.livemode, event.id)
        if (refund.status === "succeeded" || refund.status === "failed") {
          await queueBillingNotification("refund_result", refund.id, `refund-result:${refund.id}:${refund.status}`)
        }
        break
      }

      case "charge.dispute.created":
      case "charge.dispute.updated":
      case "charge.dispute.closed":
      case "charge.dispute.funds_withdrawn":
      case "charge.dispute.funds_reinstated": {
        const dispute = await stripe.disputes.retrieve((event.data.object as Stripe.Dispute).id)
        await recordStripeDispute(dispute, event.type, event.id)
        if (event.type === "charge.dispute.created") {
          await queueBillingNotification("dispute_alert", dispute.id, `dispute-alert:${dispute.id}`)
        }
        break
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionChange(subscription)
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id
        const user = await getUserByStripeCustomerId(customerId, subscription.id)
        if (user) {
          await updateUserByDatabaseId(user.id, {
            plan: "free",
            subscription_status: "canceled",
            stripe_subscription_id: null,
            subscription_ends_at: null,
            updated_at: new Date().toISOString(),
          })
          await updateClerkTier(user.clerk_id, "free")
        }
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        const customer = invoice.customer
        if (!customer) break

        const customerId =
          typeof customer === "string" ? customer : customer.id
        const subObj = invoice.parent?.subscription_details?.subscription
        const subscriptionId =
          typeof subObj === "string" ? subObj : subObj?.id
        const user = await getUserByStripeCustomerId(customerId, subscriptionId)
        if (user) {
          await insertInvoice({
            userId: user.id,
            stripeInvoiceId: invoice.id,
            amount: invoice.amount_due / 100,
            currency: invoice.currency,
            status: "failed",
            description: invoice.lines?.data[0]?.description ?? null,
            paidAt: invoice.created
              ? new Date(invoice.created * 1000).toISOString()
              : null,
          })
          await updateUserByDatabaseId(user.id, {
            subscription_status: "past_due",
            updated_at: new Date().toISOString(),
          })
        }
        break
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice
        const customer = invoice.customer
        if (!customer) break

        const customerId =
          typeof customer === "string" ? customer : customer.id
        const subObj = invoice.parent?.subscription_details?.subscription
        const subscriptionId =
          typeof subObj === "string" ? subObj : subObj?.id
        const user = await getUserByStripeCustomerId(customerId, subscriptionId)
        if (user) {
          let stripePaymentId: string | null = null
          try {
            const invoicePayments = await stripe.invoicePayments.list({ invoice: invoice.id, status: "paid", limit: 10 })
            const payment = invoicePayments.data.find((item) => item.payment.payment_intent || item.payment.charge)
            stripePaymentId = typeof payment?.payment.payment_intent === "string"
              ? payment.payment.payment_intent : payment?.payment.payment_intent?.id ?? null
          } catch (lookupError) {
            console.warn("[stripe webhook] Invoice payment lookup deferred", errorKind(lookupError))
          }
          await insertInvoice({
            userId: user.id,
            stripeInvoiceId: invoice.id,
            stripePaymentId,
            amount: invoice.amount_paid / 100,
            currency: invoice.currency,
            status: "paid",
            description: invoice.lines?.data[0]?.description ?? null,
            paidAt: invoice.status_transitions?.paid_at
              ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
              : new Date().toISOString(),
          })
        }
        break
      }
    }
  } catch (handlerErr) {
    console.error("[stripe webhook] Handler failed", errorKind(handlerErr))
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }

  if (!eventAlreadyRecorded) {
    try {
      const { error } = await database.from("stripe_events").insert({
        id: event.id,
        type: event.type,
        livemode: event.livemode,
      })
      if (error && error.code !== "23505") throw error
    } catch (ledgerError) {
      // The financial writes have already committed safely; retain a 2xx so
      // Stripe does not retry and duplicate unrelated subscription events.
      console.warn("[stripe webhook] Event ledger write failed", errorKind(ledgerError))
    }
  }

  return NextResponse.json({ received: true, duplicate: false })
}
