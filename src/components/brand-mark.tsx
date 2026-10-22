import Link from "next/link";
import { Scale } from "lucide-react";

import { cn } from "@/lib/cn";

type BrandMarkProps = {
  className?: string;
  compact?: boolean;
  condensed?: boolean;
  href?: string;
};

export function BrandMark({
  className,
  compact = false,
  condensed = false,
  href = "/",
}: BrandMarkProps) {
  return (
    <Link
      href={href}
      aria-label="themys home"
      className={cn("inline-flex items-center gap-2.5 text-[var(--ds-text)]", className)}
    >
      <Scale
        className={cn(
          "shrink-0 transition-[width,height] duration-200",
          compact || condensed ? "h-[18px] w-[18px]" : "h-5 w-5",
        )}
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <span
        className={cn(
          "font-[family-name:var(--ds-doc-font)] font-normal leading-none tracking-[-0.06em] transition-[font-size] duration-200",
          compact || condensed ? "text-[22px]" : "text-[24px]",
        )}
      >
        themys
      </span>
    </Link>
  );
}
