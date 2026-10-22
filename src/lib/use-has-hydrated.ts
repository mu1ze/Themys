"use client"

import { useSyncExternalStore } from "react"

const subscribe = () => () => undefined

/**
 * Keeps browser-only account resources out of the server and first client
 * render. React hydrates the `false` snapshot, then switches to `true` once
 * hydration has completed.
 */
export function useHasHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false)
}
