"use client";

import { useId, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronDown, X } from "lucide-react";

import { useCollapsibleBanner } from "@/components/interior/collapsible-banner";
import { cn } from "@/lib/cn";

const INSTANT = { duration: 0 } as const;
const DISCLOSE = { type: "spring", stiffness: 190, damping: 30, mass: 1 } as const;
const NUDGE = { type: "spring", stiffness: 700, damping: 46, mass: 0.5 } as const;
const EASE = [0.23, 1, 0.32, 1] as const;

export function CollapsibleBanner({
  title,
  description,
  children,
  action,
  icon,
  dismissible = true,
  defaultState = "open",
  onDismiss,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  dismissible?: boolean;
  defaultState?: "open" | "folded" | "dismissed";
  onDismiss?: () => void;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const uid = useId();
  const bodyId = `${uid}-body`;
  const titleId = `${uid}-title`;

  const { state, open, dismissed, toggle, fold, dismiss } = useCollapsibleBanner({
    defaultState,
    onDismiss,
  });

  const hasBody = Boolean(description || children || action);

  const disclose = reduced
    ? INSTANT
    : {
        height: DISCLOSE,
        opacity: { duration: 0.14, ease: EASE, delay: open ? 0.05 : 0 },
        y: DISCLOSE,
      };

  return (
    <>
      <motion.div
        initial={false}
        animate={{ height: dismissed ? 0 : "auto", opacity: dismissed ? 0 : 1 }}
        transition={
          reduced
            ? INSTANT
            : { height: DISCLOSE, opacity: { duration: 0.14, ease: EASE } }
        }
        style={{ overflow: "hidden" }}
        className="rounded-[var(--ds-radius-md)]"
      >
        <div
          role="region"
          aria-labelledby={titleId}
          className={cn(
            "rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-card)] shadow-sm",
            className
          )}
        >
          <div className="flex items-center gap-2.5 p-2.5">
            {icon ? (
              <span
                aria-hidden="true"
                className="grid size-[26px] shrink-0 place-items-center rounded-[var(--ds-radius-sm)] bg-[var(--ds-card-hover)] text-[var(--ds-text-muted)]"
              >
                {icon}
              </span>
            ) : null}

            {hasBody ? (
              <button
                type="button"
                onClick={toggle}
                onKeyDown={(e) => {
                  if (e.key !== "Escape" || !open) return;
                  e.stopPropagation();
                  fold();
                }}
                aria-expanded={open}
                aria-controls={bodyId}
                className="group flex min-w-0 flex-1 items-center gap-2 rounded-[var(--ds-radius-sm)] text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-accent)]"
              >
                <span
                  id={titleId}
                  className="min-w-0 flex-1 truncate text-[13px] font-medium leading-5 text-[var(--ds-text)]"
                >
                  {title}
                </span>
                <motion.span
                  aria-hidden="true"
                  className="flex shrink-0 text-[var(--ds-text-muted)] group-hover:text-[var(--ds-text)]"
                  initial={false}
                  animate={{ rotate: open ? 180 : 0 }}
                  transition={reduced ? INSTANT : NUDGE}
                >
                  <ChevronDown className="h-4 w-4" />
                </motion.span>
              </button>
            ) : (
              <span
                id={titleId}
                className="min-w-0 flex-1 truncate text-[13px] font-medium leading-5 text-[var(--ds-text)]"
              >
                {title}
              </span>
            )}

            {dismissible ? (
              <button
                type="button"
                onClick={dismiss}
                aria-label="Dismiss notice"
                className="grid size-[26px] shrink-0 place-items-center rounded-[var(--ds-radius-sm)] text-[var(--ds-text-muted)] transition-colors duration-150 hover:bg-[var(--ds-card-hover)] hover:text-[var(--ds-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-accent)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {hasBody ? (
            <motion.div
              id={bodyId}
              inert={!open}
              initial={false}
              animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
              transition={disclose}
              style={{ overflow: "hidden" }}
            >
              <motion.div
                initial={false}
                animate={{ y: open ? 0 : -6 }}
                transition={reduced ? INSTANT : DISCLOSE}
                className="pb-2.5 pl-[46px] pr-2.5"
              >
                {description ? (
                  <p className="text-[12.5px] leading-relaxed text-[var(--ds-text-muted)]">
                    {description}
                  </p>
                ) : null}
                {children}
                {action ? <div className="mt-2">{action}</div> : null}
              </motion.div>
            </motion.div>
          ) : null}
        </div>
      </motion.div>
      <span role="status" aria-live="polite" className="sr-only">
        {state === "dismissed" ? "Notice dismissed." : ""}
      </span>
    </>
  );
}
