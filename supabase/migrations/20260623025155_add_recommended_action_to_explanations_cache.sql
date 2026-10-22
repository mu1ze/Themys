alter table public.explanations_cache
  add column if not exists recommended_action text;
