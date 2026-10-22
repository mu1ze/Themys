import assert from "node:assert/strict"
import test from "node:test"

import { syncPaymentHistoryFromStripe } from "./payment-history.ts"

test("syncs paid invoices and completed one-time Checkout payments for one customer", async () => {
  const writes: Array<Record<string, unknown>> = []
  const requests: Array<Record<string, unknown>> = []

  await syncPaymentHistoryFromStripe({
    stripe: {
      invoices: {
        list: async (params) => {
          requests.push(params)
          return {
            data: [{
              id: "in_paid",
              amount_paid: 499,
              currency: "cad",
              description: "Themys Advanced",
              status_transitions: { paid_at: 1_784_376_000 },
            }],
          }
        },
      },
      checkout: {
        sessions: {
          list: async (params) => {
            requests.push(params)
            return {
              data: [
                {
                  id: "cs_credit",
                  amount_total: 1200,
                  created: 1_784_376_000,
                  currency: "cad",
                  mode: "payment",
                  payment_intent: { id: "pi_credit" },
                  payment_status: "paid",
                },
                {
                  id: "cs_subscription",
                  amount_total: 499,
                  created: 1_784_376_000,
                  currency: "cad",
                  mode: "subscription",
                  payment_intent: null,
                  payment_status: "paid",
                },
                {
                  id: "cs_unpaid",
                  amount_total: 1200,
                  created: 1_784_376_000,
                  currency: "cad",
                  mode: "payment",
                  payment_intent: "pi_unpaid",
                  payment_status: "unpaid",
                },
              ],
            }
          },
        },
      },
    },
    userId: "user_123",
    stripeCustomerId: "cus_123",
    writeInvoice: async (invoice) => {
      writes.push(invoice)
    },
  })

  assert.deepEqual(writes, [
    {
      userId: "user_123",
      stripeInvoiceId: "in_paid",
      amount: 4.99,
      currency: "cad",
      status: "paid",
      description: "Themys Advanced",
      paidAt: "2026-07-18T12:00:00.000Z",
    },
    {
      userId: "user_123",
      stripePaymentId: "pi_credit",
      amount: 12,
      currency: "cad",
      status: "paid",
      description: "Credit purchase",
      paidAt: "2026-07-18T12:00:00.000Z",
    },
  ])
  assert.deepEqual(requests, [
    { customer: "cus_123", status: "paid", limit: 100 },
    { customer: "cus_123", status: "complete", limit: 100 },
  ])
})
