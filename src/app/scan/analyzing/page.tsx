import Link from "next/link";
import { ArrowRight, CheckCircle2, LoaderCircle, ShieldAlert } from "lucide-react";

import { Badge, ButtonLink, PageHeader, PageShell, Section, StatStrip } from "@/components/ui";

const stages = [
  {
    title: "Fetch",
    state: "done",
    body: "The source text has been collected and normalized.",
  },
  {
    title: "Segment",
    state: "active",
    body: "Clause boundaries are being detected and grouped.",
  },
  {
    title: "Score",
    state: "pending",
    body: "Risk values will be attached to each clause.",
  },
  {
    title: "Explain",
    state: "pending",
    body: "Plain-English summaries are generated for flagged items.",
  },
];

export default function AnalyzingPage() {
  return (
    <main className="bg-background">
      <PageShell width="data">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <PageHeader
              eyebrow="Scan"
              title="Reading the terms now"
              description="The screen is built to show progress instead of leaving the user waiting in silence."
              meta={<Badge tone="primary">Analyzing</Badge>}
            />

            <Section>
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-sm font-medium text-[var(--ds-text-muted)]">
                    Current document
                  </p>
                  <h2 className="mt-2 text-2xl font-medium tracking-tight text-[var(--ds-text)]">
                    Waiting for scan input
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ds-text-secondary)]">
                    Start a scan from the New scan page to populate this view
                    with live analysis progress.
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ds-info-bg)] text-primary">
                  <LoaderCircle className="h-8 w-8 animate-spin" />
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-[var(--ds-text-secondary)]">
                    Progress
                  </span>
                  <span className="text-[var(--ds-text-muted)]">64%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--ds-card-hover)]">
                  <div className="h-1.5 w-[64%] rounded-full bg-primary" />
                </div>
              </div>

              <StatStrip className="mt-6" items={[
                { label: "Extraction", value: "Ready", tone: "success" },
                { label: "Clause grouping", value: "Waiting", detail: "Live scan data", tone: "warning" },
                { label: "Explanation", value: "Idle", tone: "neutral" },
              ]} />
            </Section>

            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/scan/results" icon={ArrowRight}>
                View results
              </ButtonLink>
              <Link
                href="/scan/new"
                className="inline-flex h-10 items-center justify-center rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)] px-4 text-sm font-medium text-[var(--ds-text-secondary)] transition hover:border-[var(--ds-border-hover)] hover:bg-[var(--ds-card-hover)] hover:text-[var(--ds-text)]"
              >
                Start another scan
              </Link>
            </div>
          </div>

          <div className="space-y-6">
            <Section title="Stages" description="Each step updates as the document moves through analysis.">
              <div className="mt-4 divide-y divide-[var(--ds-border)] border-y border-[var(--ds-border)]">
                {stages.map((stage) => {
                  const tone =
                    stage.state === "done"
                      ? "success"
                      : stage.state === "active"
                      ? "warning"
                      : "neutral";

                  return (
                    <div
                      key={stage.title}
                      className="flex items-start gap-4 px-1 py-4"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ds-card-hover)] text-[var(--ds-text-secondary)]">
                        {stage.state === "done" ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        ) : stage.state === "active" ? (
                          <LoaderCircle className="h-5 w-5 animate-spin text-amber-600" />
                        ) : (
                          <ShieldAlert className="h-5 w-5 text-[var(--ds-text-muted)]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-[var(--ds-text)]">
                            {stage.title}
                          </p>
                          <Badge tone={tone}>{stage.state}</Badge>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-[var(--ds-text-secondary)]">
                          {stage.body}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>

            <Section title="Current output">
              <div className="mt-4 border-y border-[var(--ds-border)] bg-[var(--ds-card-hover)] px-1 py-4">
                <p className="text-sm font-semibold text-[var(--ds-text)]">
                  High-risk signals detected
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--ds-text-secondary)]">
                  The text now shows the full set of statuses the front-end
                  needs: fetching, grouping, scoring, and explaining.
                </p>
              </div>
            </Section>
          </div>
        </div>
      </PageShell>
    </main>
  );
}
