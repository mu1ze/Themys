import { notFound } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getScanPair, type ClauseRecord } from "@/lib/persistence";
import { diffClauses, type DiffClause } from "@/lib/scan-diff";
import { DiffView } from "@/components/diff-view";
import { DomainFavicon } from "@/components/domain-favicon";
import { PageShell } from "@/components/ui";
import { getAttentionLevel } from "@/lib/attention-level";
import { documentTypeLabel } from "@/lib/document-types";
import s from "@/components/report-pages.module.css";

type Props = {
  params: Promise<{ scanIdA: string; scanIdB: string }>;
};

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function toDiffClause(clause: ClauseRecord): DiffClause {
  return {
    id: clause.id,
    text: clause.text,
    category: clause.category,
    riskScore: clause.riskScore,
    riskLevel: clause.riskLevel,
    explanation: clause.explanation,
    whyItMatters: clause.whyItMatters,
    recommendedAction: clause.recommendedAction,
    isFlagged: clause.isFlagged,
  };
}

function count(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default async function DiffPage({ params }: Props) {
  const { scanIdA, scanIdB } = await params;

  const user = await currentUser();
  if (!user) notFound();

  const pair = await getScanPair(user.id, scanIdA, scanIdB).catch(() => null);
  if (!pair) notFound();

  const { scanA, scanB } = pair;
  const domain = scanA.scan.domain ?? scanB.scan.domain ?? "Unknown";

  // Ensure A is older, B is newer
  const [older, newer] =
    new Date(scanA.scan.createdAt) <= new Date(scanB.scan.createdAt)
      ? [scanA, scanB]
      : [scanB, scanA];

  const diff = diffClauses(
    older.clauses.map(toDiffClause),
    newer.clauses.map(toDiffClause),
    older.scan.riskScore,
    newer.scan.riskScore,
    older.scan.flaggedCount,
    newer.scan.flaggedCount,
  );

  const before = older.scan.riskScore ?? 0;
  const now = newer.scan.riskScore ?? 0;
  const nowLevel = getAttentionLevel(now);
  const tone = diff.riskDelta > 0.5 ? "danger" : diff.riskDelta < -0.5 ? "success" : null;
  const headline =
    tone === "danger"
      ? "These terms got riskier for you."
      : tone === "success"
      ? "These terms got safer for you."
      : "About the same risk as before.";
  const changeParts = [
    diff.added.length ? `${count(diff.added.length, "clause")} added` : null,
    diff.changed.length ? `${diff.changed.length} reworded` : null,
    diff.removed.length ? `${diff.removed.length} removed` : null,
  ].filter(Boolean);
  const looksReorganised = diff.added.length + diff.removed.length >= 10 && diff.added.length > 0 && diff.removed.length > 0;
  const docLabel = documentTypeLabel(newer.scan.documentType);

  return (
    <PageShell width="reading" className={cx(s.page, "pb-24")}>
      <Link
        href={`/scan/history/${encodeURIComponent(domain)}?identity=${encodeURIComponent(older.scan.documentIdentityKey ?? "")}`}
        className={s.back}
      >
        <ArrowLeft aria-hidden="true" />
        Back to domain history
      </Link>

      <header className={s.heading}>
        <span className={s.icon}>
          <DomainFavicon domain={domain} size={24} className="" />
        </span>
        <div className={s.identity}>
          <p className={s.eyebrow}>Change report · {docLabel}</p>
          <h1 className={s.title}>{domain}</h1>
          <div className={s.meta}>
            <span>
              {formatDate(older.scan.createdAt)} → {formatDate(newer.scan.createdAt)}
            </span>
            <span>{count(diff.added.length + diff.changed.length + diff.removed.length, "change")}</span>
          </div>
        </div>
      </header>

      <section className={s.hero} aria-label="What changed">
        <div>
          <div className={cx(s.status, s[nowLevel.tone])}>
            <span className={s.dot} />
            Now {nowLevel.label.toLowerCase()}
            <span className={s.muted}>
              · Risk {before.toFixed(1)} → {now.toFixed(1)} / 10
            </span>
          </div>
          <h2 className={s.heroTitle}>{headline}</h2>
          <p className={s.heroCopy}>
            {changeParts.length ? `${changeParts.join(", ")} since ${formatDate(older.scan.createdAt)}.` : "No clauses changed."}{" "}
            Flagged clauses went from {older.scan.flaggedCount} to {newer.scan.flaggedCount}. Each change below is
            explained in plain English.
          </p>
          <div className={s.actions}>
            <Link className={s.primary} href={`/scan/results?id=${newer.scan.id}`}>
              Open latest report <ArrowRight aria-hidden="true" />
            </Link>
            <Link className={s.ghost} href={`/scan/results?id=${older.scan.id}`}>
              Open earlier report
            </Link>
          </div>
        </div>
        <div className={s.metrics}>
          <span className={s.metricsLabel}>Risk score</span>
          <div className={s.metric}>
            <strong>{before.toFixed(1)}</strong> Before
          </div>
          <div className={s.metric}>
            <strong>{now.toFixed(1)}</strong> Now
          </div>
          <div className={cx(s.metric, diff.flaggedDelta > 0 ? s.danger : diff.flaggedDelta < 0 && s.success)}>
            <strong>
              {diff.flaggedDelta > 0 ? "+" : ""}
              {diff.flaggedDelta}
            </strong>{" "}
            Flagged
          </div>
        </div>
      </section>
      {looksReorganised ? (
        <p className={s.footnote}>
          Many clauses added and removed at once usually means the document was reorganised, not rewritten. Read the
          plain-English summaries before assuming the substance changed.
        </p>
      ) : null}

      <DiffView diff={diff} />
    </PageShell>
  );
}
