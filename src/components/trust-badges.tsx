const badges = ["Secured by Clerk", "Powered by Stripe", "Hosted on Cloudflare"];

export function TrustBadges() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-6 py-6 text-[var(--ds-text-dim)] sm:gap-10">
      {badges.map((label) => <span key={label} className="text-sm font-medium">{label}</span>)}
    </div>
  );
}
