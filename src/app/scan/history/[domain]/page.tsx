import { notFound } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { ArrowLeft, ArrowRight, GitCompare, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { listScansByDomain } from "@/lib/persistence";
import { DomainFavicon } from "@/components/domain-favicon";
import { PageShell } from "@/components/ui";
import { getAttentionLevel } from "@/lib/attention-level";
import { documentTypeLabel } from "@/lib/document-types";
import s from "@/components/report-pages.module.css";

type Props = {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ identity?: string }>;
};

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatDay(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
}

function scoreOf(score: number | null) {
  return Math.round((score ?? 0) * 10) / 10;
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function RiskDelta({ delta }: { delta: number | null }) {
  if (delta === null) return <span className={cx(s.delta, s.neutral)}>Baseline</span>;
  if (Math.abs(delta) < 0.05) {
    return (
      <span className={cx(s.delta, s.neutral)}>
        <Minus aria-hidden="true" /> No change
      </span>
    );
  }
  if (delta > 0) {
    return (
      <span className={cx(s.delta, s.danger)}>
        <TrendingUp aria-hidden="true" /> +{delta.toFixed(1)} riskier
      </span>
    );
  }
  return (
    <span className={cx(s.delta, s.success)}>
      <TrendingDown aria-hidden="true" /> {delta.toFixed(1)} safer
    </span>
  );
}

function headlineFor(scanCount: number, delta: number | null) {
  if (scanCount === 1 || delta === null) return "First scan on record. Rescan later to track changes.";
  if (Math.abs(delta) < 0.05) return "No change in risk since the last scan.";
  return delta > 0 ? "Riskier than the last scan." : "Safer than the last scan.";
}

function RiskTrend({ scans }: { scans: { id: string; createdAt: string; score: number }[] }) {
  // Oldest → newest, scored 0–10; 4 and 7 are the attention-level thresholds.
  const points = scans.map((scan, i) => ({
    ...scan,
    x: scans.length === 1 ? 50 : (i / (scans.length - 1)) * 100,
    y: 100 - Math.min(Math.max(scan.score, 0), 10) * 10,
  }));
  const line = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className={s.chartCard}>
      <div
        className={s.chart}
        role="img"
        aria-label={`Risk score across ${scans.length} scans: ${points.map((p) => p.score.toFixed(1)).join(", ")} out of 10`}
      >
        <span className={s.band} style={{ top: "30%" }}>
          <span className={s.bandLabel}>Needs attention · 7+</span>
        </span>
        <span className={s.band} style={{ top: "60%" }}>
          <span className={s.bandLabel}>Worth reviewing · 4+</span>
        </span>
        <svg className={s.line} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polygon points={`0,100 ${line} 100,100`} />
          <polyline points={line} />
        </svg>
        {points.map((p) => (
          <span
            key={p.id}
            className={cx(s.point, s[getAttentionLevel(p.score).tone])}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          />
        ))}
      </div>
      <div className={s.axis}>
        <span>{formatDay(scans[0].createdAt)}</span>
        <span>{formatDay(scans[scans.length - 1].createdAt)}</span>
      </div>
    </div>
  );
}

