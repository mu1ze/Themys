import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/cn";

type CardProps = ComponentPropsWithoutRef<"div"> & {
  children: ReactNode;
};

type BadgeTone = "primary" | "success" | "warning" | "danger" | "neutral";

type ButtonLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  icon?: LucideIcon;
  variant?: "solid" | "soft" | "ghost";
};

type PageWidth = "reading" | "app" | "data";

type PageShellProps = ComponentPropsWithoutRef<"section"> & {
  width?: PageWidth;
};

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
};

type SectionProps = ComponentPropsWithoutRef<"section"> & {
  title?: string;
  description?: string;
  actions?: ReactNode;
  divided?: boolean;
};

type StatStripItem = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: LucideIcon;
  tone?: BadgeTone;
};

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

type StatCardProps = {
  label: string;
  value: string;
  detail?: string;
  icon?: LucideIcon;
  tone?: BadgeTone;
  className?: string;
};

export function Card({ children, className, style, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--ds-radius-md)] border bg-[var(--ds-card)]",
        className
      )}
      style={{ borderColor: "var(--ds-border)", ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: CardProps & { tone?: BadgeTone }) {
  const toneClasses = {
    primary: "border-[var(--ds-accent)]/20 bg-[var(--ds-accent-glow)] text-[var(--ds-accent)]",
    success: "border-[var(--ds-success)]/20 bg-[var(--ds-success-bg)] text-[var(--ds-success)]",
    warning: "border-[var(--ds-warning)]/20 bg-[var(--ds-warning-bg)] text-[var(--ds-warning)]",
    danger: "border-[var(--ds-danger)]/20 bg-[var(--ds-danger-bg)] text-[var(--ds-danger)]",
    neutral: "border-[var(--ds-border)] bg-[var(--ds-card-hover)] text-[var(--ds-text-secondary)]",
  }[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[15px] font-medium tracking-[0.02em]",
        toneClasses,
        className
      )}
    >
      {children}
    </span>
  );
}

export function ButtonLink({
  href,
  children,
  className,
  icon: Icon,
  variant = "solid",
}: ButtonLinkProps) {
  const variantClasses = {
    solid:
      "border border-transparent bg-[var(--ds-accent)] text-[var(--primary-foreground)] hover:opacity-90 active:opacity-80",
    soft:
      "border border-transparent bg-[var(--ds-accent-glow)] text-[var(--ds-text)] hover:bg-[var(--ds-card-hover)]",
    ghost:
      "border border-[var(--ds-text)] bg-transparent text-[var(--ds-text)] hover:bg-[var(--ds-card-hover)]",
  }[variant];

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-[16px] font-normal transition focus-visible:outline-none",
        variantClasses,
        className
      )}
    >
      {Icon ? <Icon size={20} strokeWidth={2} className="shrink-0" /> : null}
      <span>{children}</span>
    </Link>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  actions,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="text-[15px] font-medium uppercase tracking-[0.18em] text-[var(--ds-text-muted)]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-2 text-2xl font-medium tracking-[-0.025em] text-[var(--ds-text)] sm:text-3xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-3 max-w-xl text-[17px] leading-6 text-[var(--ds-text-secondary)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "primary",
  className,
}: StatCardProps) {
  const toneClasses = {
    primary: "text-[var(--ds-accent)] bg-[var(--ds-accent-glow)]",
    success: "text-[var(--ds-success)] bg-[var(--ds-success-bg)]",
    warning: "text-[var(--ds-warning)] bg-[var(--ds-warning-bg)]",
    danger: "text-[var(--ds-danger)] bg-[var(--ds-danger-bg)]",
    neutral: "text-[var(--ds-text-secondary)] bg-[var(--ds-card-hover)]",
  }[tone];

  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[15px] font-medium uppercase tracking-[0.12em] text-[var(--ds-text-muted)]">{label}</p>
          <p className="mt-2 text-2xl font-medium tracking-tight text-[var(--ds-text)]">{value}</p>
          {detail ? (
            <p className="mt-2 text-sm leading-6 text-[var(--ds-text-muted)]">{detail}</p>
          ) : null}
        </div>
        {Icon ? (
          <span className={cn("flex h-11 w-11 items-center justify-center rounded-full", toneClasses)}>
            <Icon className="h-5 w-5" strokeWidth={2} />
          </span>
        ) : null}
      </div>
    </Card>
  );
}

