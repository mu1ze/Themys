"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/cn";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Search,
  History,
  ChevronRight,
  Globe,
  Clock,
  FileText,
  Eye,
  XCircle,
} from "lucide-react";

// ─── Browser Frame ──────────────────────────────────────────────────────────

function BrowserFrame({
  url,
  children,
}: {
  url: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-[var(--ds-border)] bg-[var(--ds-card)] shadow-2xl"
    >
      <div className="flex items-center gap-2 bg-[var(--ds-card-hover)] px-4 py-2.5">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <div className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="mx-4 flex-1">
          <div className="flex items-center justify-center gap-1.5 rounded-md border border-[var(--ds-border)] bg-[var(--ds-card-hover)] px-3 py-1 text-xs text-[var(--ds-text-muted)]">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            <span>{url}</span>
          </div>
        </div>
        <div className="w-16" />
      </div>
      <div className="bg-[var(--ds-card)]">
        {children}
      </div>
    </div>
  );
}

// ─── Demo Screens ───────────────────────────────────────────────────────────

function DashboardDemo() {
  return (
    <div className="p-6" style={{ minHeight: 380 }}>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ds-text-dim)]">
            Dashboard
          </p>
          <h2 className="text-xl font-bold text-[var(--ds-text)]">Welcome back</h2>
        </div>
        <div className="flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-white">
          <Search className="h-4 w-4" /> New Scan
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { label: "Total Scans", value: "24", icon: FileText, color: "text-primary" },
          { label: "Attention level", value: "Worth reviewing", icon: TrendingUp, color: "text-amber-500" },
          { label: "Flags Found", value: "47", icon: AlertTriangle, color: "text-rose-500" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-[var(--ds-border)] p-4">
            <div className="mb-2 flex items-center gap-2">
              <stat.icon className={cn("h-4 w-4", stat.color)} />
              <span className="text-xs text-[var(--ds-text-muted)]">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold text-[var(--ds-text)]">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Recent scans */}
      <div className="rounded-xl border border-[var(--ds-border)]">
        <div className="border-b border-[var(--ds-border)] px-4 py-3">
          <span className="text-sm font-semibold text-[var(--ds-text)]">Recent Scans</span>
        </div>
        {[
          { name: "Google", score: 4.2, flags: 3, date: "Today" },
          { name: "GitHub", score: 2.1, flags: 1, date: "Yesterday" },
          { name: "Discord", score: 6.8, flags: 5, date: "Jun 24" },
        ].map((scan) => (
          <div key={scan.name} className="flex items-center gap-3 border-b border-[var(--ds-border)] px-4 py-3 last:border-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--ds-card-hover)] text-xs font-bold text-[var(--ds-text-secondary)]">
              {scan.name[0]}
            </div>
            <div className="flex-1">
              <span className="text-sm font-semibold text-[var(--ds-text)]">{scan.name}</span>
              <span className="ml-2 text-xs text-[var(--ds-text-dim)]">{scan.date}</span>
            </div>
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold",
              scan.score >= 7 ? "bg-red-50 text-red-600" : scan.score >= 4 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
            )}>{scan.score >= 7 ? "Needs attention" : scan.score >= 4 ? "Worth reviewing" : "Standard"}</span>
            <span className="text-xs text-[var(--ds-text-dim)]">{scan.flags} flags</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScanResultsDemo() {
  return (
    <div className="p-6" style={{ minHeight: 380 }}>
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
          6 clauses flagged
        </span>
        <span className="text-xs text-[var(--ds-text-dim)]">Updated Jun 26, 2026</span>
      </div>
      <h2 className="mb-1 text-xl font-bold text-[var(--ds-text)]">Discord Terms of Service</h2>
      <p className="mb-6 text-sm text-[var(--ds-text-muted)]">
        This scan analyzes the master agreement for Discord services and highlights clauses affecting privacy and arbitration.
      </p>

      {/* Score + findings */}
      <div className="grid gap-4 md:grid-cols-[140px_1fr]">
        <div className="flex flex-col items-center rounded-xl border border-red-100 bg-red-50/50 p-4">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <svg className="h-full w-full -rotate-90">
              <circle cx="32" cy="32" r="28" fill="transparent" stroke="#fee2e2" strokeWidth="5" />
              <circle cx="32" cy="32" r="28" fill="transparent" stroke="#ef4444" strokeWidth="5"
                strokeDasharray={2 * Math.PI * 28}
                strokeDashoffset={2 * Math.PI * 28 * (1 - 0.68)}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-lg font-bold text-red-600">6.8</span>
          </div>
          <span className="mt-1 text-xs font-semibold text-red-600">Needs attention</span>
        </div>

        <div className="space-y-2">
          {[
            { sev: "high", cat: "Data Sharing", text: "Broad sharing with partners" },
            { sev: "high", cat: "Arbitration", text: "Class action waiver" },
            { sev: "medium", cat: "Content License", text: "Perpetual license grant" },
          ].map((flag) => (
            <div key={flag.cat} className="flex items-start gap-3 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-card-hover)] p-3">
              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                flag.sev === "high" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
              )}>{flag.sev}</span>
              <div>
                <span className="text-xs font-semibold text-[var(--ds-text)]">{flag.cat}</span>
                <p className="text-xs text-[var(--ds-text-muted)]">{flag.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HistoryDemo() {
  return (
    <div className="p-6" style={{ minHeight: 380 }}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ds-text-dim)]">History</p>
          <h2 className="text-xl font-bold text-[var(--ds-text)]">Scan History</h2>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--ds-border)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--ds-border)] bg-[var(--ds-card-hover)] text-xs font-semibold uppercase tracking-wider text-[var(--ds-text-muted)]">
              <th className="px-4 py-3">Site</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">Flags</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: "Google", domain: "google.com", score: 4.2, flags: 3, date: "Jun 26" },
              { name: "GitHub", domain: "github.com", score: 2.1, flags: 1, date: "Jun 25" },
              { name: "Discord", domain: "discord.com", score: 6.8, flags: 5, date: "Jun 24" },
              { name: "OpenAI", domain: "openai.com", score: 5.5, flags: 4, date: "Jun 23" },
              { name: "Stripe", domain: "stripe.com", score: 3.0, flags: 2, date: "Jun 22" },
            ].map((scan) => (
              <tr key={scan.name} className="border-b border-[var(--ds-border)] last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <img
                      src={`https://www.google.com/s2/favicons?sz=32&domain=${scan.domain}`}
                      alt=""
                      className="h-5 w-5 rounded"
                      referrerPolicy="no-referrer"
                    />
                    <span className="font-semibold text-[var(--ds-text)]">{scan.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold",
                    scan.score >= 7 ? "bg-red-50 text-red-600" : scan.score >= 4 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                  )}>{scan.score >= 7 ? "Needs attention" : scan.score >= 4 ? "Worth reviewing" : "Standard"}</span>
                </td>
                <td className="px-4 py-3 text-[var(--ds-text-secondary)]">{scan.flags}</td>
                <td className="px-4 py-3 text-[var(--ds-text-dim)]">{scan.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExtensionDemo() {
  return (
    <div className="relative" style={{ minHeight: 380 }}>
      {/* Simulated webpage */}
      <div className="p-8">
        <div className="mb-4 h-6 w-1/3 rounded bg-[var(--ds-card-hover)]" />
        <div className="mb-2 h-4 w-full rounded bg-[var(--ds-card-hover)]" />
        <div className="mb-2 h-4 w-5/6 rounded bg-[var(--ds-card-hover)]" />
        <div className="mb-6 h-4 w-2/3 rounded bg-[var(--ds-card-hover)]" />
        <div className="mb-4 h-5 w-1/4 rounded bg-[var(--ds-card-hover)]" />
        <div className="mb-2 h-4 w-full rounded bg-[var(--ds-card-hover)]" />
        <div className="mb-2 h-4 w-4/5 rounded bg-[var(--ds-card-hover)]" />
        <div className="mb-6 h-4 w-3/4 rounded bg-[var(--ds-card-hover)]" />
        <div className="mb-4 h-5 w-1/3 rounded bg-[var(--ds-card-hover)]" />
        <div className="mb-2 h-4 w-full rounded bg-[var(--ds-card-hover)]" />
        <div className="mb-2 h-4 w-5/6 rounded bg-[var(--ds-card-hover)]" />
      </div>

      {/* Extension overlay */}
      <div className="absolute bottom-4 right-4 w-72 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-card)] shadow-2xl">
        {/* Collapsed bar */}
        <div className="flex items-center gap-2 border-b border-[var(--ds-border)] px-3 py-2.5">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-[var(--ds-text)]">Themys</span>
          <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
            5.5
          </span>
          <span className="text-[10px] text-[var(--ds-text-dim)]">6 flags</span>
        </div>
        {/* Expanded content */}
        <div className="max-h-48 overflow-y-auto p-3">
          <p className="mb-3 text-[11px] leading-4 text-[var(--ds-text-secondary)]">
            This agreement contains broad data sharing and mandatory arbitration clauses.
          </p>
          {[
            { sev: "high", cat: "Data Sharing", text: "May share with third parties" },
            { sev: "high", cat: "Arbitration", text: "Class action waiver" },
            { sev: "medium", cat: "Auto-Renewal", text: "30 day cancellation notice" },
          ].map((flag) => (
            <div key={flag.cat} className="mb-2 rounded-lg bg-[var(--ds-card-hover)] p-2">
              <div className="flex items-center gap-1.5">
                <span className={cn("rounded px-1 py-0.5 text-[9px] font-bold uppercase",
                  flag.sev === "high" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                )}>{flag.sev}</span>
                <span className="text-[10px] font-semibold text-[var(--ds-text)]">{flag.cat}</span>
              </div>
              <p className="mt-1 text-[10px] text-[var(--ds-text-muted)]">{flag.text}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-[var(--ds-border)] px-3 py-2 text-center">
          <span className="text-[10px] text-[var(--ds-text-dim)]">Powered by Themys</span>
        </div>
      </div>
    </div>
  );
}

// ─── Tab Config ─────────────────────────────────────────────────────────────

const DEMO_TABS = [
  {
    label: "Dashboard",
    description: "Your scan overview — recent scans, risk trends, and quick actions at a glance.",
    url: "themys.ca/dashboard",
    content: <DashboardDemo />,
  },
  {
    label: "Scan Results",
    description: "Detailed risk analysis — score gauge, flagged clauses with severity, and plain-English explanations.",
    url: "themys.ca/scan/results",
    content: <ScanResultsDemo />,
  },
  {
    label: "History",
    description: "Track every scan over time — company logos, attention levels, flag counts, and export options.",
    url: "themys.ca/history",
    content: <HistoryDemo />,
  },
  {
    label: "Extension (coming soon)",
    description: "Browser extension overlay (coming soon) — planned on-page risk analysis after Web Store release verification.",
    url: "themys.ca/extension",
    content: <ExtensionDemo />,
    dark: true,
  },
];

// ─── Main Component ─────────────────────────────────────────────────────────

export function LandingDemo() {
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTab((prev) => (prev + 1) % DEMO_TABS.length);
    }, 7000);
    return () => clearInterval(timer);
  }, []);

  const current = DEMO_TABS[activeTab];

  return (
    <div>
      {/* Tab buttons */}
      <div className="mb-6 flex flex-wrap justify-center gap-2">
        {DEMO_TABS.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActiveTab(i)}
            className={cn(
              "rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200",
              i === activeTab
                ? "bg-primary text-white shadow-lg shadow-primary/25"
                : "bg-[var(--ds-card)] text-[var(--ds-text-secondary)] shadow-sm hover:bg-[var(--ds-card-hover)]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Description */}
      <p className="mb-6 text-center text-sm text-[var(--ds-text-muted)]">
        {current.description}
      </p>

      {/* Browser frame */}
      <div className="relative">
        <div className="absolute inset-0 rounded-2xl bg-primary/5 blur-3xl" />
        <div className="relative">
          <BrowserFrame url={current.url}>
            {current.content}
          </BrowserFrame>
        </div>
      </div>
    </div>
  );
}