export default async function DomainHistoryPage({ params, searchParams }: Props) {
  const { domain } = await params;
  const { identity } = await searchParams;
  const decodedDomain = decodeURIComponent(domain);

  const user = await currentUser();
  if (!user) notFound();

  const scans = identity && /^[a-f0-9]{64}$/.test(identity)
    ? await listScansByDomain(user.id, decodedDomain, identity).catch(() => [])
    : [];
  if (scans.length === 0) notFound();

  // Scans are newest-first; each delta compares against the scan before it.
  const entries = scans.map((scan, index) => {
    const prev = scans[index + 1];
    const delta =
      prev?.riskScore != null && scan.riskScore != null ? scan.riskScore - prev.riskScore : null;
    return { ...scan, delta, score: scoreOf(scan.riskScore), prevId: prev?.id ?? null };
  });

  const latest = entries[0];
  const oldest = entries[entries.length - 1];
  const latestLevel = getAttentionLevel(latest.score);
  const docLabel = documentTypeLabel(latest.documentType);

  return (
    <PageShell width="reading" className={s.page}>
      <Link href="/history" className={s.back}>
        <ArrowLeft aria-hidden="true" />
        Back to history
      </Link>

      <header className={s.heading}>
        <span className={s.icon}>
          <DomainFavicon domain={decodedDomain} size={24} className="" />
        </span>
        <div className={s.identity}>
          <p className={s.eyebrow}>Domain history · {docLabel}</p>
          <h1 className={s.title}>{decodedDomain}</h1>
          <div className={s.meta}>
            <span>{plural(entries.length, "scan")} recorded</span>
            {entries.length > 1 ? <span>First scanned {formatDay(oldest.createdAt)}</span> : null}
            <span>Last scanned {formatDay(latest.createdAt)}</span>
          </div>
        </div>
      </header>

      <section className={s.hero} aria-label="Latest scan summary">
        <div>
          <div className={cx(s.status, s[latestLevel.tone])}>
            <span className={s.dot} />
            {latestLevel.label}
            <span className={s.muted}>· Latest scan, risk {latest.score.toFixed(1)} / 10</span>
          </div>
          <h2 className={s.heroTitle}>{headlineFor(entries.length, latest.delta)}</h2>
          <p className={s.heroCopy}>
            {plural(latest.flaggedCount, "clause")} flagged out of {latest.clauseCount} in the {docLabel} as of{" "}
            {formatDate(latest.createdAt)}.
            {entries.length > 1
              ? ` Since the first scan, risk has moved from ${oldest.score.toFixed(1)} to ${latest.score.toFixed(1)}.`
              : null}
          </p>
          <div className={s.actions}>
            <Link className={s.primary} href={`/scan/results?id=${latest.id}`}>
              Open latest report <ArrowRight aria-hidden="true" />
            </Link>
            {latest.prevId ? (
              <Link className={s.ghost} href={`/scan/diff/${latest.prevId}/${latest.id}`}>
                <GitCompare aria-hidden="true" /> Compare with previous
              </Link>
            ) : null}
          </div>
        </div>
        <div className={s.metrics}>
          <span className={s.metricsLabel}>Latest scan</span>
          <div className={s.metric}>
            <strong>{latest.flaggedCount}</strong> Flagged
          </div>
          <div className={s.metric}>
            <strong>{latest.clauseCount}</strong> Clauses
          </div>
          <div className={s.metric}>
            <strong>{entries.length}</strong> Scans
          </div>
        </div>
      </section>

      {entries.length > 1 ? (
        <section className={s.section}>
          <div className={s.sectionHeading}>
            <h2>Risk over time</h2>
            <span>Score out of 10 · lower is safer</span>
          </div>
          <RiskTrend scans={[...entries].reverse()} />
        </section>
      ) : null}

      <section className={s.section}>
        <div className={s.sectionHeading}>
          <h2>Scan timeline</h2>
          <span>Newest first</span>
        </div>
        <ol className={s.timeline}>
          {entries.map((scan, index) => {
            const level = getAttentionLevel(scan.score);
            return (
              <li key={scan.id} className={s.entry}>
                <div className={cx(s.rail, s[level.tone])} aria-hidden="true">
                  <span className={s.railDot} />
                </div>
                <div>
                  <div className={s.tags}>
                    <span className={cx(s.level, s[level.tone])}>
                      <span className={s.dot} />
                      {level.label}
                    </span>
                    {index === 0 ? <span className={s.latest}>Latest</span> : null}
                  </div>
                  <span className={s.date}>{formatDate(scan.createdAt)}</span>
                  <div className={s.stats}>
                    <span>
                      {scan.flaggedCount} flagged · {plural(scan.clauseCount, "clause")}
                    </span>
                    <RiskDelta delta={scan.delta} />
                  </div>
                </div>
                <div className={s.entryActions}>
                  {scan.prevId ? (
                    <Link className={s.small} href={`/scan/diff/${scan.prevId}/${scan.id}`}>
                      <GitCompare aria-hidden="true" /> Compare
                    </Link>
                  ) : null}
                  <Link className={cx(s.small, s.view)} href={`/scan/results?id=${scan.id}`}>
                    View <ArrowRight aria-hidden="true" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </PageShell>
  );
}
