-- Cover foreign keys used by reservation cleanup and monitoring alert joins.
create index if not exists idx_credit_usage_reservations_credit_pack_id
  on public.credit_usage_reservations (credit_pack_id);

create index if not exists idx_monitoring_alerts_old_snapshot_id
  on public.monitoring_alerts (old_snapshot_id);

create index if not exists idx_monitoring_alerts_new_snapshot_id
  on public.monitoring_alerts (new_snapshot_id);
