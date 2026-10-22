"use client"

import { useState } from "react"

export function DomainFavicon({
  domain,
  size = 40,
  className,
}: {
  domain: string
  size?: number
  className?: string
}) {
  const [error, setError] = useState(false)

  if (error) return null

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      alt=""
      width={size}
      height={size}
      className={className ?? "rounded-xl border border-[var(--ds-border)] bg-[var(--ds-card-hover)] shrink-0"}
      onError={() => setError(true)}
    />
  )
}
