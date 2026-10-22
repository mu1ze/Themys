"use client";

import { useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/cn";
import { useAccordion, useAutoHeight } from "@/components/interior/accordion";

const DISCLOSE = {
  type: "spring",
  stiffness: 480,
  damping: 40,
  mass: 0.6,
} as const;

const CHEVRON = {
  type: "spring",
  stiffness: 700,
  damping: 46,
  mass: 0.5,
} as const;

type Inertable = HTMLElement & { inert?: boolean };

export type ResultAccordionItem = {
  id: string;
  title: React.ReactNode;
  summary?: React.ReactNode;
  meta?: React.ReactNode;
  content: React.ReactNode;
};

export function ResultAccordion({
  items,
  onOpenChange,
}: {
  items: readonly ResultAccordionItem[];
  onOpenChange?: (id: string | null) => void;
}) {
  const reduced = Boolean(useReducedMotion());
  const { isOpen, headerProps, panelProps } = useAccordion({
    items,
    type: "single",
    onOpenChange: (open) => onOpenChange?.(open[0] ?? null),
  });

  return (
    <div className="grid gap-2.5">
      {items.map((item) => (
        <ResultAccordionRow
          key={item.id}
          item={item}
          open={isOpen(item.id)}
          reduced={reduced}
          header={headerProps(item.id)}
          panel={panelProps(item.id)}
        />
      ))}
    </div>
  );
}

function ResultAccordionRow({
  item,
  open,
  reduced,
  header,
  panel,
}: {
  item: ResultAccordionItem;
  open: boolean;
  reduced: boolean;
  header: ReturnType<ReturnType<typeof useAccordion>["headerProps"]>;
  panel: ReturnType<ReturnType<typeof useAccordion>["panelProps"]>;
}) {
  const { ref, height, ready } = useAutoHeight();

  useEffect(() => {
    const element = ref.current as Inertable | null;
    if (!element) return;
    element.inert = !open;
    return () => {
      element.inert = false;
    };
  }, [ref, open]);

  return (
    <article className={cn(
      "min-w-0 overflow-hidden rounded-[14px] border bg-[var(--ds-card)] transition-colors",
      open ? "border-[var(--ds-border-hover)]" : "border-[var(--ds-border)]",
    )}>
      <h3>
        <button
          {...header}
          className="flex w-full min-w-0 items-start gap-3 px-4 py-3.5 text-left outline-none transition hover:bg-[var(--ds-card-hover)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ds-accent)]"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold leading-5 text-[var(--ds-text)] sm:text-[14px]">
              {item.title}
            </span>
            {item.summary ? (
              <span className="mt-1 block font-[family-name:var(--ds-doc-font)] text-[12px] italic leading-5 text-[var(--ds-text-muted)] sm:text-[13px]">
                {item.summary}
              </span>
            ) : null}
          </span>
          {item.meta ? <span className="max-w-[104px] shrink-0 truncate pt-0.5 text-right text-[11px] text-[var(--ds-text-muted)]">{item.meta}</span> : null}
          <motion.svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="mt-1 shrink-0 text-[var(--ds-text-dim)]"
            initial={false}
            animate={{ rotate: open ? 180 : 0 }}
            transition={reduced ? { duration: 0 } : CHEVRON}
          >
            <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </motion.svg>
        </button>
      </h3>
      <motion.div
        initial={false}
        animate={ready ? { height: open ? height : 0 } : {}}
        transition={reduced ? { duration: 0 } : DISCLOSE}
        style={{ overflow: "hidden", height: ready ? undefined : open ? "auto" : 0 }}
      >
        <div {...panel} ref={ref} className="border-t border-[var(--ds-border)] bg-[var(--ds-bg)]/55 px-4 py-4">
          <motion.div
            initial={false}
            animate={{ opacity: open ? 1 : 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.16 }}
          >
            {item.content}
          </motion.div>
        </div>
      </motion.div>
    </article>
  );
}
