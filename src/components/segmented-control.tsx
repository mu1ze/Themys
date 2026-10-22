"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";
import { SegmentedControl as InteriorSegmentedControl } from "@/components/interior/segmented-control";

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  icon?: LucideIcon;
  count?: number;
};

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <InteriorSegmentedControl
      label={label}
      value={value}
      onValueChange={(next) => onChange(next as T)}
      className={cn(
        "border-[var(--ds-border)] bg-[var(--ds-card-hover)] shadow-none",
        className,
      )}
      options={options.map((option) => ({
        value: option.value,
        label: option.count === undefined ? option.label : `${option.label} ${option.count}`,
      }))}
    />
  );
}
