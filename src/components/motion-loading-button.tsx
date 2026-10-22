"use client";

import { LoadingButton } from "@/components/interior/loading-button";
import { cn } from "@/lib/cn";

export function MotionLoadingButton({
  children,
  onAction,
  pendingLabel = "Saving…",
  successLabel = "Saved",
  errorLabel = "Try again",
  disabled = false,
  className,
}: {
  children: string;
  onAction: () => unknown;
  pendingLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <LoadingButton
      onAction={onAction}
      pendingLabel={pendingLabel}
      successLabel={successLabel}
      errorLabel={errorLabel}
      disabled={disabled}
      className={cn(
        "h-11 !rounded-full !border-transparent !bg-[var(--ds-accent)] px-5 text-[16px] !text-[var(--primary-foreground)] hover:opacity-90 focus-visible:!border-[var(--ds-accent)] focus-visible:!shadow-[var(--ds-focus)] disabled:cursor-not-allowed [&>span>span]:!text-[var(--primary-foreground)]",
        className,
      )}
    >
      {children}
    </LoadingButton>
  );
}
