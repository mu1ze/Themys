"use client";

import { useState } from "react";

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

export function ScanServiceIcon({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl: string | null;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card-hover)] sm:h-11 sm:w-11">
      {logoUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          width={28}
          height={28}
          className="h-5 w-5 object-contain sm:h-7 sm:w-7"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-5 w-5 items-center justify-center rounded bg-[var(--ds-accent)]/10 text-[10px] font-bold text-[var(--ds-accent)] sm:h-7 sm:w-7 sm:text-xs"
        >
          {initials(name)}
        </span>
      )}
    </span>
  );
}
