import { Home, ScanSearch } from "lucide-react"
import { ButtonLink } from "@/components/ui"

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center px-4 text-center">
      {/* Shield icon */}
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-primary">
          <path
            d="M12 2L19 5.5V13C19 17.5 15.5 21 12 22C8.5 21 5 17.5 5 13V5.5L12 2Z"
            fill="currentColor"
            opacity="0.15"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          <line x1="12" y1="7" x2="12" y2="16" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="8.5" y1="9" x2="15.5" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M8.5 9L7.5 13L9.5 13Z" fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round" />
          <path d="M15.5 9L14.5 12L16.5 12Z" fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round" />
          <polygon points="12,16 11,17.5 13,17.5" fill="currentColor" opacity="0.8" />
        </svg>
      </div>

      <h1 className="mb-2 text-4xl font-bold tracking-tight text-[var(--ds-text)]">
        Page not found
      </h1>
      <p className="mb-8 max-w-md text-lg text-[var(--ds-text-muted)]">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>

      <div className="flex items-center gap-3">
        <ButtonLink href="/" variant="solid" icon={Home}>
          Go home
        </ButtonLink>
        <ButtonLink href="/scan/new" variant="ghost" icon={ScanSearch}>
          Start scanning
        </ButtonLink>
      </div>
    </div>
  )
}
