"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { UserButton, useAuth } from "@clerk/nextjs";
import { Menu, X } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { ButtonLink } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/cn";
import { useHasHydrated } from "@/lib/use-has-hydrated";

const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.themys.ca";

type AppNavItem = {
  href: string;
  label: string;
};

const APP_PRIMARY_NAV: AppNavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/monitoring", label: "Monitoring" },
  { href: "/history", label: "History" },
  { href: "/settings", label: "Settings" },
];

const APP_OVERLAY_NAV: AppNavItem[] = [
  ...APP_PRIMARY_NAV,
  { href: "/dashboard/developer", label: "Developer" },
];

function isActiveNav(pathname: string, href: string) {
  if (href === "/scan/new") {
    return pathname.startsWith("/scan");
  }
  if (href === "/dashboard") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Clerk's UserButton renders nothing during SSR. Mounting after hydration
 * keeps the first client render identical to the server HTML.
 */
function HeaderUserButton() {
  const hydrated = useHasHydrated();
  if (!hydrated) return null;
  return (
    <UserButton
      userProfileMode="navigation"
      userProfileUrl="/settings#profile"
    />
  );
}

export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const { isLoaded, isSignedIn } = useAuth();
  const [menuState, setMenuState] = useState({ pathname, open: false });
  const menuOpen = menuState.pathname === pathname && menuState.open;
  const barRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(72);

  const setMenuOpen = useCallback((open: boolean | ((current: boolean) => boolean)) => {
    setMenuState((current) => {
      const currentOpen = current.pathname === pathname && current.open;
      return {
        pathname,
        open: typeof open === "function" ? open(currentOpen) : open,
      };
    });
  }, [pathname]);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;

    const update = () => {
      const height = Math.round(el.getBoundingClientRect().height);
      setHeaderHeight(height);
      document.documentElement.style.setProperty("--site-header-height", `${height}px`);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isSignedIn, pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, setMenuOpen]);

  if (pathname.startsWith("/admin")) return null;
  if (pathname.startsWith("/scan/results")) return null;
  if (pathname === "/sign-in" || pathname.startsWith("/sign-in/")) return null;
  if (pathname === "/sign-up" || pathname.startsWith("/sign-up/")) return null;

  const onLanding = pathname === "/";
  const compactAppHeader = ["/dashboard", "/monitoring", "/history", "/scan/new"].includes(pathname);
  const isMarketing = onLanding || (!isSignedIn && ["/pricing", "/features"].includes(pathname));
  const anchorBase = onLanding ? "" : "/";
  const menuBreakpointClass = isMarketing ? "md:hidden" : "lg:hidden";

  const marketingLinks = [
    { href: "/features", label: "Features" },
    { href: `${anchorBase}#how-it-works`, label: "How it works" },
    { href: `${anchorBase}#pricing`, label: "Pricing" },
    { href: DOCS_URL, label: "Docs", external: true },
  ];

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-[var(--ds-nav-border)] bg-[var(--ds-nav-bg)] font-[family-name:var(--ds-doc-font)] backdrop-blur-md">
        <div
          ref={barRef}
          className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8"
        >
          <BrandMark condensed={compactAppHeader} />

          {isMarketing ? (
            <nav className="hidden items-center gap-8 md:flex" aria-label="Marketing">
              {marketingLinks.map((item) =>
                item.external ? (
                  <a
                    key={item.label}
                    href={item.href}
                    className="text-[15px] text-[var(--ds-text-secondary)] transition hover:text-[var(--ds-text)]"
                  >
                    {item.label}
                  </a>
                ) : (
                  <a
                    key={item.label}
                    href={item.href}
                    className="text-[15px] text-[var(--ds-text-secondary)] transition hover:text-[var(--ds-text)]"
                  >
                    {item.label}
                  </a>
                ),
              )}
            </nav>
          ) : (
            <nav className={cn("hidden items-center lg:flex", compactAppHeader ? "gap-1" : "gap-6")} aria-label="Primary navigation">
              {APP_PRIMARY_NAV.map((item) => {
                const active = isActiveNav(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "transition-colors",
                      compactAppHeader ? "rounded-full px-4 py-2 text-[13px]" : "text-[15px]",
                      compactAppHeader && active && "bg-[var(--ds-card-hover)]",
                      active
                        ? "text-[var(--ds-text)]"
                        : "text-[var(--ds-text-muted)] hover:text-[var(--ds-text)]",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <ButtonLink href="/scan/new" className={cn("h-10 px-4", compactAppHeader ? "ml-3 text-[13px]" : "text-[15px]")}>
                Scan
              </ButtonLink>
            </nav>
          )}

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {!isLoaded ? (
              <div className="h-8 w-8 rounded-full bg-[var(--ds-card-hover)]" />
            ) : isSignedIn ? (
              <div className="flex items-center gap-2">
                {isMarketing ? (
                  <ButtonLink href="/dashboard" variant="ghost" className="hidden h-10 sm:inline-flex">
                    Dashboard
                  </ButtonLink>
                ) : null}
                <HeaderUserButton />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <ButtonLink
                  href="/sign-in"
                  variant="ghost"
                  className={cn("h-10", onLanding ? "hidden md:inline-flex" : "hidden sm:inline-flex")}
                >
                  Sign in
                </ButtonLink>
                {onLanding ? null : (
                  <ButtonLink href="/sign-up" className="h-10">
                    Start free
                  </ButtonLink>
                )}
              </div>
            )}

            <button
              type="button"
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--ds-text)] hover:bg-[var(--ds-card-hover)]",
                menuBreakpointClass,
              )}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {menuOpen ? (
        <div
          className={cn("fixed inset-x-0 bottom-0 z-40 overflow-y-auto overscroll-contain border-t border-[var(--ds-border)] bg-[var(--ds-card)] px-4 py-5 font-[family-name:var(--ds-doc-font)] sm:px-6", menuBreakpointClass)}
          style={{ top: headerHeight }}
        >
            {isMarketing ? (
              <nav className="flex flex-col gap-1" aria-label="Marketing menu">
                {marketingLinks.map((item) =>
                  item.external ? (
                    <a
                      key={item.label}
                      href={item.href}
                      className="rounded-[16px] px-3 py-3 text-[17px] text-[var(--ds-text)]"
                      onClick={() => setMenuOpen(false)}
                    >
                      {item.label}
                    </a>
                  ) : (
                    <a
                      key={item.label}
                      href={item.href}
                      className="rounded-[16px] px-3 py-3 text-[17px] text-[var(--ds-text)]"
                      onClick={() => setMenuOpen(false)}
                    >
                      {item.label}
                    </a>
                  ),
                )}
                {!isSignedIn ? (
                  <Link
                    href="/sign-in"
                    className="rounded-[16px] px-3 py-3 text-[17px] text-[var(--ds-text)]"
                    onClick={() => setMenuOpen(false)}
                  >
                    Sign in
                  </Link>
                ) : (
                  <Link
                    href="/dashboard"
                    className="rounded-[16px] px-3 py-3 text-[17px] text-[var(--ds-text)]"
                    onClick={() => setMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                )}
              </nav>
            ) : (
              <nav className="flex flex-col gap-1" aria-label="App menu">
                <Link
                  href="/scan/new"
                  className="rounded-full bg-[var(--ds-accent)] px-4 py-3 text-center text-[16px] text-[var(--primary-foreground)]"
                  onClick={() => setMenuOpen(false)}
                >
                  Scan
                </Link>
                {APP_OVERLAY_NAV.map((item) => {
                  const active = isActiveNav(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "rounded-[16px] px-3 py-3 text-[17px]",
                        active ? "text-[var(--ds-text)]" : "text-[var(--ds-text-secondary)]",
                      )}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            )}
        </div>
      ) : null}
      <div aria-hidden="true" className="w-full" style={{ height: headerHeight }} />
    </>
  );
}
