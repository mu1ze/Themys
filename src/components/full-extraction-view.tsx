"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  CreditCard,
  FileText,
  Gavel,
  Info,
  Lock,
  LogOut,
  Paperclip,
  Quote,
  RefreshCcw,
  Scale,
  Shield,
  User,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui";
import { Modal } from "@/components/modal";
import { cn } from "@/lib/cn";
import type { FullExtractionPoint, FullExtractionSection } from "@/lib/llm";

type FullExtractionViewProps = {
  sections: FullExtractionSection[];
};

type SelectedPoint = {
  point: FullExtractionPoint;
  section: string;
  index: number;
};

const severityConfig: Record<
  FullExtractionPoint["severity"],
  {
    badge: "neutral" | "warning" | "danger";
    label: string;
    icon: LucideIcon;
    accent: string;
    dot: string;
    hover: string;
    ring: string;
  }
> = {
  info: {
    badge: "neutral",
    label: "Standard",
    icon: Info,
    accent: "text-[var(--ds-info)]",
    dot: "bg-[var(--ds-info)]",
    hover: "hover:bg-[var(--ds-info-bg)]",
    ring: "ring-1 ring-inset ring-[var(--ds-info)]",
  },
  caution: {
    badge: "warning",
    label: "Worth knowing",
    icon: Info,
    accent: "text-[var(--ds-warning)]",
    dot: "bg-[var(--ds-warning)]",
    hover: "hover:bg-[var(--ds-warning-bg)]",
    ring: "ring-1 ring-inset ring-[var(--ds-warning)]",
  },
  warning: {
    badge: "danger",
    label: "Pay attention",
    icon: AlertTriangle,
    accent: "text-[var(--ds-danger)]",
    dot: "bg-[var(--ds-danger)]",
    hover: "hover:bg-[var(--ds-danger-bg)]",
    ring: "ring-1 ring-inset ring-[var(--ds-danger)]",
  },
};

function getSectionIcon(title: string) {
  const normalizedTitle = title.toLowerCase();
  const iconClassName = "h-4 w-4 text-[var(--ds-text-muted)]";

  if (normalizedTitle.includes("account") && normalizedTitle.includes("registration")) return <User className={iconClassName} />;
  if (normalizedTitle.includes("privacy")) return <Shield className={iconClassName} />;
  if (normalizedTitle.includes("payment") || normalizedTitle.includes("billing")) return <CreditCard className={iconClassName} />;
  if (normalizedTitle.includes("content") || normalizedTitle.includes("intellectual")) return <FileText className={iconClassName} />;
  if (normalizedTitle.includes("security") || normalizedTitle.includes("protection")) return <Lock className={iconClassName} />;
  if (normalizedTitle.includes("liability") || normalizedTitle.includes("disclaimer")) return <Scale className={iconClassName} />;
  if (normalizedTitle.includes("termination") || normalizedTitle.includes("cancel")) return <LogOut className={iconClassName} />;
  if (normalizedTitle.includes("dispute") || normalizedTitle.includes("arbitration")) return <Gavel className={iconClassName} />;
  if (normalizedTitle.includes("change") || normalizedTitle.includes("update")) return <RefreshCcw className={iconClassName} />;
  return <Paperclip className={iconClassName} />;
}

