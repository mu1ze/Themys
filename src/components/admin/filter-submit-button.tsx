"use client";

import { useFormStatus } from "react-dom";
import { motion, useReducedMotion } from "motion/react";

// Interior loading-button timings: preserve the tested press and crossfade feel.
const CELL = { type: "spring", stiffness: 520, damping: 34, mass: 0.45 } as const;
const CROSSFADE = { type: "spring", stiffness: 260, damping: 34, mass: 0.8 } as const;
const INSTANT = { duration: 0 } as const;

function Spinner({ still }: { still: boolean }) {
  return (
    <motion.svg
      width="13"
      height="13"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      animate={still ? undefined : { rotate: 360 }}
      transition={still ? undefined : { duration: 0.85, repeat: Infinity, ease: "linear" }}
    >
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25" />
      <path d="M10.5 6A4.5 4.5 0 0 0 6 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </motion.svg>
  );
}

export function FilterSubmitButton() {
  const { pending } = useFormStatus();
  const reduced = useReducedMotion();
  const transition = reduced ? INSTANT : CROSSFADE;

  return (
    <motion.button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      whileTap={pending || reduced ? undefined : { y: 1 }}
      transition={CELL}
      className="admin-filter-submit"
    >
      <span aria-hidden="true" className="grid place-items-center">
        <motion.span
          className="col-start-1 row-start-1 inline-flex items-center gap-2 whitespace-nowrap"
          initial={false}
          animate={pending ? { opacity: 0, y: -3, filter: "blur(3px)" } : { opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={transition}
        >
          Apply filters
        </motion.span>
        <motion.span
          className="col-start-1 row-start-1 inline-flex items-center gap-2 whitespace-nowrap"
          initial={false}
          animate={pending ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: 3, filter: "blur(3px)" }}
          transition={transition}
        >
          <Spinner still={reduced === true || !pending} />
          Applying…
        </motion.span>
      </span>
      <span className="sr-only">{pending ? "Applying filters" : "Apply filters"}</span>
    </motion.button>
  );
}
