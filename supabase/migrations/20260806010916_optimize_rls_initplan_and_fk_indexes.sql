-- ========== CATEGORY A: initplan-optimize auth.jwt() (was re-evaluated per row) ==========
drop policy if exists "Users can view own profile" on public.users;
create policy "Users can view own profile" on public.users
  for select to public
  using ( clerk_id = ((select auth.jwt()) ->> 'sub'::text) );

drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile" on public.users
  for update to public
  using ( clerk_id = ((select auth.jwt()) ->> 'sub'::text) )
  with check ( clerk_id = ((select auth.jwt()) ->> 'sub'::text) );

drop policy if exists "Users can view own scans" on public.scans;
create policy "Users can view own scans" on public.scans
  for select to public
  using ( user_id in ( select id from users where clerk_id = ((select auth.jwt()) ->> 'sub'::text) ) );

drop policy if exists "Users can create own scans" on public.scans;
create policy "Users can create own scans" on public.scans
  for insert to public
  with check ( user_id in ( select id from users where clerk_id = ((select auth.jwt()) ->> 'sub'::text) ) );

drop policy if exists "Users can delete own scans" on public.scans;
create policy "Users can delete own scans" on public.scans
  for delete to public
  using ( user_id in ( select id from users where clerk_id = ((select auth.jwt()) ->> 'sub'::text) ) );

drop policy if exists "Users can view own clauses" on public.clauses;
create policy "Users can view own clauses" on public.clauses
  for select to public
  using ( scan_id in ( select id from scans where user_id in ( select id from users where clerk_id = ((select auth.jwt()) ->> 'sub'::text) ) ) );

drop policy if exists "Users can manage own blocklist" on public.blocklist_items;
create policy "Users can manage own blocklist" on public.blocklist_items
  for all to public
  using ( user_id in ( select id from users where clerk_id = ((select auth.jwt()) ->> 'sub'::text) ) )
  with check ( user_id in ( select id from users where clerk_id = ((select auth.jwt()) ->> 'sub'::text) ) );

drop policy if exists "Users can view own credit packs" on public.credit_packs;
create policy "Users can view own credit packs" on public.credit_packs
  for select to public
  using ( user_id in ( select id from users where clerk_id = ((select auth.jwt()) ->> 'sub'::text) ) );

drop policy if exists "Users can view own invoices" on public.invoices;
create policy "Users can view own invoices" on public.invoices
  for select to public
  using ( user_id in ( select id from users where clerk_id = ((select auth.jwt()) ->> 'sub'::text) ) );

drop policy if exists "Users can view own monitoring subscriptions" on public.monitoring_subscriptions;
create policy "Users can view own monitoring subscriptions" on public.monitoring_subscriptions
  for select to public
  using ( user_id in ( select id from users where clerk_id = ((select auth.jwt()) ->> 'sub'::text) ) );

drop policy if exists "Users can insert own monitoring subscriptions" on public.monitoring_subscriptions;
create policy "Users can insert own monitoring subscriptions" on public.monitoring_subscriptions
  for insert to public
  with check ( user_id in ( select id from users where clerk_id = ((select auth.jwt()) ->> 'sub'::text) ) );

drop policy if exists "Users can update own monitoring subscriptions" on public.monitoring_subscriptions;
create policy "Users can update own monitoring subscriptions" on public.monitoring_subscriptions
  for update to public
  using ( user_id in ( select id from users where clerk_id = ((select auth.jwt()) ->> 'sub'::text) ) )
  with check ( user_id in ( select id from users where clerk_id = ((select auth.jwt()) ->> 'sub'::text) ) );

drop policy if exists "Users can delete own monitoring subscriptions" on public.monitoring_subscriptions;
create policy "Users can delete own monitoring subscriptions" on public.monitoring_subscriptions
  for delete to public
  using ( user_id in ( select id from users where clerk_id = ((select auth.jwt()) ->> 'sub'::text) ) );

drop policy if exists "Users can view own monitoring alerts" on public.monitoring_alerts;
create policy "Users can view own monitoring alerts" on public.monitoring_alerts
  for select to public
  using ( user_id in ( select id from users where clerk_id = ((select auth.jwt()) ->> 'sub'::text) ) );

drop policy if exists "Users can update own monitoring alerts" on public.monitoring_alerts;
create policy "Users can update own monitoring alerts" on public.monitoring_alerts
  for update to public
  using ( user_id in ( select id from users where clerk_id = ((select auth.jwt()) ->> 'sub'::text) ) )
  with check ( user_id in ( select id from users where clerk_id = ((select auth.jwt()) ->> 'sub'::text) ) );

-- ========== CATEGORY B: replace deprecated auth.role() with TO authenticated ==========
drop policy if exists "Authenticated users can read tos_cache" on public.tos_cache;
create policy "Authenticated users can read tos_cache" on public.tos_cache
  for select to authenticated using ( true );

drop policy if exists "Authenticated users can read explanations_cache" on public.explanations_cache;
create policy "Authenticated users can read explanations_cache" on public.explanations_cache
  for select to authenticated using ( true );

drop policy if exists "Authenticated users can read tos_snapshots" on public.tos_snapshots;
create policy "Authenticated users can read tos_snapshots" on public.tos_snapshots
  for select to authenticated using ( true );

drop policy if exists "Authenticated users can read regulations" on public.regulations;
create policy "Authenticated users can read regulations" on public.regulations
  for select to authenticated using ( true );

drop policy if exists "Authenticated users can read compliance tags" on public.clause_compliance_tags;
create policy "Authenticated users can read compliance tags" on public.clause_compliance_tags
  for select to authenticated using ( true );

-- ========== FK indexes ==========
create index if not exists idx_scans_previous_scan_id on public.scans (previous_scan_id);
create index if not exists idx_tos_snapshots_scan_id on public.tos_snapshots (scan_id);