function ExtractionPointCard({
  point,
  index,
  onOpen,
}: {
  point: FullExtractionPoint;
  index: number;
  onOpen: () => void;
}) {
  const config = severityConfig[point.severity];
  const Icon = config.icon;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={`View details for ${point.title}`}
      className={cn(
        "group flex min-h-[180px] flex-col bg-[var(--ds-bg)] p-5 text-left sm:p-6",
        "transition-colors duration-200 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ds-accent)]",
        config.hover,
        config.ring
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <Icon className={cn("h-4.5 w-4.5", config.accent)} strokeWidth={1.75} />
        <span className="font-mono text-[9px] tracking-[0.18em] text-[var(--ds-text-muted)]">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>

      <div className="mt-auto pt-8">
        <h4 className="text-[17px] font-medium leading-snug tracking-[-0.015em] text-[var(--ds-text)]">
          {point.title}
        </h4>
        <p className="mt-2 line-clamp-3 text-[13px] font-normal leading-5 text-[var(--ds-text-muted)] md:line-clamp-2">
          {point.detail}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-[0.2em] text-[var(--ds-text-muted)]">
            <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
            {config.label}
          </span>
          <span className="flex items-center gap-1 text-[11px] font-medium text-[var(--ds-text-muted)] transition-colors group-hover:text-[var(--ds-text)]">
            View
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </button>
  );
}

function ExtractionPointModal({
  selected,
  onClose,
}: {
  selected: SelectedPoint;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const config = severityConfig[selected.point.severity];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(selected.point.quote);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={selected.point.title}
      className="max-w-3xl"
      eyebrow={
        <>
          <Badge tone={config.badge} className="uppercase tracking-[0.16em]">{config.label}</Badge>
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--ds-text-muted)]">{selected.section}</span>
        </>
      }
    >
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--ds-text-muted)]">
            What this section says
          </p>
          <p className="mt-3 text-[17px] font-normal leading-7 text-[var(--ds-text)]">
            {selected.point.detail}
          </p>

          {selected.point.quote && (
            <div className="mt-8 border-t border-[var(--ds-border)] pt-6">
              <div className="flex items-center justify-between gap-4">
                <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--ds-text-muted)]">
                  <Quote className="h-4 w-4" />
                  Original document text
                </p>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 rounded-[var(--ds-radius-sm)] px-3 py-1.5 text-xs font-medium text-[var(--ds-text-muted)] transition hover:bg-[var(--ds-card)] hover:text-[var(--ds-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-accent)]"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-[var(--ds-success)]" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <blockquote className="mt-4 border-l-2 border-[var(--ds-border-hover)] pl-4 text-sm italic leading-6 text-[var(--ds-text-secondary)]">
                &ldquo;{selected.point.quote}&rdquo;
              </blockquote>
            </div>
          )}
        </div>
    </Modal>
  );
}

export function FullExtractionView({ sections }: FullExtractionViewProps) {
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = (sectionName: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionName)) {
        next.delete(sectionName);
      } else {
        next.add(sectionName);
      }
      return next;
    });
  };

  const totalPoints = sections.reduce((sum, section) => sum + section.keyPoints.length, 0);
  const cautionCount = sections.reduce(
    (sum, section) => sum + section.keyPoints.filter((point) => point.severity === "caution").length,
    0
  );
  const warningCount = sections.reduce(
    (sum, section) => sum + section.keyPoints.filter((point) => point.severity === "warning").length,
    0
  );

  if (sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--ds-border)] bg-[var(--ds-card-hover)] py-16 text-center">
        <BookOpen className="h-10 w-10 text-[var(--ds-text-dim)]" />
        <h3 className="mt-3 text-base font-medium text-[var(--ds-text)]">Full extraction not available</h3>
        <p className="mt-1 max-w-xs text-sm text-[var(--ds-text-muted)]">
          The comprehensive breakdown could not be generated for this document. Try scanning again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[var(--ds-border)] pb-4">
        <div className="flex items-center gap-2 text-[12px] font-normal text-[var(--ds-text-muted)]">
          <BookOpen className="h-3.5 w-3.5" />
          {totalPoints} key points across {sections.length} sections
        </div>
        {warningCount > 0 && (
          <span className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--ds-text-muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--ds-danger)]" />
            {warningCount} need attention
          </span>
        )}
        {cautionCount > 0 && (
          <span className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--ds-text-muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--ds-warning)]" />
            {cautionCount} worth knowing
          </span>
        )}
      </div>

      {sections.map((section, sectionIndex) => {
        const isCollapsed = collapsedSections.has(section.section);
        return (
        <section key={`${section.section}-${sectionIndex}`}>
          <button
            type="button"
            onClick={() => toggleSection(section.section)}
            className="mb-4 flex w-full items-center justify-between gap-4 rounded-lg text-left transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-accent)]"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-[var(--ds-text-muted)]" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[var(--ds-text-muted)]" />
              )}
              {getSectionIcon(section.section)}
              <h3 className="truncate text-sm font-medium tracking-[-0.01em] text-[var(--ds-text-secondary)]">
                {section.section}
              </h3>
            </div>
            <span className="shrink-0 text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--ds-text-muted)]">
              {section.keyPoints.length} {section.keyPoints.length === 1 ? "point" : "points"}
            </span>
          </button>

          {!isCollapsed && (
            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-[var(--ds-border)] bg-[var(--ds-border)] md:grid-cols-2">
              {section.keyPoints.map((point, pointIndex) => (
                <ExtractionPointCard
                  key={`${point.title}-${pointIndex}`}
                  point={point}
                  index={pointIndex}
                  onOpen={() =>
                    setSelectedPoint({
                      point,
                      section: section.section,
                      index: sectionIndex * 1000 + pointIndex,
                    })
                  }
                />
              ))}
            </div>
          )}
        </section>
      )})}

      {selectedPoint && (
        <ExtractionPointModal
          selected={selectedPoint}
          onClose={() => setSelectedPoint(null)}
        />
      )}
    </div>
  );
}
