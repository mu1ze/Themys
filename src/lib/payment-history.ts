export type PaymentHistoryInvoice = {
  id: string
  amount_paid: number
  currency: string
  description: string | null
  status_transitions: { paid_at: number | null } | null
}

export type PaymentHistoryCheckoutSession = {
  id: string
  amount_total: number | null
  created: number
  currency: string | null
  mode: string | null
  payment_intent: string | { id: string } | null
  payment_status: string
}

type PaymentHistoryStripeClient = {
  invoices: {
    list: (params: {
      customer: string
      limit: number
      status: "paid"
    }) => Promise<{ data: PaymentHistoryInvoice[] }>
  }
  checkout: {
    sessions: {
      list: (params: {
        customer: string
        limit: number
        status: "complete"
      }) => Promise<{ data: PaymentHistoryCheckoutSession[] }>
    }
  }
}

export type PaymentHistoryInvoiceWriter = (input: {
  userId: string
  stripeInvoiceId?: string | null
  stripePaymentId?: string | null
  amount: number
  currency?: string
  status: "paid"
  description?: string | null
  paidAt?: string | null
}) => Promise<void>

function paymentIntentId(value: PaymentHistoryCheckoutSession["payment_intent"]): string | null {
  if (typeof value === "string") return value
  return value?.id ?? null
}

export async function syncPaymentHistoryFromStripe({
  stripe,
  userId,
  stripeCustomerId,
  writeInvoice,
}: {
  stripe: PaymentHistoryStripeClient
  userId: string
  stripeCustomerId: string
  writeInvoice: PaymentHistoryInvoiceWriter
}): Promise<void> {
  const [invoicePage, checkoutSessionPage] = await Promise.all([
    stripe.invoices.list({
      customer: stripeCustomerId,
      status: "paid",
      limit: 100,
    }),
    stripe.checkout.sessions.list({
      customer: stripeCustomerId,
      status: "complete",
      limit: 100,
    }),
  ])

  const invoiceWrites = invoicePage.data.map((invoice) =>
    writeInvoice({
      userId,
      stripeInvoiceId: invoice.id,
      amount: invoice.amount_paid / 100,
      currency: invoice.currency,
      status: "paid",
      description: invoice.description,
      paidAt: invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
        : null,
    }),
  )

  const checkoutWrites = checkoutSessionPage.data
    .filter((session) => session.mode === "payment" && session.payment_status === "paid")
    .map((session) =>
      writeInvoice({
        userId,
        stripePaymentId: paymentIntentId(session.payment_intent) ?? session.id,
        amount: (session.amount_total ?? 0) / 100,
        currency: session.currency ?? "usd",
        status: "paid",
        description: "Credit purchase",
        paidAt: new Date(session.created * 1000).toISOString(),
      }),
    )

  await Promise.all([...invoiceWrites, ...checkoutWrites])
}
