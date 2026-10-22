import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/cn";

type AuthPageLayoutProps = {
  children: ReactNode;
  className?: string;
};

export function AuthPageLayout({
  children,
  className,
}: AuthPageLayoutProps) {
  return (
    <div
      className={cn(
        "flex min-h-[100svh] w-full items-center justify-center bg-[var(--ds-bg)] bg-[radial-gradient(ellipse_at_50%_0%,var(--ds-peach),transparent_54%)] px-4 py-10 sm:px-6 sm:py-14",
        className,
      )}
    >
      <div className="flex w-full max-w-[500px] flex-col items-center">
        <BrandMark className="mb-[26px] sm:hidden" />
        <div className="w-full rounded-none border-0 bg-transparent p-6 shadow-none sm:rounded-3xl sm:border sm:border-[var(--ds-border)] sm:bg-[var(--ds-card)] sm:p-[42px] sm:shadow-[0_18px_48px_rgba(35,30,27,0.08)]">
          {children}
        </div>
      </div>
    </div>
  );
}
