import { cp, mkdir, rm } from "node:fs/promises"

const standaloneRoot = ".next/standalone"

await mkdir(`${standaloneRoot}/.next`, { recursive: true })
await rm(`${standaloneRoot}/.next/static`, { recursive: true, force: true })
await cp(".next/static", `${standaloneRoot}/.next/static`, { recursive: true })

await rm(`${standaloneRoot}/public`, { recursive: true, force: true })
await cp("public", `${standaloneRoot}/public`, { recursive: true })

console.log("Prepared standalone server assets")
