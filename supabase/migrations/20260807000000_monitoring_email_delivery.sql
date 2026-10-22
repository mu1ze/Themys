-- DVL-99: durable monitoring email delivery state and per-subscription opt-out.

alter table public.monitoring_subscriptions
  add column if not exists email_notifications_enabled boolean not null default true;

alter table public.monitoring_alerts
  add column if not exists email_status text not null default 'pending',
  add column if not exists email_attempts integer not null default 0,
  add column if not exists email_last_attempt_at timestamptz,
  add column if not exists email_next_attempt_at timestamptz not null default now(),
  add column if not exists email_last_error text,
  add column if not exists email_idempotency_key text,
  add column if not exists email_sent_at timestamptz;

update public.monitoring_alerts
set email_idempotency_key = id::text
where email_idempotency_key is null;

alter table public.monitoring_alerts
  alter column email_idempotency_key set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'monitoring_alerts_email_status_check'
  ) then
    alter table public.monitoring_alerts add constraint monitoring_alerts_email_status_check
      check (email_status in ('pending', 'sending', 'sent', 'failed', 'disabled'));
  end if;
end
$$;

create unique index if not exists idx_monitoring_alerts_email_idempotency
  on public.monitoring_alerts(email_idempotency_key);

create index if not exists idx_monitoring_alerts_email_due
  on public.monitoring_alerts(email_next_attempt_at, created_at)
  where email_status in ('pending', 'failed');

-- Claim is atomic so an hourly cron retry cannot send the same alert twice.
create or replace function public.claim_monitoring_alert_email(
  p_alert_id uuid,
  p_now timestamptz default now()
) returns public.monitoring_alerts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alert public.monitoring_alerts;
begin
  update public.monitoring_alerts
  set email_status = 'sending',
      email_attempts = email_attempts + 1,
      email_last_attempt_at = p_now,
      email_last_error = null
  where id = p_alert_id
    and is_email_sent = false
    and email_status in ('pending', 'failed')
    and email_next_attempt_at <= p_now
  returning * into v_alert;

  return v_alert;
end;
$$;

revoke all on function public.claim_monitoring_alert_email(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_monitoring_alert_email(uuid, timestamptz)
  to service_role;
