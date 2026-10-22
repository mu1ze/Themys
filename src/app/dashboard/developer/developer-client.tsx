"use client"

import { useState, useCallback } from "react"
import {
  Copy,
  Check,
  Eye,
  EyeOff,
  Key,
  Plus,
  Trash2,
  AlertTriangle,
  Terminal,
  FileCode,
} from "lucide-react"
import { EmptyState, PageHeader, PageShell, Section, StatStrip } from "@/components/ui"
import { Modal } from "@/components/modal"
import { SegmentedControl } from "@/components/segmented-control"
import { DEVELOPER_API_MEDIA_TYPE, DEVELOPER_API_VERSION } from "@/contracts/developer-api"
import { getErrorMessage, getStringProperty } from "@/lib/json-value"

// ── Types ──────────────────────────────────────────────────────────────────

type ApiKeyItem = {
  id: string
  name: string
  keyPrefix: string
  scopes: string[]
  requestCount: number
  lastUsedAt: string | null
  createdAt: string
}

type UsageStats = {
  totalRequests: number
  successCount: number
  errorCount: number
  successRate: number
  errorRate: number
  dailyRequests: { date: string; count: number }[]
  recentErrors: { date: string; statusCode: number; endpoint: string; message: string }[]
}

type Props = {
  initialKeys: ApiKeyItem[]
  initialStats: UsageStats
}

// ── Code Snippets ──────────────────────────────────────────────────────────

function getSnippets(keyPrefix: string) {
  return {
    curl: `curl -X POST "https://themys.ca/api/analyze" \\
  -H "Authorization: Bearer ${keyPrefix}..." \\
  -H "Accept: ${DEVELOPER_API_MEDIA_TYPE}" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://example.com/terms"}'`,
    javascript: `const response = await fetch("https://themys.ca/api/analyze", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${keyPrefix}...",
    "Accept": "${DEVELOPER_API_MEDIA_TYPE}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ url: "https://example.com/terms" }),
});

const payload = await response.json();
if (!payload.ok) throw new Error(payload.error.message);
console.log(payload.data);`,
    python: `import requests

response = requests.post(
    "https://themys.ca/api/analyze",
    headers={
        "Authorization": "Bearer ${keyPrefix}...",
        "Accept": "${DEVELOPER_API_MEDIA_TYPE}",
        "Content-Type": "application/json",
    },
    json={"url": "https://example.com/terms"},
)

payload = response.json()
if not payload["ok"]:
    raise RuntimeError(payload["error"]["message"])
print(payload["data"])`,
  }
}

// ── Clipboard helper ───────────────────────────────────────────────────────

function useCopyToClipboard() {
  const [copied, setCopied] = useState<string | null>(null)

  const copy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    })
  }, [])

  return { copied, copy }
}

function CopyButton({ text, id }: { text: string; id: string }) {
  const { copied, copy } = useCopyToClipboard()
  return (
    <button
      onClick={() => copy(text, id)}
      className="inline-flex items-center gap-1.5 rounded-lg border bg-[var(--ds-card-hover)] px-2.5 py-1.5 text-xs font-medium text-[var(--ds-text-secondary)] transition hover:text-[var(--ds-text)]"
      style={{ borderColor: "var(--ds-border)" }}
    >
      {copied === id ? <Check className="h-3.5 w-3.5 text-[var(--ds-success)]" /> : <Copy className="h-3.5 w-3.5" />}
      {copied === id ? "Copied" : "Copy"}
    </button>
  )
}

// ── Bar Chart (CSS-only) ──────────────────────────────────────────────────

function BarChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  const displayData = data.slice(-14) // Show last 14 days

  return (
    <div className="mt-4">
      <div className="flex items-end gap-1" style={{ height: 120 }}>
        {displayData.map((d) => (
          <div key={d.date} className="group relative flex flex-1 flex-col items-center">
            <div
              className="w-full rounded-t-sm bg-[var(--ds-accent)] transition-all group-hover:opacity-80"
              style={{ height: `${Math.max((d.count / max) * 100, d.count > 0 ? 8 : 0)}%`, minHeight: d.count > 0 ? 4 : 0 }}
            />
            <div className="pointer-events-none absolute -top-8 hidden whitespace-nowrap rounded-md bg-[var(--ds-card)] px-2 py-1 text-xs text-[var(--ds-text)] shadow-lg group-hover:block border border-[var(--ds-border)]">
              {d.count} requests
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {displayData.map((d) => (
          <div key={d.date} className="flex-1 text-center">
            <span className="text-[15px] text-[var(--ds-text-dim)]">
              {d.date.slice(5)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Create Key Modal ──────────────────────────────────────────────────────

function CreateKeyModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (key: ApiKeyItem, rawKey: string) => void
}) {
  const [name, setName] = useState("")
  const [scopes, setScopes] = useState<Array<"extract" | "analyze">>(["extract", "analyze"])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (scopes.length === 0) {
      setError("Select at least one permission")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/developer/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined, scopes }),
      })
      const data: unknown = await res.json()
      if (!res.ok) throw new Error(getErrorMessage(data, "Failed to create key"))

      const id = getStringProperty(data, "id")
      const keyPrefix = getStringProperty(data, "keyPrefix")
      const rawKey = getStringProperty(data, "key")
      if (!id || !keyPrefix || !rawKey) throw new Error("The server returned an invalid API key response")

      onCreated(
        {
          id,
          name: name.trim() || `API Key`,
          keyPrefix,
          scopes,
          requestCount: 0,
          lastUsedAt: null,
          createdAt: new Date().toISOString(),
        },
        rawKey
      )
      setName("")
      setScopes(["extract", "analyze"])
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create key")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create API key"
      description="Name the key so you can identify where it is used."
      className="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="h-10 rounded-[var(--ds-radius-sm)] border border-[var(--ds-border)] px-4 text-sm font-medium text-[var(--ds-text-secondary)] transition hover:border-[var(--ds-border-hover)] hover:bg-[var(--ds-card-hover)]">Cancel</button>
          <button onClick={handleCreate} disabled={loading} className="h-10 rounded-[var(--ds-radius-sm)] border border-transparent bg-[var(--ds-accent)] px-4 text-sm font-medium text-[var(--primary-foreground)] shadow-[var(--shadow-card)] transition hover:brightness-110 active:brightness-95 disabled:opacity-50">{loading ? "Creating…" : "Create key"}</button>
        </div>
      }
    >
        <div>
          <label className="text-sm font-medium text-[var(--ds-text-secondary)]">Key Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Production, Development"
            className="mt-1.5 min-h-11 w-full rounded-[var(--ds-radius-sm)] border bg-[var(--ds-bg)] px-4 text-sm text-[var(--ds-text)] placeholder:text-[var(--ds-text-dim)] focus:border-[var(--ds-accent)] focus:outline-none"
            style={{ borderColor: "var(--ds-border)" }}
          />
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-[var(--ds-text-secondary)]">Permissions</legend>
          <p className="mt-1 text-xs text-[var(--ds-text-muted)]">Grant only the operations this integration needs.</p>
          <div className="mt-2 flex flex-wrap gap-4">
            {(["extract", "analyze"] as const).map((scope) => (
              <label key={scope} className="inline-flex items-center gap-2 text-sm text-[var(--ds-text)]">
                <input
                  type="checkbox"
                  checked={scopes.includes(scope)}
                  onChange={(event) => setScopes((current) => event.target.checked
                    ? [...current, scope]
                    : current.filter((item) => item !== scope))}
                />
                <code>{scope}</code>
              </label>
            ))}
          </div>
        </fieldset>

        {error && (
          <p className="mt-3 text-sm text-[var(--ds-danger)]">{error}</p>
        )}

    </Modal>
  )
}

// ── Key Result Modal (shows raw key once) ─────────────────────────────────

function KeyResultModal({
  rawKey,
  open,
  onClose,
}: {
  rawKey: string | null
  open: boolean
  onClose: () => void
}) {
  const [visible, setVisible] = useState(false)
  const { copied, copy } = useCopyToClipboard()

  if (!rawKey) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="API key created"
      description="Copy and store this key before closing this dialog."
      className="max-w-lg"
      footer={
        <div className="flex justify-end">
          <button onClick={() => copy(rawKey, "raw-key")} className="inline-flex h-10 items-center gap-2 rounded-[var(--ds-radius-sm)] border border-transparent bg-[var(--ds-accent)] px-4 text-sm font-medium text-[var(--primary-foreground)] shadow-[var(--shadow-card)] transition hover:brightness-110 active:brightness-95">
            {copied === "raw-key" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied === "raw-key" ? "Copied" : "Copy key"}
          </button>
        </div>
      }
    >
        <div className="border-y border-[var(--ds-warning)]/30 bg-[var(--ds-warning-bg)] px-1 py-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ds-warning)]" />
            <div>
              <p className="text-sm font-semibold text-[var(--ds-warning)]">Save this key — it will not be shown again.</p>
              <p className="mt-1 text-xs text-[var(--ds-text-muted)]">
                This is the only time you can see and copy this key. Store it securely.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-[var(--ds-radius-sm)] border bg-[var(--ds-bg)] p-3" style={{ borderColor: "var(--ds-border)" }}>
          <code className="flex-1 overflow-x-auto font-mono text-sm text-[var(--ds-text)]">
            {visible ? rawKey : rawKey.slice(0, 16) + "••••••••••••••••"}
          </code>
          <button
            onClick={() => setVisible(!visible)}
            className="shrink-0 text-[var(--ds-text-muted)] hover:text-[var(--ds-text)]"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

    </Modal>
  )
}

