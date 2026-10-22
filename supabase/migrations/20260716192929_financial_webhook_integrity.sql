-- Enforce idempotency for one-time Checkout fulfillment and payment history.
-- Existing records are preserved; a duplicate value stops the migration so it
-- can be investigated rather than silently deleting financial history.
CREATE UNIQUE INDEX IF NOT EXISTS credit_packs_stripe_payment_id_unique
  ON public.credit_packs (stripe_payment_id)
  WHERE stripe_payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_stripe_payment_id_unique
  ON public.invoices (stripe_payment_id)
  WHERE stripe_payment_id IS NOT NULL;
