-- Enable Row Level Security (RLS) on invoices and stripe_events
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- Drop policy if it already exists
DROP POLICY IF EXISTS "Users can view own invoices" ON public.invoices;

-- Users can only view their own invoices
CREATE POLICY "Users can view own invoices"
  ON public.invoices FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE clerk_id = auth.jwt()->>'sub'));
