"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Settings2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Item<K extends string> = { key: K; label: string };

export function CustomizePopover<K extends string>({
  label,
  items,
  values,
  onChange,
  onReset,
  className,
}: {
  label: string;
  items: Item<K>[];
  values: Record<K, boolean>;
  onChange: (key: K, checked: boolean) => void;
  onReset: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const headingId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative inline-flex align-middle", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded-[8px] border border-[var(--ds-border)] bg-[var(--ds-card)] text-[var(--ds-text-dim)] transition hover:border-[var(--ds-border-hover)] hover:bg-[var(--ds-card-hover)] hover:text-[var(--ds-text-secondary)]"
        aria-label={label}
        aria-expanded={open}
        title="Customize"
      >
        <Settings2 className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-labelledby={headingId}
          className="absolute right-0 top-full z-30 mt-1.5 w-[220px] rounded-[12px] border border-[var(--ds-border)] bg-[var(--ds-card)] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
        >
          <p
            id={headingId}
            className="mb-2 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--ds-text-muted)]"
          >
            {label}
          </p>
          {items.map((item) => (
            <label
              key={item.key}
              className="flex min-h-9 cursor-pointer items-center gap-2 border-b border-[var(--ds-border)] py-1.5 text-[12px] text-[var(--ds-text-secondary)] last:border-b-0 hover:text-[var(--ds-text)]"
            >
              <input
                type="checkbox"
                checked={values[item.key]}
                onChange={(event) => onChange(item.key, event.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--ds-accent)]"
              />
              {item.label}
            </label>
          ))}
          <button
            type="button"
            onClick={onReset}
            className="mt-2 min-h-9 w-full border-t border-[var(--ds-border)] pt-2 text-left text-[11px] font-medium text-[var(--ds-accent)] hover:text-[var(--ds-text)]"
          >
            Reset to defaults
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function SectionGate({ show, children }: { show: boolean; children: ReactNode }) {
  if (!show) return null;
  return <>{children}</>;
}
