alter table public.users
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text
    check (subscription_status in ('active', 'canceled', 'past_due', 'trialing', 'incomplete')),
  add column if not exists subscription_ends_at timestamptz;

create index if not exists idx_users_subscription
  on public.users(stripe_subscription_id)
  where stripe_subscription_id is not null;
