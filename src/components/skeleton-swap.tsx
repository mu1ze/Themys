"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { useSkeletonSwap } from "@/components/interior/skeleton-swap";

const CROSSFADE = { type: "spring", stiffness: 260, damping: 34, mass: 0.8 } as const;

function widthFor(index: number, total: number): number {
  const widths = [100, 92, 84, 76, 68, 60];
  return widths[Math.min(index, widths.length - 1)];
}

export function SkeletonSwap({
  ready,
  children,
  lines = 3,
  lineHeight = 21,
  barHeight = 9,
  reserve,
  delay = 120,
  minVisible = 380,
  label,
  skeleton,
  className = "",
}: {
  ready: boolean;
  children: ReactNode;
  lines?: number;
  lineHeight?: number;
  barHeight?: number;
  reserve?: number;
  delay?: number;
  minVisible?: number;
  label?: string;
  skeleton?: ReactNode;
  className?: string;
}) {
  const { showSkeleton } = useSkeletonSwap({ ready, delay, minVisible });
  const reduced = useReducedMotion();

  const shell = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);

  const box = reserve ?? lines * lineHeight;

  useEffect(() => {
    const el = shell.current;
    const inner = body.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const check = () => setScrollable(el.scrollHeight - el.clientHeight > 1);
    check();

    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (inner) ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={shell}
      aria-busy={!ready}
      aria-label={label}
      tabIndex={scrollable ? 0 : undefined}
      style={{ height: box }}
      className={`relative grid overflow-y-auto overscroll-contain text-[var(--ds-text)] ${className}`}
    >
      <motion.div
        ref={body}
        className="col-start-1 row-start-1 min-w-0"
        initial={false}
        animate={
          reduced
            ? { opacity: showSkeleton ? 0 : 1 }
            : {
                opacity: showSkeleton ? 0 : 1,
                scale: showSkeleton ? 0.99 : 1,
                filter: showSkeleton ? "blur(4px)" : "blur(0px)",
              }
        }
        transition={reduced ? { duration: 0 } : CROSSFADE}
        style={{
          transformOrigin: "top left",
          pointerEvents: showSkeleton ? "none" : undefined,
        }}
      >
        {children}
      </motion.div>

      <AnimatePresence initial={false}>
        {showSkeleton ? (
          <motion.div
            key="skeleton"
            aria-hidden
            className="pointer-events-none col-start-1 row-start-1 w-full self-start"
            initial={reduced ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, filter: "blur(3px)" }}
            transition={reduced ? { duration: 0 } : CROSSFADE}
          >
            {skeleton ?? (
              <div className="w-full">
                {Array.from({ length: lines }, (_, i) => (
                  <div
                    key={i}
                    className="flex items-center"
                    style={{ height: lineHeight }}
                  >
                    <div
                      className="rounded-[5px] bg-[var(--ds-card-hover)]"
                      style={{
                        height: barHeight,
                        width: `${widthFor(i, lines)}%`,
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {label ? (
        <span role="status" className="sr-only">
          {ready ? `${label} loaded` : ""}
        </span>
      ) : null}
    </div>
  );
}
