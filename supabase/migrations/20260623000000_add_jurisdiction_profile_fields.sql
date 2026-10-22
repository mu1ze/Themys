alter table public.users
  add column if not exists country text,
  add column if not exists state text;

alter table public.scans
  add column if not exists jurisdiction_country text,
  add column if not exists jurisdiction_state text;
