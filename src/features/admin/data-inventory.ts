export const d1Datasets = [
  { table: "users", label: "Accounts", area: "Customers" },
  { table: "scans", label: "Reviews", area: "Reviews" },
  { table: "clauses", label: "Clauses", area: "Reviews" },
  { table: "full_extraction_sections", label: "Extraction sections", area: "Reviews" },
  { table: "full_extraction_points", label: "Extraction points", area: "Reviews" },
  { table: "clause_compliance_tags", label: "Compliance tags", area: "Reviews" },
  { table: "scan_jev_diagnostics", label: "Scan diagnostics", area: "Reviews" },
  { table: "invoices", label: "Invoices", area: "Billing" },
  { table: "stripe_events", label: "Stripe events", area: "Billing" },
  { table: "credit_packs", label: "Credit packs", area: "Billing" },
  { table: "purchase_acceptances", label: "Purchase acknowledgements", area: "Billing" },
  { table: "billing_cases", label: "Billing cases", area: "Billing" },
  { table: "billing_case_events", label: "Case history", area: "Billing" },
  { table: "payment_refunds", label: "Refunds", area: "Billing" },
  { table: "payment_disputes", label: "Disputes", area: "Billing" },
  { table: "billing_notifications", label: "Billing notices", area: "Billing" },
  { table: "usage_events", label: "Product events", area: "Usage" },
  { table: "usage_reservations", label: "Usage reservations", area: "Usage" },
  { table: "credit_usage_reservations", label: "Credit reservations", area: "Usage" },
  { table: "api_usage_logs", label: "API requests", area: "Developer API" },
  { table: "api_keys", label: "API keys", area: "Developer API" },
  { table: "api_rate_limits", label: "API rate-limit buckets", area: "Developer API" },
  { table: "monitoring_subscriptions", label: "Monitored documents", area: "Monitoring" },
  { table: "tos_snapshots", label: "Monitoring snapshots", area: "Monitoring" },
  { table: "monitoring_alerts", label: "Monitoring alerts", area: "Monitoring" },
  { table: "tos_cache", label: "Document cache", area: "Caches and reference" },
  { table: "explanations_cache", label: "Explanation cache", area: "Caches and reference" },
  { table: "regulations", label: "Regulations", area: "Caches and reference" },
  { table: "blocklist_items", label: "Account watch terms", area: "Customers" },
  { table: "docs_feedback", label: "Documentation feedback", area: "Customers" },
] as const;

export type D1Dataset = (typeof d1Datasets)[number];
export type D1InventoryRow = D1Dataset & {
  available: boolean;
  count: number | null;
};
