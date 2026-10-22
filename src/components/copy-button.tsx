"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check, Copy } from "lucide-react";

import { useCopyToClipboard } from "@/components/interior/copy-button";
import { cn } from "@/lib/cn";

const INSTANT = { duration: 0 } as const;
const CROSSFADE = { type: "spring", stiffness: 260, damping: 34, mass: 0.8 } as const;

export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  className,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const { copy, status } = useCopyToClipboard();
  const reduced = useReducedMotion();
  const fade = reduced ? INSTANT : CROSSFADE;
  const copied = status === "copied";

  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={() => {
        void copy(value);
      }}
      whileTap={reduced ? undefined : { y: 1 }}
      transition={CROSSFADE}
      className={cn(
        "inline-flex h-9 select-none items-center gap-1.5 rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)] px-3 text-xs font-semibold text-[var(--ds-text-muted)] transition-colors hover:bg-[var(--ds-card-hover)] hover:text-[var(--ds-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-accent)]",
        className
      )}
    >
      <span className="grid size-4 shrink-0 place-items-center" aria-hidden="true">
        <motion.span
          className="col-start-1 row-start-1"
          initial={false}
          animate={{ opacity: copied ? 0 : 1, scale: copied ? 0.92 : 1 }}
          transition={fade}
        >
          <Copy className="h-3.5 w-3.5" />
        </motion.span>
        <motion.span
          className="col-start-1 row-start-1 text-[var(--ds-success)]"
          initial={false}
          animate={{ opacity: copied ? 1 : 0, scale: copied ? 1 : 0.92 }}
          transition={fade}
        >
          <Check className="h-3.5 w-3.5" />
        </motion.span>
      </span>

      <span aria-hidden="true" className="relative grid">
        <motion.span
          className="col-start-1 row-start-1 whitespace-nowrap"
          initial={false}
          animate={copied ? { opacity: 0, y: 3, filter: "blur(3px)" } : { opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={fade}
        >
          {label}
        </motion.span>
        <motion.span
          className="col-start-1 row-start-1 whitespace-nowrap text-[var(--ds-success)]"
          initial={false}
          animate={copied ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: 3, filter: "blur(3px)" }}
          transition={fade}
        >
          {copiedLabel}
        </motion.span>
      </span>

      <span role="status" aria-live="polite" className="sr-only">
        {copied ? copiedLabel : ""}
      </span>
    </motion.button>
  );
}
