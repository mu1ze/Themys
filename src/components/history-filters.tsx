"use client";

import { useId, useState, type ChangeEvent } from "react";
import {
  ArrowUpDown,
  CalendarDays,
  Filter,
  Search,
} from "lucide-react";

import { cn } from "@/lib/cn";

type HistoryFiltersProps = {
  search?: string;
  risk?: string;
  dateRange?: string;
  sort?: string;
};

export function HistoryFilters({
  search = "",
  risk = "all",
  dateRange = "30",
  sort = "date",
}: HistoryFiltersProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const submitOnChange = (event: ChangeEvent<HTMLSelectElement>) => {
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <form action="/history" method="GET" className="rounded-[20px] border border-[var(--ds-border)] bg-[var(--ds-card)] p-4">
      <div>
        <div className="flex items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ds-text-dim)]" />
            <input
              type="search"
              name="search"
              defaultValue={search}
              aria-label="Search history"
              placeholder="Search by site or document..."
              className="h-11 w-full rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-transparent pl-11 pr-4 text-[13px] text-[var(--ds-text)] outline-none transition placeholder:text-[var(--ds-text-dim)] focus:border-[var(--ds-accent)]"
            />
          </div>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={panelId}
            title={open ? "Hide filters" : "Show filters"}
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-[var(--ds-radius-sm)] border px-3 text-[13px] font-medium transition sm:px-4",
              open
                ? "border-[var(--ds-accent)]/30 bg-[var(--ds-info-bg)] text-[var(--ds-accent)]"
                : "border-[var(--ds-border)] bg-[var(--ds-card)] text-[var(--ds-text-secondary)] hover:border-[var(--ds-border)] hover:bg-[var(--ds-card-hover)] hover:text-[var(--ds-text)]"
            )}
          >
            <Filter className="h-4 w-4" strokeWidth={2} />
            <span className="hidden sm:inline">Filters</span>
          </button>
        </div>

        <div
          id={panelId}
          inert={!open}
          className={cn(
            "grid overflow-hidden transition-all duration-200 ease-out",
            open
              ? "mt-4 max-h-96 gap-3 opacity-100 md:grid-cols-3"
              : "max-h-0 opacity-0"
          )}
        >
          <div className="relative">
            <select
              name="risk"
              aria-label="Risk level filter"
              defaultValue={risk}
              onChange={submitOnChange}
              className="h-11 w-full appearance-none rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)] px-4 pr-10 text-[13px] text-[var(--ds-text-secondary)] outline-none transition focus:border-[var(--ds-accent)]"
            >
              <option value="all">Risk level: All</option>
              <option value="high">Risk level: High</option>
              <option value="medium">Risk level: Moderate</option>
              <option value="low">Risk level: Safe</option>
            </select>
            <ArrowUpDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ds-text-dim)]" />
          </div>

          <div className="relative">
            <select
              name="dateRange"
              aria-label="Date range filter"
              defaultValue={dateRange}
              onChange={submitOnChange}
              className="h-11 w-full appearance-none rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)] px-4 pr-10 text-[13px] text-[var(--ds-text-secondary)] outline-none transition focus:border-[var(--ds-accent)]"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="all">All time</option>
            </select>
            <CalendarDays className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ds-text-dim)]" />
          </div>

          <div className="relative">
            <select
              name="sort"
              aria-label="Sort history"
              defaultValue={sort}
              onChange={submitOnChange}
              className="h-11 w-full appearance-none rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)] px-4 pr-10 text-[13px] text-[var(--ds-text-secondary)] outline-none transition focus:border-[var(--ds-accent)]"
            >
              <option value="date">Sort: Date</option>
              <option value="risk">Sort: Attention Level</option>
              <option value="name">Sort: A-Z</option>
            </select>
            <ArrowUpDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ds-text-dim)]" />
          </div>
        </div>
      </div>
    </form>
  );
}