// ── Main Component ────────────────────────────────────────────────────────

export function DeveloperClient({ initialKeys, initialStats }: Props) {
  const [keys, setKeys] = useState<ApiKeyItem[]>(initialKeys)
  const [stats] = useState<UsageStats>(initialStats)
  const [createOpen, setCreateOpen] = useState(false)
  const [newRawKey, setNewRawKey] = useState<string | null>(null)
  const [resultOpen, setResultOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"curl" | "javascript" | "python">("curl")
  const [revoking, setRevoking] = useState<string | null>(null)
  const snippets = getSnippets(keys[0]?.keyPrefix ?? "tmys_abc1234")

  const handleCreated = (key: ApiKeyItem, rawKey: string) => {
    setKeys((prev) => [key, ...prev])
    setNewRawKey(rawKey)
    setResultOpen(true)
  }

  const handleRevoke = async (keyId: string) => {
    if (!confirm("Revoke this API key? This action cannot be undone.")) return
    setRevoking(keyId)
    try {
      const res = await fetch(`/api/developer/keys/${keyId}`, { method: "DELETE" })
      if (!res.ok) {
        const data: unknown = await res.json()
        throw new Error(getErrorMessage(data, "Failed to revoke key"))
      }
      setKeys((prev) => prev.filter((k) => k.id !== keyId))
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to revoke key")
    } finally {
      setRevoking(null)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--ds-bg)]">
      <PageShell className="space-y-8">
        <PageHeader
          title="Developer portal"
          description="Manage API keys, monitor usage, and integrate with Themys."
          actions={
            <button onClick={() => setCreateOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-[var(--ds-radius-sm)] border border-transparent bg-[var(--ds-accent)] px-4 text-sm font-medium text-[var(--primary-foreground)] shadow-[var(--shadow-card)] transition hover:brightness-110 active:brightness-95">
              <Plus className="h-4 w-4" />
              Create API key
            </button>
          }
        />

        <div
          role="note"
          className="border-y border-[var(--ds-warning)]/30 bg-[var(--ds-warning-bg)] px-1 py-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ds-warning)]" />
            <div>
              <p className="text-sm font-semibold text-[var(--ds-warning)]">
                Experimental API
              </p>
              <p className="mt-1 text-sm text-[var(--ds-text-secondary)]">
                The Developer API is experimental. This response contract is versioned; breaking format changes require a new schema version.
              </p>
            </div>
          </div>
        </div>

        {/* Usage Stats */}
        <Section title="Usage dashboard" description="Request volume and reliability across the last 14 days.">
          <StatStrip items={[
            { label: "Total requests", value: stats.totalRequests, tone: "primary" },
            { label: "Success rate", value: `${stats.successRate}%`, tone: "success" },
            { label: "Error rate", value: `${stats.errorRate}%`, tone: "danger" },
            { label: "Total errors", value: stats.errorCount, tone: "warning" },
          ]} />

          <div className="mt-6">
            <h3 className="text-sm font-medium text-[var(--ds-text-secondary)]">Daily Requests (last 14 days)</h3>
            {stats.dailyRequests.length > 0 ? (
              <BarChart data={stats.dailyRequests} />
            ) : (
              <p className="mt-4 text-sm text-[var(--ds-text-dim)]">No request data yet. Start using your API key to see usage.</p>
            )}
          </div>

          {/* Recent Errors */}
          {stats.recentErrors.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-medium text-[var(--ds-text-secondary)]">Recent Errors</h3>
              <div className="divide-y divide-[var(--ds-border)] border-y border-[var(--ds-border)]">
                {stats.recentErrors.map((err, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-1 py-3 text-sm"
                  >
                    <span className="shrink-0 rounded-md bg-[var(--ds-danger)] px-1.5 py-0.5 text-xs font-bold text-white">
                      {err.statusCode}
                    </span>
                    <span className="flex-1 truncate text-[var(--ds-text)]">{err.endpoint}</span>
                    <span className="shrink-0 text-xs text-[var(--ds-text-muted)]">
                      {new Date(err.date).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* API Keys */}
        <Section title="API keys" description="Create, inspect, and revoke credentials used by your integrations.">
          {keys.length === 0 ? (
            <EmptyState icon={Key} title="No API keys yet" actions={<button onClick={() => setCreateOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-[var(--ds-radius-sm)] border border-transparent bg-[var(--ds-accent)] px-4 text-sm font-medium text-[var(--primary-foreground)] shadow-[var(--shadow-card)] transition hover:brightness-110 active:brightness-95"><Plus className="h-4 w-4" />Create your first key</button>} />
          ) : (
            <>
              <div className="divide-y divide-[var(--ds-border)] border-y border-[var(--ds-border)] md:hidden">
                {keys.map((key) => (
                  <div key={key.id} className="space-y-3 px-1 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><p className="truncate text-sm font-medium text-[var(--ds-text)]">{key.name}</p><code className="mt-1 block text-xs text-[var(--ds-text-muted)]">{key.keyPrefix}…</code></div>
                      <button onClick={() => handleRevoke(key.id)} disabled={revoking === key.id} className="inline-flex h-8 items-center gap-1.5 rounded-[var(--ds-radius-sm)] px-3 text-xs font-medium text-[var(--ds-danger)] transition hover:bg-[var(--ds-danger-bg)] disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />{revoking === key.id ? "Revoking…" : "Revoke"}</button>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--ds-text-muted)]"><span>{key.requestCount.toLocaleString()} requests</span><span>Last used {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : "never"}</span><span>Created {new Date(key.createdAt).toLocaleDateString()}</span></div>
                    <div className="flex gap-1">{key.scopes.map((scope) => <span key={scope} className="text-xs text-[var(--ds-info)]">{scope}</span>)}</div>
                  </div>
                ))}
              </div>
              <table className="hidden w-full table-fixed border-y border-[var(--ds-border)] text-left text-sm md:table">
                <thead>
                  <tr className="border-b text-xs font-medium uppercase tracking-wider text-[var(--ds-text-muted)]" style={{ borderColor: "var(--ds-border)" }}>
                    <th className="pb-3 pr-4">Name</th>
                    <th className="pb-3 pr-4">Key Prefix</th>
                    <th className="pb-3 pr-4">Scopes</th>
                    <th className="pb-3 pr-4">Requests</th>
                    <th className="pb-3 pr-4">Last Used</th>
                    <th className="pb-3 pr-4">Created</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => (
                    <tr key={key.id} className="border-b transition-colors hover:bg-[var(--ds-card-hover)]" style={{ borderColor: "var(--ds-border)" }}>
                      <td className="py-3 pr-4 font-medium text-[var(--ds-text)]">{key.name}</td>
                      <td className="py-3 pr-4">
                        <code className="rounded-md bg-[var(--ds-bg)] px-2 py-1 font-mono text-xs text-[var(--ds-text-secondary)]">
                          {key.keyPrefix}…
                        </code>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex gap-1">
                          {key.scopes.map((scope) => (
                            <span
                              key={scope}
                              className="rounded-md bg-[var(--ds-info-bg)] px-1.5 py-0.5 text-xs font-medium text-[var(--ds-info)]"
                            >
                              {scope}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-[var(--ds-text-secondary)]">{key.requestCount.toLocaleString()}</td>
                      <td className="py-3 pr-4 text-[var(--ds-text-muted)]">
                        {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : "Never"}
                      </td>
                      <td className="py-3 pr-4 text-[var(--ds-text-muted)]">
                        {new Date(key.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleRevoke(key.id)}
                          disabled={revoking === key.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-[var(--ds-danger)] transition hover:bg-[var(--ds-danger-bg)] disabled:opacity-50"
                          style={{ borderColor: "var(--ds-border)" }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {revoking === key.id ? "Revoking…" : "Revoke"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Section>

        {/* Quick Start */}
        <Section title="Quick start" description="Send a public target URL and Themys will extract and analyze it. Replace the key prefix with your full key.">
          <SegmentedControl
            label="Code language"
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { value: "curl", label: "cURL", icon: Terminal },
              { value: "javascript", label: "JavaScript", icon: FileCode },
              { value: "python", label: "Python", icon: FileCode },
            ]}
          />

          {/* Code Block */}
          <div className="relative mt-3">
            <pre className="overflow-x-auto border-y border-[var(--ds-border)] bg-[var(--ds-bg)] p-4 text-sm leading-relaxed">
              <code className="font-mono text-[var(--ds-text-secondary)]">{snippets[activeTab]}</code>
            </pre>
            <div className="absolute right-3 top-3">
              <CopyButton text={snippets[activeTab]} id={`snippet-${activeTab}`} />
            </div>
          </div>

          <div className="mt-4 border-y border-[var(--ds-info)]/20 bg-[var(--ds-info-bg)] px-1 py-4">
            <p className="text-sm text-[var(--ds-info)]">
              <span className="font-semibold">Base URL:</span>{" "}
              <code className="font-mono text-[var(--ds-text)]">https://themys.ca/api</code>
            </p>
            <p className="mt-1 text-xs text-[var(--ds-text-muted)]">
              Include your full API key in the <code className="font-mono">Authorization</code> header as a Bearer token.
            </p>
            <p className="mt-1 text-xs text-[var(--ds-text-muted)]">
              Send exactly one of <code className="font-mono">url</code> or <code className="font-mono">text</code>. Use <code className="font-mono">url</code> for a public terms page you want Themys to fetch.
            </p>
          </div>
        </Section>

        <Section title="Response contract" description="One predictable envelope for developers, typed clients, and LLM tool calls.">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium text-[var(--ds-text)]">Success</h3>
              <pre className="mt-2 overflow-x-auto border-y border-[var(--ds-border)] bg-[var(--ds-bg)] p-4 text-xs leading-relaxed text-[var(--ds-text-secondary)]"><code>{`{
  "schemaVersion": "${DEVELOPER_API_VERSION}",
  "requestId": "req_...",
  "ok": true,
  "data": { "...": "endpoint-specific result" }
}`}</code></pre>
            </div>
            <div>
              <h3 className="text-sm font-medium text-[var(--ds-text)]">Error</h3>
              <pre className="mt-2 overflow-x-auto border-y border-[var(--ds-border)] bg-[var(--ds-bg)] p-4 text-xs leading-relaxed text-[var(--ds-text-secondary)]"><code>{`{
  "schemaVersion": "${DEVELOPER_API_VERSION}",
  "requestId": "req_...",
  "ok": false,
  "error": {
    "code": "invalid_request",
    "message": "...",
    "status": 400
  }
}`}</code></pre>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-[var(--ds-text-muted)]">Always branch on <code>ok</code>. Use <code>error.code</code> for program logic and retain <code>requestId</code> for support.</span>
            <a className="font-medium text-[var(--ds-accent)] underline underline-offset-4" href="/api/developer/openapi" target="_blank" rel="noreferrer">OpenAPI 3.1 schema</a>
          </div>
        </Section>

        {/* Footer */}
        <div className="border-t pt-6 text-center" style={{ borderColor: "var(--ds-border)" }}>
          <p className="text-xs text-[var(--ds-text-dim)]">
            Powered by <span className="font-semibold text-[var(--ds-accent)]">Themys</span> · API Documentation
          </p>
        </div>
      </PageShell>

      {/* Modals */}
      <CreateKeyModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
      <KeyResultModal
        rawKey={newRawKey}
        open={resultOpen}
        onClose={() => {
          setResultOpen(false)
          setNewRawKey(null)
        }}
      />
    </div>
  )
}
