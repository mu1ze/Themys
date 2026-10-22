create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  stripe_invoice_id text unique,
  stripe_payment_id text,
  amount numeric(8,2) not null,
  currency text not null default 'usd',
  status text not null check (status in ('paid', 'pending', 'failed', 'refunded')),
  description text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoices_user
  on public.invoices(user_id, paid_at desc);
