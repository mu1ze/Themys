import { computeTextHash, normalizeText } from "@/lib/change-detection"
import { resolveTextFromUrl, storeResolvedText } from "@/lib/extract"
import { analyzeItem } from "@/features/scans/server/analyze"
import { getDatabase } from "@/lib/database"
import { identifyDocument } from "@/lib/document-identity"
import { documentTypeLabel } from "@/lib/document-types"
import { persistAnalysis } from "@/lib/persistence"
import {
  createAlert,
  createSnapshot,
  getLatestSnapshot,
  type MonitoringSubscription,
} from "@/lib/monitoring"
import {
  dispatchMonitoringAlertEmail,
  dispatchPendingMonitoringAlertEmails,
} from "@/lib/monitoring-email"
import { dispatchPendingBillingNotifications } from "@/lib/billing-notifications"
import { reconcileUnmatchedBillingObjects } from "@/lib/billing-operations"

const FREQUENCY_MS: Record<string, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
}

export type MonitoringJobResult = {
  checked: number
  changed: number
  alerted: number
}

export async function runMonitoringJob(): Promise<MonitoringJobResult> {
  const database = getDatabase()
  const feedbackCutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
  const feedbackPrune = await database
    .from("docs_feedback")
    .delete()
    .lt("created_at", feedbackCutoff)
  if (feedbackPrune.error) {
    console.warn("[monitor/check] Documentation feedback retention cleanup failed")
  }
  // Retry failed deliveries before checking new documents. Claims are atomic,
  // so overlapping cron invocations cannot send the same alert twice.
  await dispatchPendingMonitoringAlertEmails()
  await dispatchPendingBillingNotifications().catch((error) => {
    console.warn("[monitor/check] Billing email retry failed", error instanceof Error ? error.name : "UnknownError")
  })
  await reconcileUnmatchedBillingObjects().catch((error) => {
    console.warn("[monitor/check] Billing reconciliation failed", error instanceof Error ? error.name : "UnknownError")
  })
  const { data: allSubscriptions, error: fetchError } = await database
    .from("monitoring_subscriptions")
    .select("*")
    .eq("is_active", true)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(100)

  if (fetchError) {
    throw new Error(`Failed to fetch subscriptions: ${fetchError.message}`)
  }

  const subscriptions = (allSubscriptions ?? []) as MonitoringSubscription[]
  const now = Date.now()
  const dueSubscriptions = subscriptions.filter((sub) => {
    const intervalMs = FREQUENCY_MS[sub.frequency ?? "weekly"] ?? FREQUENCY_MS.weekly
    if (!sub.last_checked_at) return true
    return now - new Date(sub.last_checked_at).getTime() >= intervalMs
  })

  let checked = 0
  let changed = 0
  let alerted = 0

  for (const sub of dueSubscriptions) {
    try {
      checked++
      const resolved = await resolveTextFromUrl(sub.url)
      const newText = resolved.text.trim()

      try {
        await storeResolvedText(sub.url, resolved)
      } catch (cacheError) {
        console.warn(
          "[monitor/check] Text cache write skipped",
          cacheError instanceof Error ? cacheError.name : "UnknownError",
        )
      }

      if (!newText) {
        console.warn("[monitor/check] Empty text; subscription skipped")
        await database
          .from("monitoring_subscriptions")
          .update({ last_checked_at: new Date().toISOString() })
          .eq("id", sub.id)
        continue
      }

      const document = identifyDocument({ text: newText, url: sub.url })
      if (
        sub.document_type === "unknown"
        && !document.needsReview
        && document.identityKey
      ) {
        const normalizedText = normalizeText(newText)
        await createSnapshot(
          sub.url,
          sub.domain,
          computeTextHash(newText),
          normalizedText.split(/\s+/).filter(Boolean).length,
          null,
          null,
          null,
          null,
          null,
          sub.id,
          document.type,
          document.identityKey,
        )
        await database
          .from("monitoring_subscriptions")
          .update({
            last_checked_at: new Date().toISOString(),
            document_type: document.type,
            document_type_confidence: document.confidence,
            document_type_source: document.classifierVersion,
            document_type_evidence: document.evidence,
            document_identity_key: document.identityKey,
            verification_status: "active",
            verification_message: null,
          })
          .eq("id", sub.id)
        continue
      }

      if (
        document.needsReview
        || !document.identityKey
        || document.type !== sub.document_type
        || document.identityKey !== sub.document_identity_key
      ) {
        const message = document.needsReview
          ? "The document type can no longer be identified confidently."
          : `Expected ${documentTypeLabel(sub.document_type)}, but the URL now appears to be ${documentTypeLabel(document.type)}.`
        await database
          .from("monitoring_subscriptions")
          .update({
            last_checked_at: new Date().toISOString(),
            verification_status: document.needsReview ? "needs_review" : "mismatch",
            verification_message: message,
          })
          .eq("id", sub.id)
        console.warn("[monitor/check] Document identity mismatch; subscription skipped")
        continue
      }

      const normalizedText = normalizeText(newText)
      const newHash = computeTextHash(newText)
      const wordCount = normalizedText.split(/\s+/).filter(Boolean).length
      const latestSnapshot = await getLatestSnapshot(sub.url, sub.id)

      if (!latestSnapshot) {
        await createSnapshot(
          sub.url,
          sub.domain,
          newHash,
          wordCount,
          null,
          null,
          null,
          null,
          null,
          sub.id,
          document.type,
          document.identityKey,
        )
      } else if (latestSnapshot.text_hash !== newHash) {
        changed++

        try {
          // Monitoring must produce the same canonical analysis and full
          // extraction as a regular scan. Use the already-resolved text so
          // change detection and analysis operate on the exact same version
          // of the document, while analyzeItem remains the single analysis
          // contract used by the web and Developer APIs.
          const { data: user, error: userError } = await database
            .from("users")
            .select("clerk_id, email, plan, target_clauses, strict_mode, country, state")
            .eq("id", sub.user_id)
            .maybeSingle()
          if (userError) throw userError
          if (!user?.clerk_id || !user.email) throw new Error("monitoring_user_not_found")

          const supportedTiers = ["free", "base", "advanced", "lifetime"] as const
          const tier = supportedTiers.includes(user.plan as (typeof supportedTiers)[number])
            ? user.plan as (typeof supportedTiers)[number]
            : "free"
          const output = await analyzeItem(
            {
              text: newText,
              sourceUrl: sub.url,
              domain: sub.domain,
            },
            {
              bypassCache: true,
              scanSource: "web",
              targetClauses: Array.isArray(user.target_clauses) ? user.target_clauses : [],
              strictMode: user.strict_mode === true,
              userContext: { userId: user.clerk_id, tier },
            },
          )

          const scanId = await persistAnalysis({
            clerkId: user.clerk_id,
            email: user.email,
            text: output.text,
            url: sub.url,
            domain: sub.domain,
            country: typeof user.country === "string" ? user.country : null,
            state: typeof user.state === "string" ? user.state : null,
            source: "web",
            result: output.result,
            fullExtraction: output.fullExtraction,
            document: output.document,
            isMonitoringScan: true,
            previousScanId: latestSnapshot.scan_id,
          })

          const riskScore = output.result.riskScore
          const flaggedCount = output.result.flags.length
          const clauseCount = output.result.clauses.length
          const oldRisk = latestSnapshot.risk_score
          const riskDelta = oldRisk != null ? riskScore - oldRisk : null
          const parts = [`${documentTypeLabel(document.type)} text has changed`]

          if (riskDelta != null && riskDelta > 0) {
            parts.push(`Risk score increased from ${oldRisk} to ${riskScore} (+${riskDelta})`)
          } else if (riskDelta != null && riskDelta < 0) {
            parts.push(`Risk score decreased from ${oldRisk} to ${riskScore} (${riskDelta})`)
          }
          if (flaggedCount > 0) parts.push(`${flaggedCount} clauses flagged`)

          const newSnapshot = await createSnapshot(
            sub.url,
            sub.domain,
            newHash,
            wordCount,
            riskScore,
            flaggedCount,
            clauseCount,
            null,
            scanId,
            sub.id,
            document.type,
            document.identityKey,
          )

          let changeType: "text_change" | "risk_increase" | "new_flags" | "all" =
            "text_change"
          if (riskDelta != null && riskDelta > 0 && flaggedCount > 0) {
            changeType = "all"
          } else if (riskDelta != null && riskDelta > 0) {
            changeType = "risk_increase"
          } else if (flaggedCount > (latestSnapshot.flagged_count ?? 0)) {
            changeType = "new_flags"
          }

          const alert = await createAlert(
            sub.id,
            sub.user_id,
            latestSnapshot.id,
            newSnapshot.id,
            changeType,
            riskDelta,
            `${parts.join(". ")}.`,
          )
          await dispatchMonitoringAlertEmail(alert.id)
          alerted++
        } catch (analysisError) {
          console.error(
            "[monitor/check] Analysis failed",
            analysisError instanceof Error ? analysisError.name : "UnknownError",
          )
          await createSnapshot(
            sub.url,
            sub.domain,
            newHash,
            wordCount,
            null,
            null,
            null,
            null,
            null,
            sub.id,
            document.type,
            document.identityKey,
          )
        }
      }

      await database
        .from("monitoring_subscriptions")
        .update({
          last_checked_at: new Date().toISOString(),
          ...(latestSnapshot?.text_hash !== newHash
            ? { last_changed_at: new Date().toISOString() }
            : {}),
          verification_status: "active",
          verification_message: null,
        })
        .eq("id", sub.id)
    } catch (subscriptionError) {
      console.error(
        "[monitor/check] Subscription processing failed",
        subscriptionError instanceof Error ? subscriptionError.name : "UnknownError",
      )
    }
  }

  return { checked, changed, alerted }
}
