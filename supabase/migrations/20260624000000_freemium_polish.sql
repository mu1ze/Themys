create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  livemode boolean not null,
  received_at timestamptz not null default now()
);
