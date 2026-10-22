import { expect, test, type APIRequestContext } from "@playwright/test"
import { createClerkClient } from "@clerk/backend"
import Stripe from "stripe"
import { createCloudflareD1AdminClient } from "../scripts/lib/cloudflare-admin.mjs"

function getAdminClient() {
  return createCloudflareD1AdminClient()
}

function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is required for Stripe mutation E2E")
  return secret
}

function buildEvent(id: string, type: string, object: Record<string, unknown>) {
  return {
    id,
    object: "event",
    api_version: "2026-05-27.dahlia",
    created: Math.floor(Date.now() / 1000),
    data: { object },
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type,
  }
}

async function sendEvent(request: APIRequestContext, event: ReturnType<typeof buildEvent>) {
  const payload = JSON.stringify(event)
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: getWebhookSecret(),
  })
  return request.post("/api/webhooks/stripe", {
    data: payload,
    headers: {
      "content-type": "application/json",
      "stripe-signature": signature,
    },
  })
}

test.describe.serial("Stripe webhook mutations", () => {
  test.beforeAll(({ baseURL }) => {
    expect(baseURL).toBeTruthy()
    const target = new URL(baseURL!)
    const local = target.hostname === "localhost" || target.hostname === "127.0.0.1"
    expect(
      local || process.env.ALLOW_REMOTE_MUTATION_E2E === "1",
      "Stripe mutation E2E may only target localhost unless explicitly authorized",
    ).toBe(true)
    expect(process.env.STRIPE_SECRET_KEY).toMatch(/^sk_test_/)
  })

  test("rejects missing and invalid webhook signatures", async ({ request }) => {
    const missing = await request.post("/api/webhooks/stripe", {
      data: JSON.stringify(buildEvent("evt_missing", "customer.subscription.updated", {})),
      headers: { "content-type": "application/json" },
    })
    expect(missing.status()).toBe(400)

    const invalid = await request.post("/api/webhooks/stripe", {
      data: "{}",
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=1,v1=invalid",
      },
    })
    expect(invalid.status()).toBe(400)
  })

  test("subscription, invoice, cancellation, and deletion events update one disposable user", async ({ request }) => {
    const admin = getAdminClient()
    const marker = crypto.randomUUID().replaceAll("-", "")
    const clerkId = `user_stripe_e2e_${marker}`
    const customerId = `cus_e2e_${marker}`
    const subscriptionId = `sub_e2e_${marker}`
    const invoiceId = `in_e2e_${marker}`
    const eventIds: string[] = []
    let userId: string | undefined

    const priceId = process.env.STRIPE_PRICE_BASE_MONTHLY
    if (!priceId) throw new Error("STRIPE_PRICE_BASE_MONTHLY is required")

    async function deliver(type: string, object: Record<string, unknown>) {
      const eventId = `evt_${marker}_${eventIds.length}`
      eventIds.push(eventId)
      const response = await sendEvent(request, buildEvent(eventId, type, object))
      expect(response.status(), await response.text()).toBe(200)
      return response.json() as Promise<{ received: boolean; duplicate: boolean }>
    }

    try {
      const created = await admin.from("users").insert({
        clerk_id: clerkId,
        email: `${marker}@themys.invalid`,
        plan: "free",
        stripe_customer_id: customerId,
      }).select("id").single()
      if (created.error) throw created.error
      if (!created.data) throw new Error("Stripe E2E user fixture was not returned")
      userId = created.data.id

      const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
      const subscription = {
        id: subscriptionId,
        object: "subscription",
        customer: customerId,
        status: "active",
        cancel_at_period_end: false,
        items: {
          data: [{ current_period_end: periodEnd, price: { id: priceId } }],
        },
      }

      const initial = await deliver("customer.subscription.created", subscription)
      expect(initial).toEqual({ received: true, duplicate: false })

      let state = await admin
        .from("users")
        .select("plan, subscription_status, stripe_subscription_id, subscription_ends_at")
        .eq("id", userId)
        .single()
      if (state.error) throw state.error
      if (!state.data) throw new Error("Stripe E2E subscription state was not returned")
      expect(state.data).toMatchObject({
        plan: "base",
        subscription_status: "active",
        stripe_subscription_id: subscriptionId,
      })
      expect(new Date(state.data.subscription_ends_at).getTime()).toBe(periodEnd * 1000)

      await deliver("invoice.payment_failed", {
        id: invoiceId,
        object: "invoice",
        customer: customerId,
        parent: { subscription_details: { subscription: subscriptionId } },
      })
      state = await admin.from("users").select("plan, subscription_status").eq("id", userId).single()
      if (state.error) throw state.error
      if (!state.data) throw new Error("Stripe E2E payment-failure state was not returned")
      expect(state.data).toEqual({ plan: "base", subscription_status: "past_due" })

      await deliver("invoice.paid", {
        id: invoiceId,
        object: "invoice",
        customer: customerId,
        parent: { subscription_details: { subscription: subscriptionId } },
        amount_paid: 249,
        currency: "usd",
        lines: { data: [{ description: "Base monthly" }] },
        status_transitions: { paid_at: Math.floor(Date.now() / 1000) },
      })
      const invoice = await admin
        .from("invoices")
        .select("stripe_invoice_id, amount, status")
        .eq("stripe_invoice_id", invoiceId)
        .single()
      if (invoice.error) throw invoice.error
      if (!invoice.data) throw new Error("Stripe E2E invoice was not returned")
      expect(invoice.data).toMatchObject({ stripe_invoice_id: invoiceId, status: "paid" })
      expect(Number(invoice.data.amount)).toBe(2.49)

      await deliver("customer.subscription.updated", {
        ...subscription,
        cancel_at_period_end: true,
      })
      state = await admin.from("users").select("plan, subscription_status").eq("id", userId).single()
      if (state.error) throw state.error
      if (!state.data) throw new Error("Stripe E2E cancellation state was not returned")
      expect(state.data).toEqual({ plan: "base", subscription_status: "canceling" })

      await deliver("customer.subscription.deleted", {
        ...subscription,
        status: "canceled",
      })
      state = await admin
        .from("users")
        .select("plan, subscription_status, stripe_subscription_id, subscription_ends_at")
        .eq("id", userId)
        .single()
      if (state.error) throw state.error
      if (!state.data) throw new Error("Stripe E2E deleted state was not returned")
      expect(state.data).toEqual({
        plan: "free",
        subscription_status: "canceled",
        stripe_subscription_id: null,
        subscription_ends_at: null,
      })
    } finally {
      if (userId) {
        await admin.from("invoices").delete().eq("user_id", userId)
        await admin.from("users").delete().eq("id", userId)
      }
      if (eventIds.length > 0) await admin.from("stripe_events").delete().in("id", eventIds)
    }
  })

  test("settings schedules a disposable Stripe subscription to cancel at period end", async ({ page }) => {
    const admin = getAdminClient()
    const secretKey = process.env.STRIPE_SECRET_KEY
    const clerkSecretKey = process.env.CLERK_SECRET_KEY
    const priceId = process.env.STRIPE_PRICE_BASE_MONTHLY
    if (!secretKey?.startsWith("sk_test_")) throw new Error("A Stripe test secret is required")
    if (!clerkSecretKey?.startsWith("sk_test_")) throw new Error("A Clerk test secret is required")
    if (!priceId) throw new Error("STRIPE_PRICE_BASE_MONTHLY is required")

    const stripe = new Stripe(secretKey)
    const clerk = createClerkClient({ secretKey: clerkSecretKey })
    const testEmail = process.env.CLERK_TEST_USER_EMAIL ?? "e2e+clerk_test@themys.ca"
    const clerkUsers = await clerk.users.getUserList({ emailAddress: [testEmail], limit: 1 })
    const clerkUser = clerkUsers.data[0]
    if (!clerkUser) throw new Error(`Clerk test user ${testEmail} was not found`)

    const current = await admin
      .from("users")
      .select("id, plan, subscription_status, stripe_customer_id, stripe_subscription_id, subscription_ends_at")
      .eq("clerk_id", clerkUser.id)
      .single()
    if (current.error) throw current.error
    if (!current.data) throw new Error("Clerk test user is missing a database row")

    const originalMetadata = { ...clerkUser.publicMetadata }
    let customerId: string | undefined
    let subscriptionId: string | undefined

    try {
      const customer = await stripe.customers.create({
        email: testEmail,
        metadata: { purpose: "themys-e2e-cancellation" },
      })
      customerId = customer.id
      await stripe.paymentMethods.attach("pm_card_visa", { customer: customer.id })
      await stripe.customers.update(customer.id, {
        invoice_settings: { default_payment_method: "pm_card_visa" },
      })
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId }],
        default_payment_method: "pm_card_visa",
      })
      subscriptionId = subscription.id
      const periodEnd = subscription.items.data[0]?.current_period_end

      const seeded = await admin.from("users").update({
        plan: "base",
        subscription_status: "active",
        stripe_customer_id: customer.id,
        stripe_subscription_id: subscription.id,
        subscription_ends_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      }).eq("id", current.data.id)
      if (seeded.error) throw seeded.error
      await clerk.users.updateUserMetadata(clerkUser.id, { publicMetadata: { tier: "base" } })

      await page.goto("/settings")
      await expect(page.getByText("Personal", { exact: true }).first()).toBeVisible()
      await page.getByRole("button", { name: "Cancel subscription" }).click()
      await expect(page.getByText(/Your paid access remains active until the end/)).toBeVisible()
      await page.getByRole("button", { name: "Schedule cancellation" }).click()
      await expect(page.getByText("Canceling", { exact: true })).toBeVisible({ timeout: 30_000 })
      await expect(page.getByText("Cancellation scheduled for the end of the current billing period.")).toBeVisible()

      const cancelled = await stripe.subscriptions.retrieve(subscription.id)
      expect(cancelled.status).toBe("active")
      expect(cancelled.cancel_at_period_end).toBe(true)
      const persisted = await admin
        .from("users")
        .select("plan, subscription_status, stripe_subscription_id")
        .eq("id", current.data.id)
        .single()
      if (persisted.error) throw persisted.error
      if (!persisted.data) throw new Error("Persisted cancellation state was not returned")
      expect(persisted.data).toEqual({
        plan: "base",
        subscription_status: "canceling",
        stripe_subscription_id: subscription.id,
      })
    } finally {
      if (subscriptionId) {
        await stripe.subscriptions.cancel(subscriptionId).catch(() => undefined)
      }
      if (customerId) await stripe.customers.del(customerId).catch(() => undefined)
      const restored = await admin.from("users").update({
        plan: current.data.plan,
        subscription_status: current.data.subscription_status,
        stripe_customer_id: current.data.stripe_customer_id,
        stripe_subscription_id: current.data.stripe_subscription_id,
        subscription_ends_at: current.data.subscription_ends_at,
      }).eq("id", current.data.id)
      if (restored.error) throw restored.error
      await clerk.users.updateUserMetadata(clerkUser.id, { publicMetadata: originalMetadata })
    }
  })

  test("a signed-in user can start a Stripe test checkout from pricing", async ({ page }) => {
    const admin = getAdminClient()
    const profileResponse = await page.request.get("/api/profile")
    expect(profileResponse.status()).toBe(200)
    const { profile } = await profileResponse.json() as { profile: { id: string } }
    const current = await admin
      .from("users")
      .select("stripe_customer_id")
      .eq("id", profile.id)
      .single()
    if (current.error) throw current.error
    if (!current.data) throw new Error("Signed-in profile is missing a database row")

    try {
      const cleared = await admin.from("users").update({ stripe_customer_id: null }).eq("id", profile.id)
      if (cleared.error) throw cleared.error
      await page.goto("/pricing")
      await expect(page.getByRole("button", { name: "Choose Personal" })).toBeEnabled()
      await Promise.all([
        page.waitForURL(/https:\/\/checkout\.stripe\.com\//, { timeout: 30_000 }),
        page.getByRole("button", { name: "Choose Personal" }).click(),
      ])
      expect(page.url()).toContain("checkout.stripe.com")
    } finally {
      const restored = await admin
        .from("users")
        .update({ stripe_customer_id: current.data.stripe_customer_id })
        .eq("id", profile.id)
      if (restored.error) throw restored.error
    }
  })

  test("paid credit checkout is idempotent and grants expiring credits once", async ({ request }) => {
    const admin = getAdminClient()
    const marker = crypto.randomUUID().replaceAll("-", "")
    const clerkId = `user_credit_e2e_${marker}`
    const customerId = `cus_credit_e2e_${marker}`
    const paymentId = `pi_credit_e2e_${marker}`
    const sessionId = `cs_test_e2e_${marker}`
    const eventId = `evt_credit_e2e_${marker}`
    const priceId = process.env.STRIPE_PRICE_CREDITS_10
    if (!priceId) throw new Error("STRIPE_PRICE_CREDITS_10 is required")
    let userId: string | undefined

    const event = buildEvent(eventId, "checkout.session.completed", {
      id: sessionId,
      object: "checkout.session",
      mode: "payment",
      payment_status: "paid",
      customer: customerId,
      customer_details: { email: `${marker}@themys.invalid` },
      client_reference_id: clerkId,
      payment_intent: paymentId,
      amount_total: 199,
      currency: "usd",
      metadata: { userId: clerkId, priceId },
      line_items: { data: [{ price: { id: priceId } }] },
    })

    try {
      const first = await sendEvent(request, event)
      expect(first.status(), await first.text()).toBe(200)
      expect(await first.json()).toEqual({ received: true, duplicate: false })

      const user = await admin.from("users").select("id, stripe_customer_id").eq("clerk_id", clerkId).single()
      if (user.error) throw user.error
      if (!user.data) throw new Error("Credit checkout user was not returned")
      userId = user.data.id
      expect(user.data.stripe_customer_id).toBe(customerId)

      const second = await sendEvent(request, event)
      expect(second.status(), await second.text()).toBe(200)
      expect(await second.json()).toEqual({ received: true, duplicate: true })

      const packs = await admin
        .from("credit_packs")
        .select("pack_size, credits_remaining, stripe_payment_id, purchased_at, expires_at")
        .eq("stripe_payment_id", paymentId)
      if (packs.error) throw packs.error
      if (!packs.data || packs.data.length === 0) throw new Error("Credit checkout did not create a credit pack")
      expect(packs.data).toHaveLength(1)
      expect(packs.data[0]).toMatchObject({
        pack_size: 10,
        credits_remaining: 10,
        stripe_payment_id: paymentId,
      })
      const lifetime = new Date(packs.data[0].expires_at).getTime() - new Date(packs.data[0].purchased_at).getTime()
      expect(lifetime).toBeGreaterThan(364 * 24 * 60 * 60 * 1000)
      expect(lifetime).toBeLessThan(367 * 24 * 60 * 60 * 1000)
    } finally {
      if (userId) {
        await admin.from("invoices").delete().eq("user_id", userId)
        await admin.from("credit_packs").delete().eq("user_id", userId)
        await admin.from("users").delete().eq("id", userId)
      }
      await admin.from("stripe_events").delete().eq("id", eventId)
    }
  })
})
