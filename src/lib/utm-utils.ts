import "server-only"

import { cookies } from "next/headers"

const UTM_COOKIE_PREFIX = "__utm_"
const UTM_COOKIE_OPTS = {
  path: "/",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 30, // 30 days — long enough to survive a signup back-and-forth
  secure: process.env.NODE_ENV === "production",
  httpOnly: false,
}

type UtmPayload = {
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  landingPage: string | null
}

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
] as const

export async function setUtmCookies(searchParams: Record<string, string | string[] | undefined>): Promise<void> {
  const jar = await cookies()

  for (const key of UTM_KEYS) {
    const val = searchParams[key]
    if (typeof val === "string" && val.length > 0 && val.length <= 200) {
      jar.set(`${UTM_COOKIE_PREFIX}${key}`, val, UTM_COOKIE_OPTS)
    }
  }
}

export async function getUtmFromCookies(): Promise<UtmPayload> {
  const jar = await cookies()

  return {
    utmSource: jar.get(`${UTM_COOKIE_PREFIX}utm_source`)?.value ?? null,
    utmMedium: jar.get(`${UTM_COOKIE_PREFIX}utm_medium`)?.value ?? null,
    utmCampaign: jar.get(`${UTM_COOKIE_PREFIX}utm_campaign`)?.value ?? null,
    landingPage: null, // set by the page that calls getOrCreateUserProfileByClerkId
  }
}

export type { UtmPayload }
