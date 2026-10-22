-- Keep privacy policies, Terms of Use, Terms of Service, and other legal
-- documents in separate scan and monitoring lineages. Existing rows remain
-- unknown until they are explicitly reclassified; this intentionally avoids
-- unsafe historical merges.

alter table public.scans
  add column if not exists document_type text not null default 'unknown',
  add column if not exists document_type_confidence numeric(4,3),
  add column if not exists document_type_source text,
  add column if not exists document_type_evidence jsonb not null default '[]'::jsonb,
  add column if not exists document_identity_key text;

alter table public.monitoring_subscriptions
  add column if not exists document_type text not null default 'unknown',
  add column if not exists document_type_confidence numeric(4,3),
  add column if not exists document_type_source text,
  add column if not exists document_type_evidence jsonb not null default '[]'::jsonb,
  add column if not exists document_identity_key text,
  add column if not exists verification_status text not null default 'needs_review',
  add column if not exists verification_message text;

alter table public.tos_snapshots
  add column if not exists subscription_id uuid references public.monitoring_subscriptions(id) on delete cascade,
  add column if not exists document_type text not null default 'unknown',
  add column if not exists document_identity_key text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'scans_document_type_check') then
    alter table public.scans add constraint scans_document_type_check check (
      document_type in (
        'terms_of_service', 'terms_of_use', 'terms_and_conditions',
        'privacy_policy', 'acceptable_use_policy', 'cookie_policy',
        'eula', 'other', 'unknown'
      )
    );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'scans_document_type_confidence_check') then
    alter table public.scans add constraint scans_document_type_confidence_check
      check (document_type_confidence is null or document_type_confidence between 0 and 1);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'monitoring_subscriptions_document_type_check') then
    alter table public.monitoring_subscriptions add constraint monitoring_subscriptions_document_type_check check (
      document_type in (
        'terms_of_service', 'terms_of_use', 'terms_and_conditions',
        'privacy_policy', 'acceptable_use_policy', 'cookie_policy',
        'eula', 'other', 'unknown'
      )
    );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'monitoring_subscriptions_document_type_confidence_check') then
    alter table public.monitoring_subscriptions add constraint monitoring_subscriptions_document_type_confidence_check
      check (document_type_confidence is null or document_type_confidence between 0 and 1);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'monitoring_subscriptions_verification_status_check') then
    alter table public.monitoring_subscriptions add constraint monitoring_subscriptions_verification_status_check
      check (verification_status in ('active', 'needs_review', 'mismatch'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tos_snapshots_document_type_check') then
    alter table public.tos_snapshots add constraint tos_snapshots_document_type_check check (
      document_type in (
        'terms_of_service', 'terms_of_use', 'terms_and_conditions',
        'privacy_policy', 'acceptable_use_policy', 'cookie_policy',
        'eula', 'other', 'unknown'
      )
    );
  end if;
end
$$;

create index if not exists idx_scans_user_document_identity_created
  on public.scans (user_id, document_identity_key, created_at desc)
  where is_deleted = false and document_identity_key is not null;

create index if not exists idx_monitoring_subscriptions_document_identity
  on public.monitoring_subscriptions (user_id, document_identity_key)
  where is_active = true and document_identity_key is not null;

create index if not exists idx_tos_snapshots_subscription_created
  on public.tos_snapshots (subscription_id, created_at desc)
  where subscription_id is not null;

drop policy if exists "Authenticated users can read tos_snapshots" on public.tos_snapshots;
drop policy if exists "Users can read own tos snapshots" on public.tos_snapshots;
create policy "Users can read own tos snapshots"
  on public.tos_snapshots for select
  to authenticated
  using (
    exists (
      select 1
      from public.monitoring_subscriptions subscription
      join public.users app_user on app_user.id = subscription.user_id
      where subscription.id = tos_snapshots.subscription_id
        and app_user.clerk_id = (select auth.jwt()->>'sub')
    )
  );

create function public.subscribe_monitoring_with_identity_limit(
  p_user_id uuid,
  p_url text,
  p_domain text,
  p_title text,
  p_frequency text,
  p_limit integer,
  p_document_type text,
  p_document_type_confidence numeric,
  p_document_type_source text,
  p_document_type_evidence jsonb,
  p_document_identity_key text
) returns public.monitoring_subscriptions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_existing public.monitoring_subscriptions%rowtype;
  v_result public.monitoring_subscriptions%rowtype;
  v_count integer;
begin
  if p_limit < 1
    or p_frequency not in ('daily', 'weekly', 'monthly')
    or p_document_type is null
    or p_document_type not in (
      'terms_of_service', 'terms_of_use', 'terms_and_conditions',
      'privacy_policy', 'acceptable_use_policy', 'cookie_policy',
      'eula', 'other'
    )
    or p_document_type_confidence is null
    or p_document_type_confidence < 0.85
    or p_document_identity_key is null
  then
    raise exception 'Invalid monitoring subscription parameters';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select * into v_existing
  from public.monitoring_subscriptions
  where user_id = p_user_id and url = p_url;

  if not found then
    select count(*)::integer into v_count
    from public.monitoring_subscriptions
    where user_id = p_user_id and is_active = true;

    if v_count >= p_limit then
      raise exception using errcode = 'P0001', message = 'monitor_limit_reached';
    end if;
  end if;

  insert into public.monitoring_subscriptions (
    user_id, url, domain, title, frequency, is_active,
    document_type, document_type_confidence, document_type_source,
    document_type_evidence, document_identity_key,
    verification_status, verification_message
  ) values (
    p_user_id, p_url, p_domain, p_title, p_frequency, true,
    p_document_type, p_document_type_confidence, p_document_type_source,
    coalesce(p_document_type_evidence, '[]'::jsonb), p_document_identity_key,
    'active', null
  )
  on conflict (user_id, url) do update
    set domain = excluded.domain,
        title = excluded.title,
        frequency = excluded.frequency,
        is_active = true,
        document_type = excluded.document_type,
        document_type_confidence = excluded.document_type_confidence,
        document_type_source = excluded.document_type_source,
        document_type_evidence = excluded.document_type_evidence,
        document_identity_key = excluded.document_identity_key,
        verification_status = 'active',
        verification_message = null
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.subscribe_monitoring_with_identity_limit(
  uuid, text, text, text, text, integer, text, numeric, text, jsonb, text
) from public, anon, authenticated;

grant execute on function public.subscribe_monitoring_with_identity_limit(
  uuid, text, text, text, text, integer, text, numeric, text, jsonb, text
) to service_role;
