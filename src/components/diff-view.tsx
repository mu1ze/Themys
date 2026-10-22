import { getAttentionLevel } from "@/lib/attention-level";
import type { ClauseDiffResult, DiffClause } from "@/lib/scan-diff";
import s from "@/components/report-pages.module.css";

// Every change leads with what it means in plain English; the legal wording
// stays one click away. Native <details> keeps this a server component.

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");

function plainEnglish(clause: DiffClause) {
  const text = clause.explanation?.trim();
  if (text) return text;
  return clause.category
    ? `Themys didn't flag this clause. It reads as standard wording about ${clause.category.toLowerCase()}.`
    : "Themys didn't flag this clause. It reads as standard wording.";
}

function byAttention(a: DiffClause, b: DiffClause) {
  return (b.riskScore ?? 0) - (a.riskScore ?? 0);
}

function Level({ clause }: { clause: DiffClause }) {
  if (clause.riskScore == null) return null;
  const level = getAttentionLevel(clause.riskScore);
  return (
    <span className={cx(s.level, s[level.tone])}>
      <span className={s.dot} />
      {level.label}
    </span>
  );
}

function Original({ text, label = "Show original wording" }: { text: string; label?: string }) {
  return (
    <details className={s.original}>
      <summary>{label}</summary>
      <blockquote className={s.quote}>{text}</blockquote>
    </details>
  );
}

function ClauseChange({ clause, kind }: { clause: DiffClause; kind: "added" | "removed" }) {
  const why = clause.whyItMatters?.trim();
  const ask = clause.recommendedAction?.trim();
  return (
    <li className={s.change}>
      <div className={s.tags}>
        <span className={cx(s.kind, kind === "added" ? s.kindAdded : s.kindRemoved)}>
          {kind === "added" ? "New" : "Removed"}
        </span>
        {clause.category ? <span className={s.category}>{clause.category}</span> : null}
        <Level clause={clause} />
      </div>
      <div>
        <p className={s.plainLabel}>In plain English</p>
        <p className={s.plain}>{plainEnglish(clause)}</p>
      </div>
      {why && why !== clause.explanation?.trim() ? <p className={s.why}>{why}</p> : null}
      {kind === "added" && ask ? (
        <p className={s.ask}>
          <strong>What you can do:</strong> {ask}
        </p>
      ) : null}
      <Original text={clause.text} />
    </li>
  );
}

function ReworkedChange({ pair }: { pair: { old: DiffClause; new: DiffClause } }) {
  const ask = pair.new.recommendedAction?.trim();
  return (
    <li className={s.change}>
      <div className={s.tags}>
        <span className={cx(s.kind, s.kindChanged)}>Reworded</span>
        {pair.new.category ? <span className={s.category}>{pair.new.category}</span> : null}
        {pair.old.riskScore != null && pair.new.riskScore != null ? (
          <span className={s.category}>
            Risk {pair.old.riskScore.toFixed(1)} → {pair.new.riskScore.toFixed(1)}
          </span>
        ) : null}
      </div>
      <div className={s.compare}>
        <div className={s.side}>
          <div className={s.sideHead}>
            <span>Before</span>
            <Level clause={pair.old} />
          </div>
          <p>{plainEnglish(pair.old)}</p>
        </div>
        <div className={cx(s.side, s.sideNow)}>
          <div className={s.sideHead}>
            <span>Now</span>
            <Level clause={pair.new} />
          </div>
          <p>{plainEnglish(pair.new)}</p>
        </div>
      </div>
      {pair.new.whyItMatters?.trim() ? <p className={s.why}>{pair.new.whyItMatters}</p> : null}
      {ask ? (
        <p className={s.ask}>
          <strong>What you can do:</strong> {ask}
        </p>
      ) : null}
      <details className={s.original}>
        <summary>Compare original wording</summary>
        <blockquote className={s.quote}>
          <span className={s.quoteLabel}>Before</span>
          {pair.old.text}
        </blockquote>
        <blockquote className={s.quote}>
          <span className={s.quoteLabel}>Now</span>
          {pair.new.text}
        </blockquote>
      </details>
    </li>
  );
}

function Section({
  title,
  count,
  intro,
  children,
}: {
  title: string;
  count: number;
  intro: string;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className={s.section}>
      <div className={s.sectionHeading}>
        <h2>{title}</h2>
        <span>{count === 1 ? "1 clause" : `${count} clauses`}</span>
      </div>
      <p className={s.sectionIntro}>{intro}</p>
      <ol className={s.changes}>{children}</ol>
    </section>
  );
}

export function DiffView({ diff }: { diff: ClauseDiffResult }) {
  const totalChanges = diff.added.length + diff.removed.length + diff.changed.length;

  if (totalChanges === 0) {
    return (
      <div className={cx(s.section, s.empty)}>
        <h2>Nothing changed in the wording.</h2>
        <p>Both scans found the same clauses, so what you agreed to before is still what you&rsquo;re agreeing to now.</p>
      </div>
    );
  }

  return (
    <>
      <Section
        title="New in the terms"
        count={diff.added.length}
        intro="These weren't in the earlier version. If you keep using the service, you're agreeing to them."
      >
        {[...diff.added].sort(byAttention).map((clause) => (
          <ClauseChange key={clause.id} clause={clause} kind="added" />
        ))}
      </Section>

      <Section
        title="Reworded"
        count={diff.changed.length}
        intro="Same topic, different wording. Compare what it meant before with what it means now."
      >
        {[...diff.changed]
          .sort((a, b) => byAttention(a.new, b.new))
          .map((pair) => (
            <ReworkedChange key={`${pair.old.id}-${pair.new.id}`} pair={pair} />
          ))}
      </Section>

      <Section
        title="No longer in the terms"
        count={diff.removed.length}
        intro="These were in the earlier version but weren't found in the latest one."
      >
        {[...diff.removed].sort(byAttention).map((clause) => (
          <ClauseChange key={clause.id} clause={clause} kind="removed" />
        ))}
      </Section>

      {diff.unchanged.length > 0 ? (
        <details className={cx(s.section, s.collapsible)}>
          <summary className={s.sectionHeading}>
            <h2>Unchanged</h2>
            <span>{diff.unchanged.length === 1 ? "1 clause" : `${diff.unchanged.length} clauses`}</span>
          </summary>
          <p className={s.sectionIntro}>These read the same in both versions.</p>
          <ol className={s.changes}>
            {[...diff.unchanged].sort(byAttention).map((clause) => (
              <li key={clause.id} className={s.change}>
                <div className={s.tags}>
                  {clause.category ? <span className={s.category}>{clause.category}</span> : null}
                  <Level clause={clause} />
                </div>
                <p className={s.plain}>{plainEnglish(clause)}</p>
                <Original text={clause.text} />
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </>
  );
}
