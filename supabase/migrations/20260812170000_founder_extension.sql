alter table public.scans
  add column if not exists decision text not null default 'open';

alter table public.scans
  drop constraint if exists scans_decision_check;

alter table public.scans
  add constraint scans_decision_check
  check (decision in ('open', 'sign', 'negotiate', 'walk_away'));

alter table public.clauses
  add column if not exists recommended_action text;

alter table public.users
  add column if not exists playbook_id text not null default 'consumer_app';

alter table public.users
  drop constraint if exists users_playbook_id_check;

alter table public.users
  add constraint users_playbook_id_check
  check (playbook_id in ('consumer_app', 'saas_vendor', 'contractor'));

alter table public.scans drop constraint if exists scans_source_check;
alter table public.scans
  add constraint scans_source_check
  check (source in ('web', 'extension', 'paste', 'upload'));

create index if not exists idx_scans_user_decision
  on public.scans (user_id, decision)
  where decision = 'open';
