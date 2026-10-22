"use client";

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { FileSearch, Shield, Sparkles, Scale } from "lucide-react";

import { useTabs, type TabItem } from "@/components/interior/tabs";
import { cn } from "@/lib/cn";

const INDICATOR = { type: "spring", stiffness: 620, damping: 42, mass: 0.35 } as const;
const PANEL = { type: "spring", stiffness: 460, damping: 38, mass: 0.8 } as const;

type ResultsTabsProps = {
  suggestionsCount: number;
  suggestionsContent: ReactNode;
  flaggedCount: number;
  fullExtractionContent: ReactNode;
  flaggedContent: ReactNode;
  complianceContent?: ReactNode;
  hasCompliance?: boolean;
};

export function ResultsTabs({
  suggestionsCount,
  suggestionsContent,
  flaggedCount,
  fullExtractionContent,
  flaggedContent,
  complianceContent,
  hasCompliance = false,
}: ResultsTabsProps) {
  const reduced = useReducedMotion();

  const items = useMemo<TabItem[]>(
    () => [
      { value: "suggestions", label: "Actionable Insights" },
      { value: "full", label: "Full Extraction" },
      { value: "flagged", label: "Flagged" },
      ...(hasCompliance ? [{ value: "compliance", label: "Compliance" }] : []),
    ],
    [hasCompliance]
  );

  const tabs = useTabs({
    items,
    defaultValue: "suggestions",
  });

  const rowRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [plateau, setPlateau] = useState({ x: 0, width: 0, ready: false });

  const selectedIndex = items.findIndex((item) => item.value === tabs.value);

  useLayoutEffect(() => {
    const node = tabRefs.current[selectedIndex];
    if (!node) return;

    const read = () => {
      setPlateau((prev) =>
        prev.x === node.offsetLeft &&
        prev.width === node.offsetWidth &&
        prev.ready
          ? prev
          : { x: node.offsetLeft, width: node.offsetWidth, ready: true }
      );
    };

    read();
    const row = rowRef.current;
    if (!row) return;
    const observer = new ResizeObserver(read);
    observer.observe(row);
    return () => observer.disconnect();
  }, [selectedIndex, items]);

  const iconFor = (value: string) => {
    if (value === "suggestions") return <FileSearch className="h-4 w-4" />;
    if (value === "full") return <Sparkles className="h-4 w-4" />;
    if (value === "flagged") return <Shield className="h-4 w-4" />;
    return <Scale className="h-4 w-4" />;
  };

  const iconColor = (value: string) => {
    if (value === "suggestions") return "text-amber-500";
    if (value === "full") return "text-violet-500";
    if (value === "flagged") return "text-rose-500";
    return "text-blue-500";
  };

  return (
    <div className="space-y-6">
      {/* Tab Bar */}
      <div
        {...tabs.tabListProps}
        ref={rowRef}
        aria-label="Scan results"
        className="relative flex items-center gap-1 overflow-x-auto border-b border-[var(--ds-border)] pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <motion.span
          layout
          aria-hidden
          style={{
            borderRadius: 8,
            left: plateau.x,
            width: plateau.width,
            opacity: plateau.ready ? 1 : 0,
          }}
          className="absolute bottom-2 top-0 bg-[var(--ds-card-hover)]"
          transition={reduced ? { duration: 0 } : INDICATOR}
        />

        {items.map((item, index) => {
          const selected = item.value === tabs.value;
          return (
            <button
              key={item.value}
              {...tabs.getTabProps(item, index)}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              className={cn(
                "relative flex min-w-[112px] flex-none items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-medium transition-colors duration-200 sm:min-w-0 sm:flex-1",
                selected
                  ? "text-[var(--ds-text)]"
                  : "text-[var(--ds-text-muted)] hover:text-[var(--ds-text-secondary)]"
              )}
            >
              <span className={cn("transition-colors", selected ? iconColor(item.value) : "text-[var(--ds-text-dim)]")}>
                {iconFor(item.value)}
              </span>
              <span className="relative grid place-items-center leading-[1.4]">
                <span aria-hidden className="invisible col-start-1 row-start-1 font-medium">
                  {item.label}
                </span>
                <span className={cn("col-start-1 row-start-1", selected && "font-medium")}>
                  {item.label}
                </span>
              </span>
              {item.value === "suggestions" && suggestionsCount > 0 && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium",
                    selected
                      ? "bg-amber-100 text-amber-700"
                      : "bg-[var(--ds-card-hover)] text-[var(--ds-text-secondary)]"
                  )}
                >
                  {suggestionsCount}
                </span>
              )}
              {item.value === "flagged" && flaggedCount > 0 && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium",
                    selected
                      ? "bg-rose-100 text-rose-700"
                      : "bg-[var(--ds-card-hover)] text-[var(--ds-text-secondary)]"
                  )}
                >
                  {flaggedCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <motion.div
        key={tabs.value}
        custom={tabs.direction}
        {...tabs.getPanelProps(tabs.value)}
        initial={reduced ? false : { opacity: 0, x: tabs.direction * 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={reduced ? { duration: 0 } : PANEL}
      >
        {tabs.value === "suggestions" && suggestionsContent}
        {tabs.value === "full" && fullExtractionContent}
        {tabs.value === "flagged" && flaggedContent}
        {tabs.value === "compliance" && complianceContent}
      </motion.div>
    </div>
  );
}
