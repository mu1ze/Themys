"use client"

import { useEffect } from "react"
import { AlertTriangle, ArrowRight, BadgeDollarSign, Sparkles } from "lucide-react"

import { Badge, ButtonLink, Card } from "@/components/ui"
import { trackEvent } from "@/lib/track"
import { NpsSurvey } from "@/components/nps-survey"

type UpgradePromptVariant = "scan-limit" | "ai-limit" | "no-credits" | "extension" | "contract-upload"

type UpgradePromptProps = {
  variant: UpgradePromptVariant
  tier: string
  creditBalance: number
  resetsAt?: number
  aiResetsAt?: number
}

const variantConfig: Record<UpgradePromptVariant, {
  icon: typeof AlertTriangle
  badge: string
  title: string
  description: string
}> = {
  "scan-limit": {
    icon: AlertTriangle,
    badge: "Scan limit reached",
    title: "You've used all your reviews for this month",
    description: "Upgrade your plan or use a credit to keep scanning right now.",
  },
  "ai-limit": {
    icon: Sparkles,
    badge: "AI limit reached",
    title: "AI explanations are limited this month",
    description: "Upgrade your plan or use a credit for this one.",
  },
  "no-credits": {
    icon: AlertTriangle,
    badge: "No credits",
    title: "You're out of credits",
    description: "Buy a credit pack or upgrade your plan to keep going.",
  },
  extension: {
    icon: AlertTriangle,
    badge: "Limit reached",
    title: "Scan limit reached in extension",
    description: "Use a credit or upgrade your plan to continue.",
  },
  "contract-upload": {
    icon: AlertTriangle,
    badge: "Contract upload limit",
    title: "You've used your free contract review",
    description: "Founder includes paste and PDF upload.",
  },
}

function formatResetTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp))
}

export function UpgradePrompt({ variant, tier, creditBalance, resetsAt, aiResetsAt }: UpgradePromptProps) {
  const config = variantConfig[variant]
  const Icon = config.icon

  useEffect(() => {
    trackEvent("paywall_view", { variant, tier })
  }, [variant, tier])

  return (
    <Card className="border-[var(--ds-warning)] bg-[var(--ds-warning-bg)] p-5 shadow-[0_16px_40px_rgba(180,83,9,0.08)]">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--ds-card)] text-[var(--ds-warning)] shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <Badge tone="warning">{config.badge}</Badge>
          <p className="mt-2 text-sm font-semibold text-[var(--ds-text)]">{config.title}</p>
          <p className="mt-1 text-sm leading-6 text-[var(--ds-text-secondary)]">{config.description}</p>
          {tier && (
            <p className="mt-1 text-xs leading-5 text-[var(--ds-text-muted)]">
              Current plan: {tier.charAt(0).toUpperCase() + tier.slice(1)}.
            </p>
          )}
          {resetsAt != null && (
            <p className="mt-2 text-xs leading-5 text-[var(--ds-text-muted)]">
              Scans reset at {formatResetTime(resetsAt)}.
            </p>
          )}
          {aiResetsAt != null && (
            <p className="mt-1 text-xs leading-5 text-[var(--ds-text-muted)]">
              AI explanations reset at {formatResetTime(aiResetsAt)}.
            </p>
          )}
          {creditBalance > 0 && (
            <p className="mt-2 text-xs leading-5 text-[var(--ds-success)]">
              You have {creditBalance} credit{creditBalance === 1 ? "" : "s"} available.
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            {variant === "contract-upload" ? (
              <ButtonLink href="/pricing" icon={ArrowRight}>
                View plans
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href="/pricing#credits" icon={BadgeDollarSign}>
                  Buy credits
                </ButtonLink>
                <ButtonLink href="/pricing" variant="ghost" icon={ArrowRight}>
                  View plans
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      </div>
      <NpsSurvey
        kind="blocker"
        triggerKey={`nps_blocker_paywall_${variant}`}
        blockerPrompt="What's holding you back from upgrading?"
      />
    </Card>
  )
}
