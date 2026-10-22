-- 1. Views bypassed RLS (security definer). Enforce the querying user's RLS instead.
alter view public.user_credit_balance set (security_invoker = true);
alter view public.recent_scans set (security_invoker = true);

-- 2. Views are read-only; drop write grants that allowed RLS-bypassing inserts.
revoke insert, update, delete, truncate on public.user_credit_balance from anon, authenticated;
revoke insert, update, delete, truncate on public.recent_scans from anon, authenticated;

-- 3. stripe_events is written only by the webhook handler (service role). RLS has no policies
--    (deny-all) so it was already blocked, but the grants were sloppy — revoke them.
revoke all on public.stripe_events from anon, authenticated;

-- 4. Pin search_path on the updated_at trigger function (advisor warning).
alter function public.update_updated_at() set search_path = '';
