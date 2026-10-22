"use client"

import { useEffect, useRef } from "react"

type Props = {
  route: string
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
}

export function PageViewTracker({ route, utmSource, utmMedium, utmCampaign }: Props) {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true

    const props: Record<string, string> = {}
    if (utmSource) props.utm_source = utmSource
    if (utmMedium) props.utm_medium = utmMedium
    if (utmCampaign) props.utm_campaign = utmCampaign

    void fetch("/api/events/anon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: route === "/" ? "landing_view" : "pageview",
        route,
        props,
      }),
      keepalive: true,
    }).catch(() => undefined)
  }, [route, utmSource, utmMedium, utmCampaign])

  return null
}
