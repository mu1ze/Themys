/**
 * First-party product-funnel event tracker (client-safe).
 *
 * Fires lightweight, fire-and-forget events to `/api/events`, which persists
 * them into the existing `usage_events` table (service-role write). This is the
 * conversion/instrumentation layer described in THEMYS_Conversion_Validation_Plan.md
 * §3–§4 — deliberately dependency-free (no PostHog/Mixpanel required) so funnel
 * and "inability" (limit-hit) signals are observable from day one.
 *
 * Events are only meaningful for signed-in users (the endpoint requires Clerk
 * auth and derives the actor from the session); anonymous calls are dropped
 * server-side. Top-of-funnel visitor tracking still needs a real analytics SDK.
 */

export type FunnelEvent =
  | "paywall_view"
  | "pricing_view"
  | "checkout_start"
  | "cta_click"
  | "decision_set"
  | "contract_upload"
  | "playbook_used"
  | "monitor_email_on"
  | "extension_cta_click"

type EventProps = Record<string, string | number | boolean | null>

export function trackEvent(event: FunnelEvent, props?: EventProps): void {
  if (typeof navigator === "undefined") return
  try {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, props: props ?? {} }),
      keepalive: true,
    }).catch(() => undefined)
  } catch {
    // Analytics must never break the product flow.
  }
}
