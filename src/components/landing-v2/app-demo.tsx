"use client";

import { motion, useScroll, useTransform, useSpring } from "motion/react";
import { useRef } from "react";
import {
  LayoutDashboard,
  Scan,
  Bell,
  History,
  Code,
  Settings,
  Moon,
  ChevronLeft,
  AlertTriangle,
  FileText,
  MapPin,
  Sparkles,
  Shield,
  User,
  Lock,
  CreditCard,
  FileText as FileIcon,
  Scale,
  LogOut,
  Gavel,
  RefreshCcw,
  Paperclip,
  ChevronDown,
  ArrowUpRight,
  Copy,
  ExternalLink,
  Info,
} from "lucide-react";

const colors = {
  bg: "#080d1a",
  card: "#0f1729",
  cardHover: "#141e35",
  border: "#1c2a47",
  borderHover: "#263755",
  text: "#ffffff",
  textSecondary: "#cbd5e1",
  textMuted: "#94a3b8",
  textDim: "#64748b",
  accent: "#3b82f6",
  success: "#34d399",
  danger: "#f87171",
  warning: "#fbbf24",
  warningBg: "rgba(251, 191, 36, 0.12)",
};

function AttentionGauge({ score, label }: { score: number; label: string }) {
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0.08, Math.min(1, score / 10));
  const dashOffset = circumference - circumference * progress;

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="relative flex h-28 w-28 items-center justify-center">
        <svg className="h-full w-full -rotate-90">
          <circle cx="56" cy="56" r={radius} fill="transparent" stroke={colors.border} strokeWidth="8" />
          <motion.circle
            cx="56"
            cy="56"
            r={radius}
            fill="transparent"
            stroke={colors.warning}
            strokeLinecap="round"
            strokeWidth="8"
            style={{ strokeDasharray: circumference, strokeDashoffset: dashOffset }}
            initial={{ strokeDashoffset: circumference }}
            whileInView={{ strokeDashoffset: dashOffset }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
          <span className="text-sm font-bold leading-tight" style={{ color: colors.warning }}>{label}</span>
          <span className="mt-1 text-[9px] font-medium uppercase tracking-[0.16em]" style={{ color: colors.textMuted }}>Attention level</span>
        </div>
      </div>
      <p className="max-w-[190px] text-[11px] leading-4" style={{ color: colors.textMuted }}>
        This is not legal advice. Themys highlights clauses worth reviewing, not a legal risk determination.
      </p>
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="hidden w-[260px] shrink-0 flex-col border-r sm:flex" style={{ borderColor: colors.border, backgroundColor: colors.card }}>
      <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: colors.border }}>
        <ChevronLeft className="h-4 w-4" style={{ color: colors.textMuted }} />
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: colors.textMuted }}>Overview</span>
      </div>
      <div className="flex flex-col gap-6 overflow-y-auto px-5 py-6">
        <AttentionGauge score={5} label="Worth reviewing" />
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border px-4 py-3" style={{ borderColor: colors.border, backgroundColor: colors.cardHover }}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" style={{ color: colors.danger }} />
              <span className="text-xs" style={{ color: colors.textMuted }}>Flagged</span>
            </div>
            <span className="text-lg font-bold" style={{ color: colors.text }}>5</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border px-4 py-3" style={{ borderColor: colors.border, backgroundColor: colors.cardHover }}>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" style={{ color: colors.textMuted }} />
              <span className="text-xs" style={{ color: colors.textMuted }}>Analyses</span>
            </div>
            <span className="text-lg font-bold" style={{ color: colors.text }}>5</span>
          </div>
        </div>
        <button type="button" className="flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition" style={{ borderColor: colors.border, color: colors.text, backgroundColor: colors.cardHover }}>
          <FileText className="h-4 w-4" style={{ color: colors.accent }} />
          View Original Document
        </button>
        <div className="rounded-xl border px-4 py-3" style={{ borderColor: colors.border, backgroundColor: colors.cardHover }}>
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5" style={{ color: colors.textMuted }} />
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ backgroundColor: colors.warningBg, color: colors.warning }}>Location not set</span>
          </div>
          <p className="mt-2 text-xs leading-5" style={{ color: colors.textMuted }}>
            Set your country and state in Settings to compare scans against local rights and restrictions.
          </p>
        </div>
      </div>
    </aside>
  );
}

