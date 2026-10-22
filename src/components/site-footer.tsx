const FooterShield = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M12 2L19 5.5V13C19 17.5 15.5 21 12 22C8.5 21 5 17.5 5 13V5.5L12 2Z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="0.5"/>
    <line x1="12" y1="7" x2="12" y2="16" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="8.5" y1="9" x2="15.5" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M8.5 9L7.5 13L9.5 13Z" fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round"/>
    <path d="M15.5 9L14.5 12L16.5 12Z" fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round"/>
    <polygon points="12,16 11,17.5 13,17.5" fill="currentColor" opacity="0.8"/>
  </svg>
)

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--ds-border)] bg-[var(--ds-card)] py-8">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--ds-accent)] text-[var(--primary-foreground)]">
            <FooterShield />
          </div>
          <span className="text-sm font-semibold text-[var(--ds-text)]">Themys</span>
        </div>
        <p className="text-[15px] text-[var(--ds-text-muted)]">&copy; 2026 Themys. All rights reserved. Chrome extension coming soon.</p>
        <div className="flex gap-6">
          <a href="/features" className="text-sm text-[var(--ds-text-muted)] hover:text-[var(--ds-text)]">Features</a>
          <a href="https://docs.themys.ca/legal#privacy" className="text-sm text-[var(--ds-text-muted)] hover:text-[var(--ds-text)]">Privacy</a>
          <a href="https://docs.themys.ca/legal#terms" className="text-sm text-[var(--ds-text-muted)] hover:text-[var(--ds-text)]">Terms</a>
          <a href="mailto:admin@themys.ca" className="text-sm text-[var(--ds-text-muted)] hover:text-[var(--ds-text)]">Contact</a>
        </div>
      </div>
    </footer>
  )
}
