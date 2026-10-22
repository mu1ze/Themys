import { NextResponse } from "next/server"

import { currentUser } from "@clerk/nextjs/server"

import { isAdmin } from "@/lib/admin"
import { isAdminScanId } from "@/lib/admin-scan-id"
import { escapeCsvCell } from "@/lib/csv"
import { getDatabase } from "@/lib/database"
import { isJsonRecord } from "@/lib/json-value"

const MAX_IDS = 1000

const CSV_HEADERS = [
  "id",
  "title",
  "url",
  "domain",
  "risk_score",
  "clause_count",
  "flagged_count",
  "source",
  "created_at",
  "user_email",
]

export async function POST(request: Request) {
  const user = await currentUser()
  if (!user?.id || !isAdmin(user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let rawIds: unknown
  try {
    const body: unknown = await request.json()
    rawIds = isJsonRecord(body) ? body.ids : undefined
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    return NextResponse.json({ error: "Missing ids" }, { status: 400 })
  }

  if (rawIds.length > MAX_IDS) {
    return NextResponse.json(
      { error: `Too many ids (max ${MAX_IDS})` },
      { status: 400 }
    )
  }

  const ids = rawIds.filter(
    (id): id is string => typeof id === "string" && isAdminScanId(id)
  )

  if (ids.length === 0) {
    return new NextResponse(CSV_HEADERS.join(",") + "\n", {
      status: 200,
      headers: csvHeaders(`scans-${isoDateForFilename()}.csv`),
    })
  }

  const database = getDatabase()

  // A single admin-visible scan id is a content-hash prefix that may match
  // multiple DB rows (same document scanned by different users over time).
  // Use the same `raw_text_hash LIKE '${id}%'` lookup pattern as
  // deleteScanAdmin so the export reflects every row we would delete.
  const orFilters = ids.map((id) => `raw_text_hash.like.${id}%`).join(",")

  const { data: rows, error } = await database
    .from("scans")
    .select(
      "id, raw_text_hash, title, url, domain, risk_score, clause_count, flagged_count, source, created_at, user_id"
    )
    .eq("is_deleted", false)
    .or(orFilters)

  if (error) {
    console.error("[admin] bulk export query failed:", error.message)
    return NextResponse.json(
      { error: "Failed to fetch scans" },
      { status: 500 }
    )
  }

  const userIds = [
    ...new Set(
      (rows ?? []).map((r: Record<string, any>) => r.user_id).filter(Boolean) as string[],
    ),
  ]
  const emailMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: userRows } = await database
      .from("users")
      .select("id, email")
      .in("id", userIds)
    for (const u of userRows ?? []) {
      emailMap.set(u.id as string, (u.email as string) ?? "")
    }
  }

  const seen = new Set<string>()
  const lines: string[] = [CSV_HEADERS.join(",")]

  for (const row of rows ?? []) {
    if (!row.raw_text_hash) continue
    const shortHash = String(row.raw_text_hash).slice(0, 16)
    if (seen.has(shortHash)) continue
    seen.add(shortHash)

    const cells = [
      shortHash,
      row.title,
      row.url,
      row.domain,
      row.risk_score != null ? Number(row.risk_score) : null,
      Number(row.clause_count ?? 0),
      Number(row.flagged_count ?? 0),
      row.source ?? "web",
      row.created_at,
      emailMap.get(row.user_id as string) ?? "",
    ].map(escapeCsvCell)

    lines.push(cells.join(","))
  }

  return new NextResponse(lines.join("\n") + "\n", {
    status: 200,
    headers: csvHeaders(`scans-${isoDateForFilename()}.csv`),
  })
}

function csvHeaders(filename: string): HeadersInit {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  }
}

function isoDateForFilename(): string {
  return new Date().toISOString().slice(0, 10)
}
