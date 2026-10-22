import { spawnSync } from "node:child_process"
import { copyFile, lstat, mkdir, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { isSensitivePath, repositoryFiles } from "./repository-safety.mjs"

const args = process.argv.slice(2)
if (args.some((arg) => arg !== "--history")) {
  console.error("Usage: node scripts/scan-secrets.mjs [--history]")
  process.exit(2)
}
const root = process.cwd()
const files = repositoryFiles(root)
const forbidden = files.filter(isSensitivePath)
if (forbidden.length) {
  console.error(`Sensitive files are included in the source tree:\n${forbidden.join("\n")}`)
  process.exit(1)
}

const binary = process.env.GITLEAKS_BIN || "gitleaks"
const version = spawnSync(binary, ["version"], { encoding: "utf8" })
if (version.status !== 0 || version.stdout.trim() !== "8.30.1") {
  console.error("Install Gitleaks 8.30.1 from https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1 (or set GITLEAKS_BIN to its path).")
  process.exit(2)
}

function scan(mode, target, extra = []) {
  const result = spawnSync(binary, [mode, target, "--config", resolve(root, ".gitleaks.toml"), "--redact", "--no-banner", ...extra], {
    cwd: root,
    stdio: "inherit",
  })
  if (result.error) console.error(result.error.message)
  return result.status ?? 2
}

// Do not scan the checkout directly: it contains ignored real credentials and
// browser state. Copy only Git's tracked/non-ignored source candidates. Skip
// symlinks so an external target can never pull private files into the scan.
const snapshot = await mkdtemp(join(tmpdir(), "themys-source-scan-"))
let status = 0
try {
  for (const file of files) {
    let stat
    try {
      stat = await lstat(resolve(root, file))
    } catch (error) {
      if (error.code === "ENOENT") continue // locally deleted tracked file
      throw error
    }
    if (!stat.isFile()) continue
    const target = join(snapshot, file)
    await mkdir(dirname(target), { recursive: true })
    await copyFile(resolve(root, file), target)
  }
  status = scan("dir", snapshot)
  if (args.includes("--history")) {
    // --all includes local branches, remote-tracking refs, and tags available
    // in this clone. A shallow/partial clone cannot prove complete history.
    const historyStatus = scan("git", root, ["--log-opts=--all --full-history"])
    status = status || historyStatus
  }
} finally {
  await rm(snapshot, { recursive: true, force: true })
}
process.exitCode = status
