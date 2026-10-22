import { execFileSync } from "node:child_process"

// Inspect names before copying or scanning file contents. Gitignore does not
// protect previously tracked files or files added with `git add --force`.
export function isSensitivePath(name) {
  const parts = name.replaceAll("\\", "/").split("/")
  const base = parts.at(-1)
  if (base.startsWith(".env")) return !/^\.env(?:\.[\w-]+)*\.example$/.test(base)
  if (base.startsWith(".dev.vars")) return base !== ".dev.vars.example"
  if (/\.(?:pem|key|p12|pfx|mobileprovision|sqlite3?|db)(?:-(?:shm|wal))?$/i.test(base)) return true
  if (base === ".mcp.json") return true
  if (name.replaceAll("\\", "/").startsWith("videos/themys/capture/")) return true
  return parts.some((part) => [".clerk", ".auth", ".wrangler", ".private", "playwright-report", "test-results", "blob-report"].includes(part))
}

export function repositoryFiles(root) {
  return [...new Set(execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  }).split("\0").filter(Boolean))]
}
