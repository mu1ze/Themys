"use client";

import { useRef, useEffect, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

/* ─── Table ─── */

type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
};

type AdminTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  rowHref?: (row: T) => string;
  emptyMessage?: string;
  selection?: {
    selectedIds: Set<string>;
    onSelect: (id: string) => void;
    onSelectAll: () => void;
  };
};

export function AdminTable<T>({
  columns,
  rows,
  getRowKey,
  rowHref,
  emptyMessage = "No data found.",
  selection,
}: AdminTableProps<T>) {
  const router = useRouter();
  const allSelected =
    rows.length > 0 && rows.every((row) => selection?.selectedIds.has(getRowKey(row)));
  const someSelected =
    rows.length > 0 &&
    rows.some((row) => selection?.selectedIds.has(getRowKey(row))) &&
    !allSelected;

  const headerRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerRef.current) {
      headerRef.current.indeterminate = Boolean(someSelected);
    }
  }, [someSelected]);

  function isInteractiveTarget(target: EventTarget | null) {
    return target instanceof Element && Boolean(
      target.closest("a, button, input, select, textarea, [role='button']")
    );
  }

  function openRow(event: MouseEvent<HTMLTableRowElement>, href?: string) {
    if (!href || isInteractiveTarget(event.target)) return;
    router.push(href);
  }

  function openRowFromKeyboard(event: KeyboardEvent<HTMLTableRowElement>, href?: string) {
    if (!href || isInteractiveTarget(event.target)) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      router.push(href);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="admin-empty rounded-xl">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--admin-line)] bg-[var(--admin-paper)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--admin-line)] bg-[var(--admin-surface)]">
            {selection && (
              <th
                className="w-12 px-4 py-3 text-left relative z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  ref={headerRef}
                  type="checkbox"
                  checked={Boolean(allSelected)}
                  onChange={selection.onSelectAll}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Select all rows"
                  className="h-4 w-4 rounded border-[var(--admin-line-hover)] accent-[var(--admin-ink)] focus:ring-[var(--admin-ink)]"
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-muted)]",
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--admin-line)]">
          {rows.map((row) => {
            const key = getRowKey(row);
            const href = rowHref?.(row);
            const isSelected = selection?.selectedIds.has(key) ?? false;
            return (
              <tr
                key={key}
                onClick={(event) => openRow(event, href)}
                onKeyDown={(event) => openRowFromKeyboard(event, href)}
                tabIndex={href ? 0 : undefined}
                role={href ? "link" : undefined}
                className={cn(
                  "group relative transition-colors",
                  href && "cursor-pointer hover:bg-[color-mix(in_srgb,var(--admin-ink)_2%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--admin-ink)]"
                )}
              >
                {selection && (
                  <td className="px-4 py-3 relative z-10">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => selection.onSelect(key)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select row ${key}`}
                      className="h-4 w-4 rounded border-[var(--admin-line-hover)] accent-[var(--admin-ink)] focus:ring-[var(--admin-ink)]"
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-4 py-3 relative",
                      col.className,
                      href && "z-10"
                    )}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Pagination ─── */

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  searchParams?: Record<string, string>;
};

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  searchParams = {},
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  function buildUrl(p: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(p));
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-sm text-[var(--admin-muted)]">
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}{" "}
        of {total}
      </p>
      <div className="flex gap-1">
        {page > 1 && (
          <Link
            href={buildUrl(page - 1)}
            className="rounded-lg border border-[var(--admin-line)] bg-[var(--admin-paper)] px-3 py-1.5 text-sm font-medium text-[var(--admin-ink)] transition-colors hover:border-[var(--admin-line-hover)] hover:bg-[var(--admin-surface)] focus-visible:outline-none focus-visible:shadow-[var(--ds-focus)]"
          >
            Prev
          </Link>
        )}
        {page < totalPages && (
          <Link
            href={buildUrl(page + 1)}
            className="rounded-lg border border-[var(--admin-line)] bg-[var(--admin-paper)] px-3 py-1.5 text-sm font-medium text-[var(--admin-ink)] transition-colors hover:border-[var(--admin-line-hover)] hover:bg-[var(--admin-surface)] focus-visible:outline-none focus-visible:shadow-[var(--ds-focus)]"
          >
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
