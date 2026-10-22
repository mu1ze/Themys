import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/cn";

const controlBase =
  "mt-2 w-full rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)] px-3.5 py-3 text-[14px] text-[var(--ds-text)] outline-none transition placeholder:text-[var(--ds-text-dim)] focus:border-[var(--ds-accent)] focus:ring-2 focus:ring-[var(--ds-accent)]/15";

type FieldProps = {
  label: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function Field({
  label,
  description,
  children,
  className,
}: FieldProps) {
  return (
    <label className={cn("block", className)}>
      <span className="text-[12px] font-semibold text-[var(--ds-text-secondary)]">{label}</span>
      {children}
      {description ? (
        <p className="mt-1.5 text-[11px] leading-5 text-[var(--ds-text-muted)]">{description}</p>
      ) : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(controlBase, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(controlBase, "min-h-36 resize-y", props.className)}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(controlBase, props.className)} />
  );
}

type CheckboxRowProps = {
  label: string;
  description?: string;
  defaultChecked?: boolean;
};

export function CheckboxRow({
  label,
  description,
  defaultChecked = false,
}: CheckboxRowProps) {
  return (
    <label className="flex items-start gap-3 rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)] p-4 transition hover:border-[var(--ds-border-hover)]">
      <input
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-1 h-4 w-4 rounded border-[var(--ds-border-hover)] accent-[var(--ds-accent)]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--ds-text)]">
          {label}
        </span>
        {description ? (
          <span className="mt-1 block text-sm leading-6 text-[var(--ds-text-secondary)]">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}
