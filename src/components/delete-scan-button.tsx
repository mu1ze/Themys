"use client";

import { useEffect, useId, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useHoldToConfirm } from "@/components/interior/hold-to-confirm";

type DeleteScanButtonProps = {
  scanId: string;
  iconOnly?: boolean;
  compact?: boolean;
  title?: string;
  label?: string;
  className?: string;
  afterDeleteHref?: string;
};

export function DeleteScanButton({
  scanId,
  iconOnly = false,
  compact = false,
  title,
  label,
  className,
  afterDeleteHref,
}: DeleteScanButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buttonLabel = label ?? "Delete scan";

  async function handleDelete() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/scans/${scanId}`, { method: "DELETE" });
      const payload = (await resp.json().catch(() => null)) as { error?: string } | null;
      if (!resp.ok) {
        throw new Error(payload?.error ?? "Unable to delete this scan");
      }
      if (afterDeleteHref) {
        window.location.href = afterDeleteHref;
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.error("[DeleteScan] failed:", err);
      setError(err instanceof Error ? err.message : "Unable to delete this scan");
      setLoading(false);
    }
  }

  return (
    <span className="relative inline-flex max-w-full flex-col items-end">
      <HoldToConfirmButton
        onConfirm={handleDelete}
        disabled={loading}
        iconOnly={iconOnly}
        compact={compact}
        title={title}
        label={buttonLabel}
        className={className}
      />
      {error ? (
        <span
          role="alert"
          className="mt-1 max-w-56 text-right text-[11px] leading-4 text-[var(--ds-danger)]"
        >
          {error}
        </span>
      ) : null}
    </span>
  );
}

function HoldToConfirmButton({
  onConfirm,
  disabled,
  iconOnly,
  compact,
  title,
  label,
  className,
}: {
  onConfirm: () => void;
  disabled: boolean;
  iconOnly: boolean;
  compact: boolean;
  title?: string;
  label: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const hintId = useId();

  const { bind, phase, reset } = useHoldToConfirm({
    onConfirm,
    duration: 1400,
    disabled,
  });

  const committed = phase === "committed";
  const swept = useMotionValue(0);
  const clipPath = useTransform(swept, (v) => `inset(0 ${(1 - v) * 100}% 0 0)`);
  const defaultClassName = cn(
    "relative isolate inline-grid select-none place-items-center overflow-hidden rounded-[var(--ds-radius-sm)] bg-[var(--ds-danger-bg)] text-sm font-medium text-[var(--ds-danger)] transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-danger)]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70",
    iconOnly ? "h-9 w-9" : compact ? "h-10 px-4" : "h-11 gap-2 px-5",
  );

  useEffect(() => {
    if (phase !== "committed") return;
    const back = setTimeout(reset, 1600);
    return () => clearTimeout(back);
  }, [phase, reset]);

  useEffect(() => {
    if (reduced) {
      swept.set(phase === "holding" || phase === "committed" ? 1 : 0);
      return;
    }
    if (phase === "committed") {
      const controls = animate(swept, 1, { duration: 0.12, ease: "linear" });
      return () => controls.stop();
    }
    const from = swept.get();
    if (phase === "holding") {
      const controls = animate(swept, 1, {
        duration: (1400 * (1 - from)) / 1000,
        ease: "linear",
      });
      return () => controls.stop();
    }
    const controls = animate(swept, 0, {
      duration: (1400 * from) / 2.5 / 1000,
      ease: [0.23, 1, 0.32, 1],
    });
    return () => controls.stop();
  }, [phase, reduced, swept]);

  return (
    <button
      type="button"
      aria-disabled={disabled || committed}
      aria-describedby={hintId}
      title={title ?? label}
      aria-label={label}
      data-delete-scan-button
      {...bind}
      style={{
        touchAction: "manipulation",
        WebkitTouchCallout: "none",
        borderColor: "var(--ds-danger)",
        borderWidth: "1px",
        position: "relative",
        isolation: "isolate",
        overflow: "hidden",
        contain: "paint",
      }}
      className={
        className
          ? cn(className, "relative isolate overflow-hidden")
          : defaultClassName
      }
    >
      <span className="col-start-1 row-start-1 grid">
        <motion.span
          initial={false}
          animate={{ opacity: committed ? 0 : 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 34, mass: 0.8 }}
          className="col-start-1 row-start-1 flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <Trash2 className="h-4 w-4" />
          {iconOnly ? <span className="sr-only">{label}</span> : <span>{label}</span>}
        </motion.span>
        <motion.span
          initial={false}
          animate={{ opacity: committed ? 1 : 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 34, mass: 0.8 }}
          className="col-start-1 row-start-1 flex items-center justify-center gap-1.5 whitespace-nowrap"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2.5 6.4 4.7 8.6 9.5 3.5" />
          </svg>
          {iconOnly ? <span className="sr-only">Deleted</span> : <span>Deleted</span>}
        </motion.span>
      </span>

      <motion.span
        aria-hidden
        style={{ clipPath }}
        className="absolute inset-0 grid place-items-center bg-[var(--ds-danger)] px-4 text-white"
      >
        <span className="col-start-1 row-start-1 grid">
          <motion.span
            initial={false}
            animate={{ opacity: committed ? 0 : 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 34, mass: 0.8 }}
            className="col-start-1 row-start-1 flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Trash2 className="h-4 w-4" />
            {iconOnly ? <span className="sr-only">{label}</span> : <span>{label}</span>}
          </motion.span>
          <motion.span
            initial={false}
            animate={{ opacity: committed ? 1 : 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 34, mass: 0.8 }}
            className="col-start-1 row-start-1 flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2.5 6.4 4.7 8.6 9.5 3.5" />
            </svg>
            {iconOnly ? <span className="sr-only">Deleted</span> : <span>Deleted</span>}
          </motion.span>
        </span>
      </motion.span>

      <span id={hintId} className="sr-only">
        Press and hold to confirm deletion. Releasing early cancels and nothing happens.
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {committed ? "Deleted" : ""}
      </span>
    </button>
  );
}
