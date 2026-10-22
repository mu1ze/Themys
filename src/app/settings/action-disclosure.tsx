import { ChevronDown } from "lucide-react"

export function SettingsActionDisclosure({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <details className="group rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[var(--ds-radius-sm)] px-4 py-3.5 outline-none transition hover:bg-[var(--ds-card-hover)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ds-accent)] marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold text-[var(--ds-text)]">{label}</span>
          {description ? (
            <span className="mt-1 block text-[12px] leading-5 text-[var(--ds-text-muted)]">
              {description}
            </span>
          ) : null}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[var(--ds-text-muted)] transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-[var(--ds-border)] px-4 py-4">{children}</div>
    </details>
  )
}
