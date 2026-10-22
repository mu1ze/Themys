"use client";

import { useId, useRef, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { useShowMore } from "@/components/interior/show-more";

const INSTANT = { duration: 0 } as const;
const DISCLOSE = { type: "spring", stiffness: 190, damping: 30, mass: 1 } as const;
const SMALL = { type: "spring", stiffness: 700, damping: 46, mass: 0.5 } as const;

export function ShowMore({
  children,
  moreLabel = "Show more",
  lessLabel = "Show less",
  label = "Details",
  lines = 3,
  maxHeight = 320,
  className = "",
}: {
  children: ReactNode;
  moreLabel?: string;
  lessLabel?: string;
  label?: string;
  lines?: number;
  maxHeight?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const regionId = useId();
  const regionRef = useRef<HTMLDivElement>(null);

  const { contentRef, open, toggle, height, expandable, capped, scrollable } =
    useShowMore({ lines, maxHeight });

  const press = () => {
    if (open) regionRef.current?.scrollTo({ top: 0 });
    toggle();
  };

  const veiled = expandable && (!open || scrollable);

  return (
    <div className={`text-[13.5px] leading-relaxed text-[var(--ds-text-secondary)] ${className}`}>
      <div className="relative">
        <motion.div
          ref={regionRef}
          id={regionId}
          role={scrollable ? "region" : undefined}
          aria-label={scrollable ? label : undefined}
          tabIndex={scrollable ? 0 : undefined}
          initial={false}
          animate={height === null ? {} : { height }}
          transition={reduced ? INSTANT : DISCLOSE}
          style={{
            maxHeight: height === null ? `${lines}lh` : undefined,
            overflowY: scrollable ? "auto" : "hidden",
            scrollbarGutter: capped ? "stable" : undefined,
          }}
          className="overflow-hidden overscroll-contain rounded-[var(--ds-radius-sm)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-accent)]"
        >
          <div ref={contentRef}>{children}</div>
        </motion.div>
        <motion.div
          aria-hidden
          initial={false}
          animate={{ opacity: veiled ? 1 : 0 }}
          transition={reduced ? INSTANT : SMALL}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-9 bg-gradient-to-t from-[var(--ds-card)] to-[var(--ds-card)]/0"
        />
      </div>
      <div className="mt-2 flex h-8 items-center">
        <button
          type="button"
          onClick={press}
          aria-expanded={open}
          aria-controls={regionId}
          className={`inline-flex h-8 select-none items-center gap-2 rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)] px-2.5 text-[12.5px] font-medium text-[var(--ds-text-secondary)] outline-none transition-colors hover:bg-[var(--ds-card-hover)] hover:text-[var(--ds-text)] focus-visible:ring-2 focus-visible:ring-[var(--ds-accent)] ${
            expandable ? "" : "pointer-events-none invisible"
          }`}
        >
          <span className="grid text-left">
            <motion.span
              aria-hidden={open}
              className="col-start-1 row-start-1"
              initial={false}
              animate={{ opacity: open ? 0 : 1 }}
              transition={reduced ? INSTANT : SMALL}
            >
              {moreLabel}
            </motion.span>
            <motion.span
              aria-hidden={!open}
              className="col-start-1 row-start-1"
              initial={false}
              animate={{ opacity: open ? 1 : 0 }}
              transition={reduced ? INSTANT : SMALL}
            >
              {lessLabel}
            </motion.span>
          </span>
          <motion.svg
            aria-hidden
            width="12"
            height="12"
            viewBox="0 0 256 256"
            fill="none"
            className="text-[var(--ds-text-muted)]"
            initial={false}
            animate={{ rotate: open ? 180 : 0 }}
            transition={reduced ? INSTANT : SMALL}
          >
            <polyline
              points="208 96 128 176 48 96"
              stroke="currentColor"
              strokeWidth="16"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.svg>
        </button>
      </div>
    </div>
  );
}