function TopNav() {
  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard" },
    { icon: Scan, label: "Scan", active: true },
    { icon: Bell, label: "Monitoring" },
    { icon: History, label: "History" },
    { icon: Code, label: "Developer" },
    { icon: Settings, label: "Settings" },
  ];

  return (
    <header className="flex items-center justify-between border-b px-4 py-2" style={{ borderColor: colors.border, backgroundColor: colors.bg }}>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: colors.accent }}>
            <span className="text-sm font-bold text-white">T</span>
          </div>
          <span className="text-lg font-semibold" style={{ color: colors.text }}>Themys</span>
        </div>
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <button key={item.label} type="button" className="relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition" style={{ color: item.active ? colors.text : colors.textMuted }}>
              <item.icon className="h-4 w-4" />
              {item.label}
              {item.active && <div className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full" style={{ backgroundColor: colors.accent }} />}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg transition" style={{ backgroundColor: colors.cardHover, color: colors.textMuted }}>
          <Moon className="h-4 w-4" />
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold" style={{ backgroundColor: "#8b5cf6", color: colors.text }}>D</div>
      </div>
    </header>
  );
}

function Badge({ children, tone = "warning" }: { children: React.ReactNode; tone?: "warning" | "danger" | "success" | "neutral" }) {
  const toneStyles = {
    warning: { bg: "rgba(251, 191, 36, 0.12)", border: "rgba(251, 191, 36, 0.25)", color: colors.warning },
    danger: { bg: "rgba(248, 113, 113, 0.12)", border: "rgba(248, 113, 113, 0.25)", color: colors.danger },
    success: { bg: "rgba(52, 211, 153, 0.12)", border: "rgba(52, 211, 153, 0.25)", color: colors.success },
    neutral: { bg: colors.cardHover, border: colors.border, color: colors.textMuted },
  }[tone];

  return (
    <span className="inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em]" style={{ backgroundColor: toneStyles.bg, borderColor: toneStyles.border, color: toneStyles.color }}>
      {children}
    </span>
  );
}

function SectionIcon({ title }: { title: string }) {
  const normalized = title.toLowerCase();
  const className = "h-4 w-4";
  const style = { color: colors.textMuted };
  if (normalized.includes("account") || normalized.includes("registration")) return <User className={className} style={style} />;
  if (normalized.includes("privacy")) return <Shield className={className} style={style} />;
  if (normalized.includes("payment") || normalized.includes("billing")) return <CreditCard className={className} style={style} />;
  if (normalized.includes("content") || normalized.includes("intellectual")) return <FileIcon className={className} style={style} />;
  if (normalized.includes("security") || normalized.includes("protection")) return <Lock className={className} style={style} />;
  if (normalized.includes("liability") || normalized.includes("disclaimer")) return <Scale className={className} style={style} />;
  if (normalized.includes("termination") || normalized.includes("cancel")) return <LogOut className={className} style={style} />;
  if (normalized.includes("dispute") || normalized.includes("arbitration")) return <Gavel className={className} style={style} />;
  if (normalized.includes("change") || normalized.includes("update")) return <RefreshCcw className={className} style={style} />;
  return <Paperclip className={className} style={style} />;
}

const sections = [
  { title: "Account & Registration", points: 1, expanded: true, point: { title: "User responsibility for account security", detail: "You are responsible for keeping your password and other security details secret. Do not share them with anyone else.", severity: "caution" as const } },
  { title: "Privacy & Data Collection", points: 1, expanded: false },
  { title: "Content & Intellectual Property", points: 8, expanded: false },
  { title: "Security & Account Protection", points: 1, expanded: false },
];

