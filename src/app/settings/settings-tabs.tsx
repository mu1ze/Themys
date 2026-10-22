"use client"

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react"
import {
  LogOut,
  MapPin,
  Receipt,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  User,
} from "lucide-react"

import { cn } from "@/lib/cn"

const SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "accounts", label: "Connected", icon: ShieldCheck },
  { id: "location", label: "Location", icon: MapPin },
  { id: "scan", label: "Scan prefs", icon: SlidersHorizontal },
  { id: "subscription", label: "Subscription", icon: Sparkles },
  { id: "payments", label: "Payments", icon: Receipt },
  { id: "account", label: "Account", icon: LogOut },
] as const

type SettingsTabsProps = {
  panels: Record<string, ReactNode>
}

const getHashSection = (): string => {
  const hash = window.location.hash.replace("#", "")
  return hash && SECTIONS.some((section) => section.id === hash)
    ? hash
    : (SECTIONS[0]?.id ?? "")
}

const getServerSection = (): string => SECTIONS[0]?.id ?? ""

const subscribeToHash = (callback: () => void): (() => void) => {
  window.addEventListener("popstate", callback)
  window.addEventListener("hashchange", callback)
  return () => {
    window.removeEventListener("popstate", callback)
    window.removeEventListener("hashchange", callback)
  }
}

export function SettingsTabs({ panels }: SettingsTabsProps) {
  const sections = SECTIONS
  // The URL hash is the source of truth: syncs deep links, back/forward, and tab clicks
  const active = useSyncExternalStore(subscribeToHash, getHashSection, getServerSection)
  const desktopRefs = useRef<(HTMLButtonElement | null)[]>([])
  const mobileRefs = useRef<(HTMLButtonElement | null)[]>([])
  const mobileBarRef = useRef<HTMLDivElement | null>(null)
  const [indicator, setIndicator] = useState({ top: 0, height: 0, ready: false })

  const activeIndex = Math.max(
    0,
    sections.findIndex((section) => section.id === active)
  )

  const selectSection = useCallback((id: string) => {
    if (window.location.hash.replace("#", "") === id) return
    window.history.pushState(null, "", `#${id}`)
    // pushState does not fire hashchange, so notify the store subscribers manually
    window.dispatchEvent(new Event("hashchange"))
  }, [])

  // Measure the sliding indicator on the desktop rail
  useLayoutEffect(() => {
    const measure = () => {
      const el = desktopRefs.current[activeIndex]
      if (el) {
        setIndicator({ top: el.offsetTop, height: el.offsetHeight, ready: true })
      }
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [activeIndex])

  // Keep the active mobile pill centered in the scrollable bar
  useLayoutEffect(() => {
    const bar = mobileBarRef.current
    const el = mobileRefs.current[activeIndex]
    if (!bar || !el) return
    bar.scrollTo({
      left: el.offsetLeft - bar.clientWidth / 2 + el.clientWidth / 2,
      behavior: "smooth",
    })
  }, [activeIndex])

  const handleKeyDown = useCallback(
    (
      event: KeyboardEvent<HTMLDivElement>,
      refs: RefObject<(HTMLButtonElement | null)[]>
    ) => {
      const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"]
      if (!keys.includes(event.key)) return
      event.preventDefault()

      let next = activeIndex
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        next = (activeIndex + 1) % sections.length
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        next = (activeIndex - 1 + sections.length) % sections.length
      } else if (event.key === "Home") {
        next = 0
      } else if (event.key === "End") {
        next = sections.length - 1
      }

      selectSection(sections[next].id)
      refs.current[next]?.focus()
    },
    [activeIndex, sections, selectSection]
  )

  return (
    <div className="grid w-full min-w-0 gap-6 lg:grid-cols-[196px_minmax(0,1fr)] lg:gap-10">
      {/* Mobile pill bar */}
      <div className="sticky top-[var(--site-header-height,4.5rem)] z-30 min-w-0 border-b border-[var(--ds-border)] bg-[var(--ds-bg)] lg:hidden">
        <div
          ref={mobileBarRef}
          role="tablist"
          aria-label="Settings sections"
          onKeyDown={(event) => handleKeyDown(event, mobileRefs)}
          className="flex gap-1.5 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {sections.map((section, index) => {
            const selected = section.id === active
            return (
              <button
                key={section.id}
                ref={(el) => {
                  mobileRefs.current[index] = el
                }}
                type="button"
                role="tab"
                id={`tab-m-${section.id}`}
                aria-selected={selected}
                aria-controls={`panel-${section.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectSection(section.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all duration-200",
                  selected
                    ? "bg-[var(--ds-accent)] text-[var(--primary-foreground)] shadow-[var(--shadow-card)]"
                    : "border border-[var(--ds-border)] bg-[var(--ds-card)] text-[var(--ds-text-secondary)] hover:border-[var(--ds-border-hover)] hover:text-[var(--ds-text)]"
                )}
              >
                <section.icon className="h-3.5 w-3.5" />
                {section.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Desktop rail */}
      <aside className="hidden lg:block">
        <div className="sticky top-[calc(var(--site-header-height,4.5rem)+0.75rem)]">
          <p className="px-3 pb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--ds-text-dim)]">
            Sections
          </p>
          <div
            role="tablist"
            aria-label="Settings sections"
            aria-orientation="vertical"
            onKeyDown={(event) => handleKeyDown(event, desktopRefs)}
            className="relative"
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute left-0 w-[3px] rounded-full bg-[var(--ds-accent)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                !indicator.ready && "opacity-0"
              )}
              style={{ top: indicator.top, height: indicator.height }}
            />
            <div className="space-y-0.5">
              {sections.map((section, index) => {
                const selected = section.id === active
                return (
                  <button
                    key={section.id}
                    ref={(el) => {
                      desktopRefs.current[index] = el
                    }}
                    type="button"
                    role="tab"
                    id={`tab-d-${section.id}`}
                    aria-selected={selected}
                    aria-controls={`panel-${section.id}`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => selectSection(section.id)}
                    className={cn(
                      "group flex w-full items-center gap-2.5 rounded-[var(--ds-radius-sm)] px-3 py-2 text-left text-[12px] font-medium transition-colors duration-200",
                      selected
                        ? "bg-[var(--ds-accent-glow)] text-[var(--ds-text)]"
                        : "text-[var(--ds-text-muted)] hover:bg-[var(--ds-card-hover)] hover:text-[var(--ds-text)]"
                    )}
                  >
                    <section.icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors duration-200",
                        selected
                          ? "text-[var(--ds-accent)]"
                          : "text-[var(--ds-text-dim)] group-hover:text-[var(--ds-accent)]"
                      )}
                    />
                    {section.label}
                  </button>
                )
              })}
            </div>
          </div>
          <p className="px-3 pt-3 text-[10px] text-[var(--ds-text-dim)]">
            {sections.length} sections
          </p>
          <a
            href="/dashboard/developer"
            className="mt-4 block px-3 text-[11px] text-[var(--ds-text-muted)] hover:text-[var(--ds-text)]"
          >
            Developer
          </a>
        </div>
      </aside>

      {/* Active panel */}
      <div className="w-full min-w-0">
        <div
          key={active}
          role="tabpanel"
          id={`panel-${active}`}
          aria-labelledby={`tab-m-${active} tab-d-${active}`}
          className="settings-panel-in"
        >
          {panels[active]}
        </div>
      </div>
    </div>
  )
}
