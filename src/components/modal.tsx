"use client";

import { useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";

import { useModal } from "@/components/interior/modal";
import { cn } from "@/lib/cn";

const EASE = [0.23, 1, 0.32, 1] as const;
const LEAVE = [0.4, 0, 1, 1] as const;
const SURFACE = { type: "spring", stiffness: 420, damping: 36, mass: 0.9 } as const;

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();

  const { target, titleId, descriptionId, overlayProps, panelProps } = useModal({
    open,
    onClose,
  });

  const variants = useMemo(() => {
    if (reduced) {
      return {
        backdrop: {
          closed: { opacity: 0 },
          open: { opacity: 1, transition: { duration: 0 } },
          gone: { opacity: 0, transition: { duration: 0 } },
        },
        panel: {
          closed: { opacity: 0 },
          open: { opacity: 1, transition: { duration: 0 } },
          gone: { opacity: 0, transition: { duration: 0 } },
        },
      };
    }
    return {
      backdrop: {
        closed: { opacity: 0 },
        open: { opacity: 1, transition: { duration: 0.2, ease: EASE } },
        gone: { opacity: 0, transition: { duration: 0.15, ease: LEAVE } },
      },
      panel: {
        closed: { opacity: 0, scale: 0.96, y: 12 },
        open: {
          opacity: 1,
          scale: 1,
          y: 0,
          transition: { ...SURFACE, opacity: { duration: 0.16, ease: EASE } },
        },
        gone: {
          opacity: 0,
          scale: 0.98,
          y: 6,
          transition: { duration: 0.15, ease: LEAVE },
        },
      },
    };
  }, [reduced]);

  if (!target) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="modal"
          {...overlayProps}
          initial="closed"
          animate="open"
          exit="gone"
          variants={{ closed: {}, open: {}, gone: {} }}
          className="fixed inset-0 z-[80] grid place-items-center p-0 sm:p-6"
        >
          <motion.div
            aria-hidden="true"
            variants={variants.backdrop}
            style={{ touchAction: "none" }}
            className="absolute inset-0 bg-[var(--ds-scrim)] backdrop-blur-[2px]"
          />
          <motion.div
            {...panelProps}
            aria-describedby={description ? descriptionId : undefined}
            variants={variants.panel}
            className={cn(
              "relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[var(--ds-radius-lg)] border border-[var(--ds-border)] bg-[var(--ds-card)] shadow-[var(--ds-shadow-overlay)] outline-none sm:rounded-[var(--ds-radius-lg)]",
              className
            )}
          >
            <header className="flex items-start justify-between gap-6 border-b border-[var(--ds-border)] px-5 py-4 sm:px-6">
              <div className="min-w-0">
                {eyebrow ? <div className="mb-2 flex flex-wrap items-center gap-2">{eyebrow}</div> : null}
                <h2 id={titleId} className="text-lg font-medium tracking-[-0.02em] text-[var(--ds-text)]">{title}</h2>
                {description ? <p id={descriptionId} className="mt-1 text-sm leading-6 text-[var(--ds-text-muted)]">{description}</p> : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ds-radius-sm)] text-[var(--ds-text-muted)] transition hover:bg-[var(--ds-card-hover)] hover:text-[var(--ds-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-accent)]"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
            {footer ? <footer className="border-t border-[var(--ds-border)] px-5 py-4 sm:px-6">{footer}</footer> : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    target
  );
}