export function AppDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start end", "end start"] });

  const appScale = useTransform(scrollYProgress, [0, 0.15], [0.92, 1]);
  const appOpacity = useTransform(scrollYProgress, [0, 0.15], [0, 1]);
  const sidebarX = useTransform(scrollYProgress, [0.05, 0.2], [-40, 0]);
  const contentY = useTransform(scrollYProgress, [0.1, 0.25], [40, 0]);
  const contentOpacity = useTransform(scrollYProgress, [0.1, 0.25], [0, 1]);
  const extractionY = useTransform(scrollYProgress, [0.35, 0.55], [60, 0]);
  const extractionOpacity = useTransform(scrollYProgress, [0.35, 0.55], [0, 1]);

  const smoothScale = useSpring(appScale, { stiffness: 100, damping: 30 });

  return (
    <div ref={containerRef} className="relative w-full py-8">
      <motion.div
        className="mx-auto w-full max-w-[1200px] overflow-hidden rounded-2xl border shadow-2xl"
        style={{ borderColor: colors.border, backgroundColor: colors.bg, boxShadow: "0 24px 80px rgba(0, 0, 0, 0.5)", scale: smoothScale, opacity: appOpacity }}
      >
        <TopNav />
        <div className="flex min-h-[680px]">
          <motion.div style={{ x: sidebarX }}>
            <Sidebar />
          </motion.div>

          <motion.main className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-8" style={{ y: contentY, opacity: contentOpacity }}>
            <div className="mb-8">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <Badge tone="warning">5 clauses flagged</Badge>
                <span className="text-sm" style={{ color: colors.textMuted }}>Updated Jul 30, 2026</span>
              </div>
              <h1 className="flex items-center gap-3 text-[28px] font-medium leading-tight tracking-[-0.035em] sm:text-[32px]" style={{ color: colors.text }}>foundation.wikimedia.org</h1>
              <div className="mt-2 flex items-center gap-2 text-[13px]" style={{ color: colors.textMuted }}>
                <ExternalLink className="h-3.5 w-3.5" />
                <span>https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use</span>
              </div>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border p-5 md:col-span-2" style={{ borderColor: colors.border, backgroundColor: "transparent" }}>
                <h3 className="mb-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em]" style={{ color: colors.textMuted }}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.text }} /> The Bottom Line
                </h3>
                <p className="text-[15px] leading-7" style={{ color: colors.textSecondary }}>
                  This document has been analyzed for clauses worth reviewing and compliance issues. Review the detailed breakdown below.
                </p>
                <p className="mt-4 text-xs leading-5" style={{ color: colors.textMuted }}>
                  This is not legal advice. Themys highlights clauses worth reviewing, not a legal risk determination.
                </p>
              </div>

              <div className="flex flex-col justify-between rounded-xl border p-5" style={{ borderColor: colors.border, backgroundColor: "transparent" }}>
                <div>
                  <h3 className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em]" style={{ color: colors.textMuted }}>Top item to review</h3>
                  <p className="text-[13px] font-medium leading-snug" style={{ color: colors.text }}>Binding Mediation for Undisclosed Paid Contributions</p>
                  <p className="mt-1 line-clamp-2 text-xs" style={{ color: colors.textMuted }}>If you are paid to edit or contribute content and do not disclose this, you agree to ent...</p>
                </div>
                <div className="mt-4 flex gap-6 border-t pt-4" style={{ borderColor: colors.border }}>
                  <div>
                    <div className="text-xl font-medium" style={{ color: colors.text }}>0</div>
                    <div className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.16em]" style={{ color: colors.textMuted }}>Target Hits</div>
                  </div>
                  <div>
                    <div className="text-xl font-medium" style={{ color: colors.text }}>0</div>
                    <div className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.16em]" style={{ color: colors.textMuted }}>Regulatory Flags</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-1 border-b pb-2" style={{ borderColor: colors.border }}>
                <button type="button" className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition" style={{ backgroundColor: colors.cardHover, color: colors.text }}>
                  <Sparkles className="h-4 w-4" style={{ color: "#8b5cf6" }} /> Full Extraction
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full opacity-75" style={{ backgroundColor: "#8b5cf6" }} />
                    <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: "#8b5cf6" }} />
                  </span>
                </button>
                <button type="button" className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition" style={{ color: colors.textMuted }}>
                  <Shield className="h-4 w-4" style={{ color: colors.danger }} /> Flagged
                  <Badge tone="danger">5</Badge>
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-medium uppercase tracking-[0.16em]" style={{ color: colors.textMuted }}>
                <div className="flex items-center gap-2"><FileText className="h-4 w-4" /> 31 key points across 9 sections</div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.danger }} /> 10 need attention</div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.warning }} /> 4 worth knowing</div>
              </div>
            </div>

            <motion.div className="space-y-3" style={{ y: extractionY, opacity: extractionOpacity }}>
              {sections.map((section, i) => (
                <motion.div key={section.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}>
                  <div className="rounded-xl border" style={{ borderColor: colors.border, backgroundColor: colors.card }}>
                    <button type="button" className="flex w-full items-center justify-between px-5 py-4">
                      <div className="flex items-center gap-3">
                        <SectionIcon title={section.title} />
                        <span className="text-sm font-medium" style={{ color: colors.text }}>{section.title}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs" style={{ color: colors.textMuted }}>{section.points} point{section.points !== 1 ? "s" : ""}</span>
                        <ChevronDown className="h-4 w-4" style={{ color: colors.textMuted }} />
                      </div>
                    </button>

                    {section.expanded && section.point && (
                      <div className="border-t px-5 pb-5 pt-2" style={{ borderColor: colors.border }}>
                        <div className="grid min-h-[180px] flex-col gap-4 rounded-xl border p-5 sm:grid-cols-2" style={{ borderColor: colors.warning, backgroundColor: colors.bg }}>
                          <div className="flex flex-col">
                            <div className="flex items-start justify-between">
                              <Info className="h-5 w-5" style={{ color: colors.warning }} />
                              <span className="font-mono text-[9px] tracking-[0.18em]" style={{ color: colors.textMuted }}>01</span>
                            </div>
                            <div className="mt-auto pt-6">
                              <h4 className="text-[17px] font-medium leading-snug tracking-[-0.015em]" style={{ color: colors.text }}>{section.point.title}</h4>
                              <p className="mt-2 line-clamp-3 text-[13px] leading-5" style={{ color: colors.textMuted }}>{section.point.detail}</p>
                              <div className="mt-4 flex items-center justify-between">
                                <span className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-[0.2em]" style={{ color: colors.textMuted }}>
                                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.warning }} /> Worth knowing
                                </span>
                                <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: colors.textMuted }}>View <ArrowUpRight className="h-3.5 w-3.5" /></span>
                              </div>
                            </div>
                          </div>
                          <div className="hidden rounded-lg border p-4 sm:block" style={{ borderColor: colors.border, backgroundColor: colors.card }}>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-medium uppercase tracking-[0.16em]" style={{ color: colors.textMuted }}>Original document text</span>
                              <button type="button" className="flex items-center gap-1 text-[11px]" style={{ color: colors.textMuted }}><Copy className="h-3.5 w-3.5" /> Copy</button>
                            </div>
                            <p className="mt-3 text-[13px] italic leading-6" style={{ color: colors.textSecondary }}>
                              &ldquo;You are responsible for safeguarding your own password and other security credentials, and should never disclose them to any third party.&rdquo;
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.main>
        </div>
      </motion.div>
    </div>
  );
}
