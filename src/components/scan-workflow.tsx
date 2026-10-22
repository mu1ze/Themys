"use client";

import styles from "@/components/workspace-pages.module.css";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  FileUp,
  Link2,
  RotateCw,
} from "lucide-react";

import { Badge, ButtonLink } from "@/components/ui";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { LogoMarquee } from "@/components/interior/logo-marquee";
import { TaskSteps, type TaskStep } from "@/components/interior/task-steps";
import { ProgressBar } from "@/components/progress-bar";
import { trackEvent } from "@/lib/track";

type LimitResponse = {
  error?: string;
  upgradeRequired: true;
  tier: string;
  reason?: string;
  upgradePlan?: string;
  remaining?: number;
  limit?: number;
  resetsAt?: number;
};

type RecentScanTile = {
  id: string;
  name: string;
  domain: string;
  targetUrl: string;
  logoUrl: string | null;
  riskScore: number | null;
  relativeDate: string | null;
};

type ScanWorkflowProps = {
  initialUrl?: string;
  initialText?: string;
  recentScanTiles?: RecentScanTile[];
};

type Mode = "url" | "paste" | "upload";

const MIN_PASTE_CHARS = 100;
const MAX_PDF_BYTES = 8 * 1024 * 1024;

function extractDomain(input: string): string | undefined {
  try {
    const url = new URL(input);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function formatResetTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function riskBadgeStyle(score: number | null): { bg: string; text: string; label: string } | null {
  if (score == null) return null;
  if (score >= 7) return { bg: "bg-rose-100", text: "text-rose-700", label: "Needs attention" };
  if (score >= 4) return { bg: "bg-amber-100", text: "text-amber-700", label: "Worth reviewing" };
  return { bg: "bg-emerald-100", text: "text-emerald-700", label: "Standard" };
}

/* ------------------------------------------------------------------ */
/*  Staged progress types & component                                  */
/* ------------------------------------------------------------------ */

const SCAN_STEPS: TaskStep[] = [
  {
    id: "extract",
    label: "Extracting text",
    meta: "Document parsed",
  },
  {
    id: "analyze",
    label: "Analyzing clauses",
    meta: "Clauses reviewed",
  },
  {
    id: "results",
    label: "Building results",
    meta: "Report ready",
  },
];

/** Approximate time each step is displayed (ms). Total ≈ 20 s. */
const STEP_DURATIONS = [5_000, 10_000, 5_000];

function ScanProgress({ currentStep }: { currentStep: number }) {
  const total = STEP_DURATIONS.reduce((a, b) => a + b, 0);
  const elapsed = STEP_DURATIONS.slice(0, currentStep).reduce((a, b) => a + b, 0);
  const percent = Math.min(100, Math.round((elapsed / total) * 100));

  return (
    <div className="space-y-5 rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-card)] px-5 py-4">
      <TaskSteps
        steps={SCAN_STEPS}
        current={currentStep}
        label="Scan progress"
        className="[&_.text-stone-600]:text-[var(--ds-text-secondary)] [&_.text-stone-500]:text-[var(--ds-text-muted)] [&_.text-stone-400]:text-[var(--ds-text-dim)]"
      />
      <ProgressBar
        value={percent}
        label="Scan progress"
        pendingLabel="Working"
        completeLabel="Complete"
      />
      <p className="text-center text-[11px] text-[var(--ds-text-dim)]">Estimated time: ~20 seconds</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function ScanWorkflow({
  initialUrl = "",
  initialText = "",
  recentScanTiles = [],
}: ScanWorkflowProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isExtension = searchParams.get("source") === "extension";
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const requestedMode = searchParams.get("mode");
  const [mode, setMode] = useState<Mode>(
    initialText
      ? "paste"
      : requestedMode === "paste" || requestedMode === "upload" || requestedMode === "url"
        ? requestedMode
        : "url",
  );
  const [termsUrl, setTermsUrl] = useState(initialUrl);
  const [termsText, setTermsText] = useState(initialText);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [limitNotice, setLimitNotice] = useState<LimitResponse | null>(null);
  const [contractUploadBlocked, setContractUploadBlocked] = useState(false);
  const [contractUploadTier, setContractUploadTier] = useState("free");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingScanUrl, setPendingScanUrl] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ url?: string; text?: string; file?: string }>({});
  const [touched, setTouched] = useState<{ url?: boolean; text?: boolean; file?: boolean }>({});

  const validate = useCallback(
    (values: { url: string; text: string; file: File | null }, currentMode: Mode) => {
      const errors: { url?: string; text?: string; file?: string } = {};
      if (currentMode === "url") {
        const trimmed = values.url.trim();
        if (!trimmed) {
          errors.url = "Please enter a URL.";
        } else if (!/^https?:\/\//i.test(trimmed)) {
          errors.url = "URL must start with http:// or https://.";
        }
      } else if (currentMode === "paste") {
        const trimmed = values.text.trim();
        if (!trimmed) {
          errors.text = "Please paste the document text.";
        } else if (trimmed.length < MIN_PASTE_CHARS) {
          errors.text = `Text must be at least ${MIN_PASTE_CHARS} characters (${trimmed.length}/${MIN_PASTE_CHARS}).`;
        }
      } else {
        if (!values.file) {
          errors.file = "Please choose a PDF file.";
        } else if (values.file.type !== "application/pdf") {
          errors.file = "Only PDF files are supported.";
        } else if (values.file.size > MAX_PDF_BYTES) {
          errors.file = "PDF file must be 8MB or smaller.";
        }
      }
      return errors;
    },
    []
  );

  const currentErrors = validate({ url: termsUrl, text: termsText, file: pdfFile }, mode);
  const isFormValid = Object.keys(currentErrors).length === 0;

  // Auto-submit when a carousel tile sets the URL
  useEffect(() => {
    if (!pendingScanUrl || termsUrl !== pendingScanUrl || mode !== "url") return;
    const frame = window.requestAnimationFrame(() => {
      setPendingScanUrl(null);
      formRef.current?.requestSubmit();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pendingScanUrl, termsUrl, mode]);

  function handleModeChange(nextMode: Mode) {
    setMode(nextMode);
    setError(null);
    setFieldErrors({});
    setTouched({});
    if (nextMode !== "upload") setPdfFile(null);
    if (nextMode !== "paste") setTermsText("");
  }

  /* Clean up any running step timer on unmount */
  useEffect(() => {
    return () => {
      if (stepTimerRef.current !== null) {
        clearTimeout(stepTimerRef.current);
      }
    };
  }, []);

  /**
   * Schedule the visual step progression. Each step is displayed for
   * STEP_DURATIONS[idx] milliseconds before the next one appears.
   * Returns a cleanup function that cancels all pending timers.
   */
  function startStepProgress(): () => void {
    let stepIdx = 0;
    setCurrentStep(0);

    function advance() {
      stepIdx += 1;
      if (stepIdx < SCAN_STEPS.length) {
        setCurrentStep(stepIdx);
        stepTimerRef.current = setTimeout(advance, STEP_DURATIONS[stepIdx]);
      }
    }

    stepTimerRef.current = setTimeout(advance, STEP_DURATIONS[0]);

    return () => {
      if (stepTimerRef.current !== null) {
        clearTimeout(stepTimerRef.current);
        stepTimerRef.current = null;
      }
    };
  }

  function stopStepProgress() {
    if (stepTimerRef.current !== null) {
      clearTimeout(stepTimerRef.current);
      stepTimerRef.current = null;
    }
    // Immediately jump to past the last step so the UI shows all-complete
    setCurrentStep(SCAN_STEPS.length);
  }

  function handleRecentScanSelect(tile: RecentScanTile) {
    setMode("url");
    setTermsUrl(tile.targetUrl);
    setTermsText("");
    setPdfFile(null);
    setError(null);
    setFieldErrors({});
    setTouched({});
    setPendingScanUrl(tile.targetUrl);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({ url: true, text: true, file: true });

    const errors = validate({ url: termsUrl, text: termsText, file: pdfFile }, mode);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    setError(null);
    setLimitNotice(null);
    setContractUploadBlocked(false);

    // Start the visual step progression
    const cleanupSteps = startStepProgress();

    try {
      const normalizedUrl = termsUrl.trim();
      const normalizedText = termsText.trim();

      let response: Response;
      if (mode === "upload" && pdfFile) {
        const formData = new FormData();
        formData.append("file", pdfFile);
        response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "x-themys-response": "web-compact" },
          body: formData,
        });
      } else if (mode === "paste") {
        response = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-themys-response": "web-compact",
          },
          body: JSON.stringify({
            text: normalizedText,
          }),
        });
      } else {
        response = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-themys-response": "web-compact",
          },
          body: JSON.stringify({
            url: normalizedUrl || undefined,
            domain: extractDomain(normalizedUrl),
          }),
        });
      }

      const payload = (await response.json()) as
        | LimitResponse
        | { error?: string; scanId?: string | null };

      if (!response.ok) {
        if ("upgradeRequired" in payload && payload.upgradeRequired) {
          if (payload.reason === "contract_upload") {
            setContractUploadTier(payload.tier);
            setContractUploadBlocked(true);
            if (!isExtension) {
              trackEvent("paywall_view", { variant: "contract-upload", tier: payload.tier });
            }
            return;
          }
          setLimitNotice(payload);
          if (!isExtension) {
            trackEvent("paywall_view", { variant: "scan-limit", tier: payload.tier });
          }
          return;
        }

        setError("error" in payload ? payload.error ?? "Scan failed" : "Scan failed");
        return;
      }

      const scanId =
        "scanId" in payload && typeof payload.scanId === "string" && payload.scanId.length > 0
          ? payload.scanId
          : null;
      if (!scanId) {
        setError("Scan completed but the results could not be saved. Please try again.");
        return;
      }

      stopStepProgress();
      router.push(`/scan/results?id=${encodeURIComponent(scanId)}`);
    } catch (submitErr) {
      const message =
        submitErr instanceof Error ? submitErr.message : "Unknown scan error";
      setError(message);
    } finally {
      cleanupSteps();
      setLoading(false);
    }
  }

  return (
    <section
      id="scan-form"
      className={styles.page}
    >
      <div className={styles.scanHeader}>
        <p>New review</p>
        <h1 className="text-3xl font-medium tracking-[-0.035em] text-[var(--ds-text)] sm:text-[36px]">
          Review a document
        </h1>
        <p className="mt-2 text-[13px] leading-6 text-[var(--ds-text-muted)]">
          Enter a URL, paste text, or upload a PDF. We&apos;ll analyze it in seconds.
        </p>
      </div>

      <div className={`${styles.scanContent} space-y-6`}>
        {!loading ? (
          <div className={styles.scanModes}>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleModeChange("url")}
                aria-pressed={mode === "url"}
                className={
                  mode === "url"
                    ? "relative min-h-11 px-5 text-[13px] font-medium text-[var(--ds-text)] after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-[var(--ds-accent)]"
                    : "min-h-11 px-5 text-[13px] font-medium text-[var(--ds-text-muted)] transition hover:text-[var(--ds-text)]"
                }
              >
                URL
              </button>
              <button
                type="button"
                onClick={() => handleModeChange("paste")}
                aria-pressed={mode === "paste"}
                className={
                  mode === "paste"
                    ? "relative min-h-11 px-5 text-[13px] font-medium text-[var(--ds-text)] after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-[var(--ds-accent)]"
                    : "min-h-11 px-5 text-[13px] font-medium text-[var(--ds-text-muted)] transition hover:text-[var(--ds-text)]"
                }
              >
                Paste
              </button>
              <button
                type="button"
                onClick={() => handleModeChange("upload")}
                aria-pressed={mode === "upload"}
                className={
                  mode === "upload"
                    ? "relative min-h-11 px-5 text-[13px] font-medium text-[var(--ds-text)] after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-[var(--ds-accent)]"
                    : "min-h-11 px-5 text-[13px] font-medium text-[var(--ds-text-muted)] transition hover:text-[var(--ds-text)]"
                }
              >
                Upload
              </button>
            </div>
          </div>
        ) : null}

        {loading ? (
          /* ---------- Progress UI (shown while scanning) ---------- */
          <div className="mx-auto max-w-lg">
            <ScanProgress currentStep={currentStep} />
          </div>
        ) : (
          /* ---------- Form UI (shown when idle) ---------- */
          <>
            <form ref={formRef} className="space-y-6" onSubmit={handleSubmit}>
              <div className="overflow-hidden rounded-[var(--ds-radius-md)] border border-[var(--ds-border)] bg-[var(--ds-card)] transition-colors focus-within:border-[var(--ds-accent)]">
                {mode === "url" ? (
                  <>
                    <div className="relative flex items-center px-6 py-5">
                      <Link2 className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ds-accent)]/60" />
                      <input
                        ref={urlInputRef}
                        aria-label="Legal document URL"
                        type="url"
                        value={termsUrl}
                        onChange={(event) => {
                          setTermsUrl(event.target.value);
                          if (touched.url) {
                            setFieldErrors((prev) => {
                              const next = validate(
                                { url: event.target.value, text: termsText, file: pdfFile },
                                "url",
                              );
                              return { ...prev, ...next, url: next.url };
                            });
                          }
                        }}
                        onBlur={() => setTouched((prev) => ({ ...prev, url: true }))}
                        aria-invalid={!!fieldErrors.url}
                        placeholder="https://example.com/terms"
                        inputMode="url"
                        className={`w-full border-0 bg-transparent pl-6 text-[13px] text-[var(--ds-text)] outline-none placeholder:text-[var(--ds-text-dim)] sm:text-base${fieldErrors.url ? " rounded-lg ring-2 ring-[var(--ds-danger)]" : ""}`}
                      />
                    </div>
                    {fieldErrors.url ? (
                      <p className="px-6 pb-3 text-[11px] text-[var(--ds-danger)]">{fieldErrors.url}</p>
                    ) : null}
                  </>
                ) : mode === "paste" ? (
                  <>
                    <textarea
                      value={termsText}
                      onChange={(event) => {
                        setTermsText(event.target.value);
                        if (touched.text) {
                          setFieldErrors((prev) => {
                            const next = validate(
                              { url: termsUrl, text: event.target.value, file: pdfFile },
                              "paste",
                            );
                            return { ...prev, ...next, text: next.text };
                          });
                        }
                      }}
                      onBlur={() => setTouched((prev) => ({ ...prev, text: true }))}
                      aria-invalid={!!fieldErrors.text}
                      aria-label="Legal document text"
                      placeholder="Paste the legal text here..."
                      className={`min-h-44 w-full resize-none border-0 bg-transparent px-6 py-5 text-[13px] text-[var(--ds-text)] outline-none placeholder:text-[var(--ds-text-dim)] sm:text-base${fieldErrors.text ? " rounded-lg ring-2 ring-[var(--ds-danger)]" : ""}`}
                    />
                    {fieldErrors.text ? (
                      <p className="px-6 pb-3 text-[11px] text-[var(--ds-danger)]">{fieldErrors.text}</p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-4 px-6 py-5">
                      <FileUp className="h-4 w-4 shrink-0 text-[var(--ds-accent)]/60" />
                      <input
                        ref={fileInputRef}
                        aria-label="PDF document"
                        type="file"
                        accept="application/pdf"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          setPdfFile(file);
                          if (touched.file) {
                            setFieldErrors((prev) => {
                              const next = validate(
                                { url: termsUrl, text: termsText, file: file },
                                "upload",
                              );
                              return { ...prev, ...next, file: next.file };
                            });
                          }
                        }}
                        onBlur={() => setTouched((prev) => ({ ...prev, file: true }))}
                        aria-invalid={!!fieldErrors.file}
                        className={`w-full text-[13px] text-[var(--ds-text-secondary)] file:mr-4 file:rounded-[var(--ds-radius-sm)] file:border-0 file:bg-[var(--ds-accent)] file:px-4 file:py-2 file:text-[13px] file:font-medium file:text-[var(--primary-foreground)]${fieldErrors.file ? " rounded-lg ring-2 ring-[var(--ds-danger)]" : ""}`}
                      />
                    </div>
                    {pdfFile ? (
                      <p className="px-6 pb-3 text-[11px] text-[var(--ds-text-muted)]">
                        Selected: {pdfFile.name}
                      </p>
                    ) : null}
                    {fieldErrors.file ? (
                      <p className="px-6 pb-3 text-[11px] text-[var(--ds-danger)]">{fieldErrors.file}</p>
                    ) : null}
                  </>
                )}
              </div>

              {error ? (
                <div className="flex items-start gap-3 border-y border-[var(--ds-danger)]/20 bg-[var(--ds-danger-bg)] px-1 py-4 text-[13px] leading-6 text-[var(--ds-danger)]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              <div className="flex justify-center">
                <button
                  type="submit"
                  disabled={loading || !isFormValid}
                  className="inline-flex h-12 items-center gap-3 rounded-[var(--ds-radius-md)] border border-transparent bg-[var(--ds-accent)] px-8 text-[13px] font-medium text-[var(--primary-foreground)] shadow-[var(--shadow-card)] transition hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
                  <span>Scan Now</span>
                </button>
              </div>
            </form>

            {/* Recent scans carousel — infinite revolving */}
            {recentScanTiles.length > 0 ? (
              <div className="overflow-hidden pt-8">
                <p className="text-center text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ds-text-muted)]">
                  Recent Scans
                </p>
                <LogoMarquee
                  label="Recent scans"
                  gap={0}
                  speed={30}
                  className="rounded-none border-x-0 border-[var(--ds-border)] bg-transparent shadow-none"
                  items={recentScanTiles.map((tile) => {
                    const risk = riskBadgeStyle(tile.riskScore);
                    return {
                      id: tile.id,
                      label: `${tile.name} ${tile.domain}${risk ? ` ${risk.label}` : ""}${tile.relativeDate ? ` ${tile.relativeDate}` : ""}`,
                      className: "!h-auto !w-[min(100vw-2rem,640px)] !items-stretch !rounded-none !px-4 !py-4 hover:!bg-[var(--ds-card-hover)]",
                      mark: (
                        <span className="group flex min-h-[54px] w-full items-center gap-3 text-left" title={`Rescan ${tile.name}`}>
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] bg-[var(--ds-card)]">
                            {tile.logoUrl ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={tile.logoUrl}
                                alt={`${tile.name} logo`}
                                className="h-6 w-6 rounded-md object-cover"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <span className="text-[11px] font-bold text-[var(--ds-text-dim)]">
                                {tile.name.charAt(0)}
                              </span>
                            )}
                          </span>
                          <span className="min-w-0 flex-1 space-y-0.5">
                            <span className="block truncate text-[13px] font-medium text-[var(--ds-text)]">{tile.name}</span>
                            <span className="block truncate text-[11px] leading-4 text-[var(--ds-text-dim)]">{tile.domain}</span>
                            <span className="flex items-center gap-1.5 text-[11px] text-[var(--ds-text-dim)]">
                              {risk ? <span className={risk.text}>{risk.label}</span> : null}
                              {risk && tile.relativeDate ? <span aria-hidden="true">·</span> : null}
                              {tile.relativeDate ? <span>{tile.relativeDate}</span> : null}
                            </span>
                          </span>
                          <RotateCw className="h-3.5 w-3.5 shrink-0 text-[var(--ds-text-dim)] transition-transform group-hover:rotate-[-30deg] group-hover:text-[var(--ds-accent)]" />
                        </span>
                      ),
                    };
                  })}
                  onSelect={(item) => {
                    const tile = recentScanTiles.find((candidate) => candidate.id === item.id);
                    if (tile) handleRecentScanSelect(tile);
                  }}
                />
              </div>
            ) : null}
          </>
        )}

        {contractUploadBlocked ? (
          <UpgradePrompt variant="contract-upload" tier={contractUploadTier} creditBalance={0} />
        ) : null}

        {limitNotice ? (
          isExtension ? (
            <UpgradePrompt
              variant="extension"
              tier={limitNotice.tier}
              creditBalance={0}
              resetsAt={limitNotice.resetsAt}
            />
          ) : (
            <div className="border-y border-[var(--ds-warning)]/20 bg-[var(--ds-warning-bg)] px-1 py-5">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--ds-warning)]">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <Badge tone="warning">Free limit reached</Badge>
                  <p className="mt-3 text-[13px] leading-6 text-[var(--ds-text-secondary)]">
                    You have used all {limitNotice.limit} reviews for the free tier this month.
                    Upgrade to Personal or Founder, or buy a credit pack to keep scanning now.
                  </p>
                  {limitNotice.resetsAt != null ? (
                    <p className="mt-2 text-[11px] leading-5 text-[var(--ds-text-muted)]">
                      Limits reset at {formatResetTime(limitNotice.resetsAt)}.
                    </p>
                  ) : null}
                  <div className="mt-5 flex flex-wrap gap-3">
                    <ButtonLink href="/pricing#credits" icon={BadgeDollarSign}>
                      Buy credits
                    </ButtonLink>
                    <ButtonLink href="/pricing" variant="ghost" icon={ArrowRight}>
                      View plans
                    </ButtonLink>
                  </div>
                </div>
              </div>
            </div>
          )
        ) : null}

      </div>
    </section>
  );
}
