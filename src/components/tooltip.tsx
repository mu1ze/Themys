"use client";

import {
  cloneElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { useTooltip } from "@/components/interior/tooltip-group";
import { cn } from "@/lib/cn";

const LEAVE = [0.4, 0, 1, 1] as const;
const RISE = { type: "spring", stiffness: 480, damping: 32, mass: 0.7 } as const;
const WARM = { type: "spring", stiffness: 620, damping: 40, mass: 0.6 } as const;
const GLIDE = { type: "spring", stiffness: 520, damping: 40, mass: 0.8 } as const;
const SWAP = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 } as const;

type TriggerChild = ReactElement<
  React.HTMLAttributes<HTMLElement> & { "aria-describedby"?: string }
>;

type TooltipSide = "top" | "bottom" | "left" | "right";

function chain<E>(
  theirs: ((event: E) => void) | undefined,
  ours: (event: E) => void,
) {
  return (event: E) => {
    theirs?.(event);
    ours(event);
  };
}

function TooltipBubble({
  label,
  tooltipId,
  seat,
  open,
  skipped,
  travel,
  side,
  reduced,
  contentClassName,
  style,
  className,
}: {
  label: ReactNode;
  tooltipId: string;
  seat: string;
  open: boolean;
  skipped: boolean;
  travel: number;
  side: TooltipSide;
  reduced: boolean | null;
  contentClassName: string;
  style?: CSSProperties;
  className?: string;
}) {
  const lift = side === "top" ? 7 : side === "bottom" ? -7 : 0;
  const slide = side === "right" ? 7 : side === "left" ? -7 : 0;
  const isHorizontal = side === "left" || side === "right";
  const transformOrigin =
    side === "top"
      ? "50% 100%"
      : side === "bottom"
        ? "50% 0%"
        : side === "right"
          ? "0% 50%"
          : "100% 50%";

  return (
    <motion.span
      role="tooltip"
      id={tooltipId}
      layoutId={reduced ? undefined : seat}
      initial={
        reduced
          ? false
          : skipped
            ? { opacity: 0, scale: 1, x: 0, y: 0, filter: "blur(0px)" }
            : {
                opacity: 0,
                scale: 0.9,
                x: isHorizontal ? slide : 0,
                y: isHorizontal ? 0 : lift,
                filter: "blur(4px)",
              }
      }
      animate={{ opacity: 1, scale: 1, x: 0, y: 0, filter: "blur(0px)" }}
      exit={
        reduced
          ? { opacity: 0, transition: { duration: 0 } }
          : {
              opacity: 0,
              scale: 0.96,
              x: isHorizontal ? slide * 0.35 : travel * 14,
              y: isHorizontal ? 0 : lift * 0.35,
              filter: "blur(2px)",
              transition: { duration: 0.12, ease: LEAVE },
            }
      }
      transition={reduced ? { duration: 0 } : { ...(skipped ? WARM : RISE), layout: GLIDE }}
      style={{ transformOrigin, ...style }}
      className={cn(
        "pointer-events-none relative w-max max-w-[220px] shrink-0 overflow-hidden rounded-[var(--ds-radius-sm)] px-2 py-1 text-[11.5px] font-medium leading-snug text-[var(--ds-text)]",
        contentClassName,
        className,
      )}
    >
      <motion.span
        aria-hidden
        layout={!reduced}
        transition={reduced ? { duration: 0 } : GLIDE}
        className="absolute inset-0 rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)] shadow-[var(--ds-shadow-overlay)]"
      />
      <motion.span
        layout={reduced ? false : "position"}
        initial={
          reduced
            ? false
            : skipped
              ? { opacity: 0, x: travel * 14, y: 0 }
              : { opacity: 0, x: 0, y: 9 }
        }
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={reduced ? { duration: 0 } : SWAP}
        className="relative block whitespace-normal"
      >
        {label}
      </motion.span>
    </motion.span>
  );
}

export function Tooltip({
  label,
  children,
  side = "top",
  disabled = false,
  className = "",
  contentClassName = "",
}: {
  label: ReactNode;
  children: TriggerChild;
  side?: TooltipSide;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
}) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [portalStyle, setPortalStyle] = useState<CSSProperties | null>(null);
  const { open, skipped, travel, tooltipId, seat, triggerProps } = useTooltip({ disabled });
  const reduced = useReducedMotion();
  const isHorizontal = side === "left" || side === "right";

  const updatePortalStyle = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (side === "right") {
      setPortalStyle({
        position: "fixed",
        top: rect.top + rect.height / 2,
        left: rect.right + 7,
        transform: "translateY(-50%)",
        zIndex: 9999,
      });
      return;
    }
    setPortalStyle({
      position: "fixed",
      top: rect.top + rect.height / 2,
      left: rect.left - 7,
      transform: "translate(-100%, -50%)",
      zIndex: 9999,
    });
  }, [side]);

  useEffect(() => {
    if (!open || !isHorizontal) {
      setPortalStyle(null);
      return;
    }
    updatePortalStyle();
    window.addEventListener("scroll", updatePortalStyle, true);
    window.addEventListener("resize", updatePortalStyle);
    return () => {
      window.removeEventListener("scroll", updatePortalStyle, true);
      window.removeEventListener("resize", updatePortalStyle);
    };
  }, [open, isHorizontal, updatePortalStyle]);

  const described = [children.props["aria-describedby"], open ? tooltipId : null]
    .filter(Boolean)
    .join(" ");

  const trigger = cloneElement(children, {
    "aria-describedby": described.length > 0 ? described : undefined,
    onPointerEnter: chain(children.props.onPointerEnter, triggerProps.onPointerEnter),
    onPointerLeave: chain(children.props.onPointerLeave, triggerProps.onPointerLeave),
    onPointerDown: chain(children.props.onPointerDown, triggerProps.onPointerDown),
    onPointerCancel: chain(children.props.onPointerCancel, triggerProps.onPointerCancel),
    onFocus: chain(children.props.onFocus, triggerProps.onFocus),
    onBlur: chain(children.props.onBlur, triggerProps.onBlur),
    onKeyDown: chain(children.props.onKeyDown, triggerProps.onKeyDown),
  });

  const anchorStyle: CSSProperties =
    side === "top"
      ? { bottom: "calc(100% + 7px)", left: "50%" }
      : side === "bottom"
        ? { top: "calc(100% + 7px)", left: "50%" }
        : { display: "none" };

  const portal =
    isHorizontal && open && portalStyle && typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            {open ? (
              <TooltipBubble
                label={label}
                tooltipId={tooltipId}
                seat={seat}
                open={open}
                skipped={skipped}
                travel={travel}
                side={side}
                reduced={reduced}
                contentClassName={contentClassName}
                style={portalStyle}
              />
            ) : null}
          </AnimatePresence>,
          document.body,
        )
      : null;

  return (
    <>
      <span ref={triggerRef} className={cn("relative inline-flex", className)}>
        {trigger}

        {!isHorizontal ? (
          <span
            aria-hidden={!open}
            className="pointer-events-none absolute left-1/2 z-50 flex w-0 justify-center"
            style={anchorStyle}
          >
            <AnimatePresence>
              {open ? (
                <TooltipBubble
                  label={label}
                  tooltipId={tooltipId}
                  seat={seat}
                  open={open}
                  skipped={skipped}
                  travel={travel}
                  side={side}
                  reduced={reduced}
                  contentClassName={contentClassName}
                />
              ) : null}
            </AnimatePresence>
          </span>
        ) : null}
      </span>
      {portal}
    </>
  );
}
