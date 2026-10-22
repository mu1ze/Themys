import type { Metadata } from "next"
import { auth } from "@clerk/nextjs/server"
import { TrustBadges } from "@/components/trust-badges"
import { SiteFooter } from "@/components/site-footer"
import { setUtmCookies } from "@/lib/utm-utils"
import { PageViewTracker } from "@/components/pageview-tracker"
import { LandingMain } from "@/components/landing/marketing"

// Extension availability remains gated: process.env.NEXT_PUBLIC_CHROME_STORE_URL

export const metadata: Metadata = {
  title: "Themys — Know What You Agree To",
  description:
    "Before you sign, see what the fine print actually says. Summaries and flagged clauses for vendor paper or any app, with Themys.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Themys — Know What You Agree To",
    description:
    "Before you sign, see what the fine print actually says. Summaries and flagged clauses for vendor paper or any app, with Themys.",
  },
  twitter: {
    title: "Themys — Know What You Agree To",
    description:
      "Before you sign, see what the fine print actually says.",
  },
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  await setUtmCookies(params)

  const { isAuthenticated } = await auth()

  const utmSource = typeof params.utm_source === "string" ? params.utm_source : null
  const utmMedium = typeof params.utm_medium === "string" ? params.utm_medium : null
  const utmCampaign = typeof params.utm_campaign === "string" ? params.utm_campaign : null

  return (
    <div className="bg-[var(--ds-bg)] text-[var(--ds-text)]">
      <PageViewTracker route="/" utmSource={utmSource} utmMedium={utmMedium} utmCampaign={utmCampaign} />

      <LandingMain isAuthenticated={isAuthenticated} />

      <div className="border-t border-[var(--ds-border)] bg-[var(--ds-card)] py-4">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <TrustBadges />
        </div>
      </div>

      <SiteFooter />
    </div>
  )
}