export function PageShell({
  children,
  className,
  width = "app",
  ...props
}: PageShellProps) {
  const widths: Record<PageWidth, string> = {
    reading: "max-w-[var(--ds-content-reading)]",
    app: "max-w-[var(--ds-content-app)]",
    data: "max-w-[var(--ds-content-data)]",
  };

  return (
    <section
      className={cn(
        "mx-auto w-full px-4 py-8 sm:px-6 sm:py-10 lg:px-8",
        widths[width],
        className
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-5 border-b border-[var(--ds-border)] pb-7 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 max-w-3xl">
        {eyebrow ? (
          <p className="text-[15px] font-medium uppercase tracking-[0.2em] text-[var(--ds-text-muted)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className={cn("text-[28px] font-medium tracking-[-0.035em] text-[var(--ds-text)] sm:text-[34px]", eyebrow && "mt-2")}>{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-[17px] leading-6 text-[var(--ds-text-secondary)]">
            {description}
          </p>
        ) : null}
        {meta ? <div className="mt-3 text-[15px] text-[var(--ds-text-muted)]">{meta}</div> : null}
      </div>
      {actions ? (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">{actions}</div>
      ) : null}
    </header>
  );
}

export function Section({
  children,
  title,
  description,
  actions,
  divided = true,
  className,
  ...props
}: SectionProps) {
  return (
    <section
      className={cn(divided && "border-t border-[var(--ds-border)] pt-7", className)}
      {...props}
    >
      {title || description || actions ? (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            {title ? <h2 className="text-base font-medium tracking-[-0.015em] text-[var(--ds-text)]">{title}</h2> : null}
            {description ? <p className="mt-1 text-[15px] leading-6 text-[var(--ds-text-muted)]">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatStrip({
  items,
  className,
}: {
  items: StatStripItem[];
  className?: string;
}) {
  const tones: Record<BadgeTone, string> = {
    primary: "text-[var(--ds-accent)]",
    success: "text-[var(--ds-success)]",
    warning: "text-[var(--ds-warning)]",
    danger: "text-[var(--ds-danger)]",
    neutral: "text-[var(--ds-text-secondary)]",
  };

  return (
    <dl
      className={cn(
        "grid overflow-hidden border-y border-[var(--ds-border)] sm:grid-flow-col sm:auto-cols-fr",
        className
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="flex min-w-0 items-start justify-between gap-4 border-b border-[var(--ds-border)] px-1 py-5 last:border-b-0 sm:border-b-0 sm:border-r sm:px-5 sm:first:pl-1 sm:last:border-r-0 sm:last:pr-1"
          >
            <div className="min-w-0">
              <dt className="text-[15px] font-medium uppercase tracking-[0.16em] text-[var(--ds-text-muted)]">{item.label}</dt>
              <dd className="mt-2 text-2xl font-medium tracking-[-0.03em] text-[var(--ds-text)]">{item.value}</dd>
              {item.detail ? <div className="mt-1 text-[15px] text-[var(--ds-text-muted)]">{item.detail}</div> : null}
            </div>
            {Icon ? <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tones[item.tone ?? "neutral"])} /> : null}
          </div>
        );
      })}
    </dl>
  );
}

export function DataList({ children, className, ...props }: CardProps) {
  return (
    <div className={cn("divide-y divide-[var(--ds-border)] border-y border-[var(--ds-border)]", className)} {...props}>
      {children}
    </div>
  );
}

export function DataRow({ children, className, ...props }: CardProps) {
  return (
    <div className={cn("px-1 py-4 transition-colors hover:bg-[var(--ds-card-hover)] sm:px-4", className)} {...props}>
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon,
  actions,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {Icon ? (
        <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ds-card-hover)] text-[var(--ds-text-muted)]">
          <Icon className="h-5 w-5" />
        </span>
      ) : null}
      <h3 className="text-base font-medium text-[var(--ds-text)]">{title}</h3>
      {description ? <p className="mt-2 max-w-md text-[17px] leading-6 text-[var(--ds-text-muted)]">{description}</p> : null}
      {actions ? <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  );
}
