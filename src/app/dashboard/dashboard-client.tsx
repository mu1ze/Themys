"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Bell, Check, ChevronDown, FileSearch, FileText, Globe, Link2, Search, Upload } from "lucide-react";
import type { VendorDashboardData } from "@/lib/dashboard-data";
import styles from "./dashboard.module.css";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  }).format(new Date(value));
}

function vendorLabel(title: string | null, domain: string | null): string {
  return title?.trim() || domain?.trim() || "Untitled scan";
}

const scanModes = [
  { mode: "url", icon: Link2, title: "Scan a website", detail: "Terms or privacy policy URL" },
  { mode: "paste", icon: FileText, title: "Paste your text", detail: "A contract, clause, or agreement" },
  { mode: "upload", icon: Upload, title: "Upload a PDF", detail: "Review a document from your files" },
];

export function DashboardClient({ data }: { data: VendorDashboardData }) {
  const { displayName, openDecisions, watchlist, recentPushback, creditBalance, scanCount, chromeStoreUrl } = data;
  const [query, setQuery] = useState("");
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [showAllWatched, setShowAllWatched] = useState(false);
  const isNew = scanCount === 0 && watchlist.length === 0;
  const matchingReviews = openDecisions.filter((scan) =>
    (vendorLabel(scan.title, scan.domain) + " " + (scan.domain ?? "")).toLowerCase().includes(query.trim().toLowerCase()),
  );
  const visibleReviews = showAllReviews || query.trim() ? matchingReviews : matchingReviews.slice(0, 5);
  const watched = [...watchlist].sort((a, b) => Number(b.hasUnreadAlert) - Number(a.hasUnreadAlert));
  const visibleWatched = showAllWatched ? watched : watched.slice(0, 4);
  const unreadCount = watched.filter((item) => item.hasUnreadAlert).length;

  return (
    <div className={styles.dashboard}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Your workspace</p>
          <h1>{isNew ? "Welcome" : "Welcome back"}, {displayName}.</h1>
          <p className={styles.subtitle}>A clearer view of what you agree to.</p>
        </div>
        <Link href="/pricing" className={styles.creditLink}>
          <span className={styles.creditDot} aria-hidden="true" />
          {creditBalance} credit{creditBalance === 1 ? "" : "s"} available
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </header>

      <section className={styles.launcher} aria-labelledby="start-review-title">
        <div className={styles.launcherIntro}>
          <span className={styles.launcherIcon}><FileSearch size={22} aria-hidden="true" /></span>
          <div>
            <p className={styles.eyebrow}>Start with the fine print</p>
            <h2 id="start-review-title">Before you agree,<br />get the full picture.</h2>
            <p>Turn lengthy terms into a plain-English review of what matters to you.</p>
          </div>
        </div>
        <nav className={styles.scanModes} aria-label="Start a review">
          {scanModes.map(({ mode, icon: Icon, title, detail }) => (
            <Link key={mode} href={"/scan/new?mode=" + mode} className={styles.scanMode}>
              <Icon size={18} aria-hidden="true" />
              <span><strong>{title}</strong><small>{detail}</small></span>
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </section>

      <div className={styles.workspace}>
        <section aria-labelledby="reviews-title">
          <div className={styles.sectionHeading}>
            <div><h2 id="reviews-title">Pick up where you left off</h2><p>Your latest scans with an open decision.</p></div>
            <Link href="/history" className={styles.textLink}>History <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
          <div className={styles.reviewCard}>
            {openDecisions.length > 0 ? (
              <>
                <div className={styles.listToolbar}>
                  <span>Open reviews <span className={styles.count}>{openDecisions.length} recent</span></span>
                  <label className={styles.search}>
                    <Search size={15} aria-hidden="true" />
                    <span className="sr-only">Search open reviews</span>
                    <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a review…" />
                  </label>
                </div>
                <ul className={styles.reviewList} aria-label="Open reviews">
                  {visibleReviews.map((scan) => (
                    <li key={scan.id}>
                      <Link href={"/scan/results?id=" + encodeURIComponent(scan.id)} className={styles.reviewRow}>
                        <span className={styles.documentIcon}>{scan.domain ? <Globe size={18} aria-hidden="true" /> : <FileText size={18} aria-hidden="true" />}</span>
                        <span className={styles.reviewIdentity}>
                          <strong>{vendorLabel(scan.title, scan.domain)}</strong>
                          <small>{scan.domain || "Pasted or uploaded"}<span aria-hidden="true"> · </span>{formatDate(scan.createdAt)}</small>
                        </span>
                        <span className={styles.reviewStatus}>
                          <span className={styles.attention} data-level={scan.attentionLabel}>
                            <span aria-hidden="true" />{scan.attentionLabel}
                          </span>
                          <ArrowRight size={15} aria-hidden="true" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {matchingReviews.length === 0 && <p className={styles.noMatches} role="status">No open reviews match “{query}”. Try another name.</p>}
                {openDecisions.length > 5 && !query.trim() && (
                  <button type="button" className={styles.listFooter} onClick={() => setShowAllReviews(!showAllReviews)} aria-expanded={showAllReviews}>
                    {showAllReviews ? "Show fewer reviews" : "Show all " + openDecisions.length + " recent open reviews"}<ChevronDown size={14} aria-hidden="true" className={showAllReviews ? styles.rotated : undefined} />
                  </button>
                )}
              </>
            ) : (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>{isNew ? <FileSearch size={23} aria-hidden="true" /> : <Check size={23} aria-hidden="true" />}</span>
                <h3>{isNew ? "Your first review starts here" : "No open decisions"}</h3>
                <p>{isNew ? "Scan a website or bring your own document. Your review and next steps will be saved here." : "New scans appear here until you record a decision. You can revisit past reviews in your history."}</p>
                <Link href={isNew ? "/scan/new?mode=url" : "/history"} className={styles.primaryLink}>{isNew ? "Start your first scan" : "View scan history"}<ArrowRight size={15} aria-hidden="true" /></Link>
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="watchlist-title">
          <div className={styles.sectionHeading}>
            <div><h2 id="watchlist-title">On your radar</h2><p>Keep up with the services you watch.</p></div>
            <Link href="/monitoring" className={styles.textLink}>Manage <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
          <div className={styles.watchCard}>
            <div className={styles.watchSummary}>
              <Bell size={17} aria-hidden="true" />
              <span>{unreadCount > 0 ? unreadCount + " watched service" + (unreadCount === 1 ? " has" : "s have") + " unread alerts" : watchlist.length > 0 ? "No unread alerts" : "Your watchlist is ready"}</span>
              {unreadCount > 0 && <span className={styles.unreadDot} aria-hidden="true" />}
            </div>
            {watchlist.length > 0 ? (
              <>
                <ul className={styles.watchList}>
                  {visibleWatched.map((item) => (
                    <li key={item.id}>
                      <Link href="/monitoring" className={styles.watchRow}>
                        <div><strong>{vendorLabel(item.title, item.domain)}</strong><span className={styles.watchStatus} data-unread={item.hasUnreadAlert}>{item.hasUnreadAlert ? "Unread alert" : item.lastCheckedAt ? "Checked " + formatDate(item.lastCheckedAt) : "Not checked yet"}</span></div>
                        <small>{item.emailEnabled ? "Email on" : "In-app"}</small>
                      </Link>
                    </li>
                  ))}
                </ul>
                {watchlist.length > 4 && <button type="button" className={styles.listFooter} onClick={() => setShowAllWatched(!showAllWatched)} aria-expanded={showAllWatched}>{showAllWatched ? "Show fewer services" : "Show all " + watchlist.length + " services"}<ChevronDown size={14} aria-hidden="true" className={showAllWatched ? styles.rotated : undefined} /></button>}
              </>
            ) : (
              <div className={styles.watchEmpty}><p>Terms can change after you agree. Add a service to follow future updates.</p><Link href="/monitoring" className={styles.textLink}>Add a service <ArrowRight size={14} aria-hidden="true" /></Link></div>
            )}
          </div>
        </section>
      </div>

      {recentPushback.length > 0 && (
        <section className={styles.pushback} aria-labelledby="pushback-title">
          <div className={styles.sectionHeading}><div><h2 id="pushback-title">Worth a conversation</h2><p>Suggested asks from your recent reviews.</p></div></div>
          <div className={styles.pushbackGrid}>
            {recentPushback.map((entry) => (
              <article key={entry.scanId} className={styles.pushbackCard}>
                <div className={styles.pushbackHeading}><FileText size={15} aria-hidden="true" /><h3>{vendorLabel(entry.title, entry.domain)}</h3></div>
                <p className={styles.ask}>{entry.items[0]?.suggestedAsk}</p>
                {entry.items.length > 1 && <details className={styles.moreAsks}><summary>{entry.items.length - 1} more suggested {entry.items.length === 2 ? "ask" : "asks"}<ChevronDown size={13} aria-hidden="true" /></summary><ol start={2}>{entry.items.slice(1).map((item, index) => <li key={item.clauseId ?? index}>{item.suggestedAsk}</li>)}</ol></details>}
                <Link href={"/scan/results?id=" + encodeURIComponent(entry.scanId)} className={styles.textLink}>Review the context <ArrowRight size={14} aria-hidden="true" /></Link>
              </article>
            ))}
          </div>
        </section>
      )}

      <footer className={styles.footer}>
        <span>Your reviews stay here, ready when you need them.</span>
        {chromeStoreUrl && <a href={chromeStoreUrl} target="_blank" rel="noopener noreferrer" className={styles.textLink}>Get the browser extension <ArrowRight size={14} aria-hidden="true" /></a>}
      </footer>
    </div>
  );
}
