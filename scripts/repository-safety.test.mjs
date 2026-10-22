import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { isSensitivePath, repositoryFiles } from "./repository-safety.mjs"

test("credential paths are rejected even when nested or force-added", () => {
  for (const path of [".env", "admin/.env.local", "docs/.env.preview", ".dev.vars.production", "cert/private.key", "signing.p12", "data.db", "data.sqlite3", "data.db-wal", "e2e/.auth/user.json", "admin/.clerk/config.json", ".wrangler/state/data", ".private/notes.md", ".mcp.json", "playwright-report/trace.zip", "videos/themys/capture/extracted/page.html"]) {
    assert.equal(isSensitivePath(path), true, path)
  }
})

test("blank/example templates and source files remain shareable", () => {
  for (const path of [".env.example", ".env.test.example", "admin/.env.local.example", ".dev.vars.example", "src/lib/api-keys.ts", "d1/migrations/0001_initial.sql", "pnpm-lock.yaml", "artifacts/extension/production/manifest.json"]) {
    assert.equal(isSensitivePath(path), false, path)
  }
})

test("Git inventory excludes ignored credentials but exposes forced tracked files", async () => {
  const root = await mkdtemp(join(tmpdir(), "themys-repo-test-"))
  try {
    execFileSync("git", ["init", "--quiet", root])
    await mkdir(join(root, "admin"))
    await writeFile(join(root, ".gitignore"), ".env*\n!.env.example\n")
    await writeFile(join(root, ".env.example"), "EXAMPLE=\n")
    await writeFile(join(root, ".env.local"), "SYNTHETIC=ignored-fixture\n")
    await writeFile(join(root, "admin/.env.preview"), "SYNTHETIC=forced-fixture\n")
    await writeFile(join(root, "new-source.mjs"), "export const example = true\n")
    execFileSync("git", ["-C", root, "add", "--force", "admin/.env.preview"])
    const files = repositoryFiles(root)
    assert.equal(files.includes(".env.local"), false)
    assert.equal(files.includes(".env.example"), true)
    assert.equal(files.includes("new-source.mjs"), true)
    assert.deepEqual(files.filter(isSensitivePath), ["admin/.env.preview"])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
