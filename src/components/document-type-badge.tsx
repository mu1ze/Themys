import { FileText } from "lucide-react";

import { cn } from "@/lib/cn";
import {
  documentTypeLabel,
  type DocumentType,
} from "@/lib/document-types";

const TYPE_STYLES: Record<DocumentType, string> = {
  terms_of_service:
    "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  terms_of_use:
    "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  terms_and_conditions:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  privacy_policy:
    "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  acceptable_use_policy:
    "border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  cookie_policy:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  eula:
    "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
  other:
    "border-[var(--ds-border)] bg-[var(--ds-card-hover)] text-[var(--ds-text-secondary)]",
  unknown:
    "border-[var(--ds-warning)]/25 bg-[var(--ds-warning-bg)] text-[var(--ds-warning)]",
};

export function DocumentTypeBadge({
  type,
  className,
}: {
  type: DocumentType;
  className?: string;
}) {
  const label = documentTypeLabel(type);

  return (
    <span
      aria-label={`Document type: ${label}`}
      title={`Document type: ${label}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em]",
        TYPE_STYLES[type],
        className,
      )}
    >
      <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
