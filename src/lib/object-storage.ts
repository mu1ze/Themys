import "server-only"

import { getCloudflareContext } from "@opennextjs/cloudflare"

type R2ObjectBodyLike = {
  text(): Promise<string>
}

type R2ListedObject = { key: string }

type R2BucketLike = {
  get(key: string): Promise<R2ObjectBodyLike | null>
  put(
    key: string,
    value: string,
    options?: {
      httpMetadata?: { contentType?: string; cacheControl?: string }
      customMetadata?: Record<string, string>
    },
  ): Promise<unknown>
  delete(keys: string | string[]): Promise<void>
  list(options?: {
    prefix?: string
    cursor?: string
    limit?: number
  }): Promise<{
    objects: R2ListedObject[]
    truncated: boolean
    cursor?: string
  }>
}

function isR2Bucket(value: unknown): value is R2BucketLike {
  if (!value || typeof value !== "object") return false
  const bucket = value as Partial<R2BucketLike>
  return (
    typeof bucket.get === "function" &&
    typeof bucket.put === "function" &&
    typeof bucket.delete === "function" &&
    typeof bucket.list === "function"
  )
}

function getDocumentsBucket(): R2BucketLike {
  let value: unknown
  try {
    value = (getCloudflareContext().env as unknown as Record<string, unknown>)
      .DOCUMENTS_BUCKET
  } catch (reason) {
    throw new Error("R2 binding DOCUMENTS_BUCKET is unavailable in this runtime", {
      cause: reason,
    })
  }
  if (!isR2Bucket(value)) {
    throw new Error("R2 binding DOCUMENTS_BUCKET is not configured")
  }
  return value
}

function safeKeyPart(value: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("Invalid document object identifier")
  }
  return value
}

function assertScanDocumentKey(key: string): void {
  if (!/^scans\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/raw\.txt$/.test(key)) {
    throw new Error("Invalid scan document object key")
  }
}

export function scanDocumentObjectKey(userId: string, scanId: string): string {
  return `scans/${safeKeyPart(userId)}/${safeKeyPart(scanId)}/raw.txt`
}

export async function storeScanDocument(input: {
  userId: string
  scanId: string
  text: string
  sha256: string
}): Promise<string> {
  const key = scanDocumentObjectKey(input.userId, input.scanId)
  await getDocumentsBucket().put(key, input.text, {
    httpMetadata: {
      contentType: "text/plain; charset=utf-8",
      cacheControl: "private, no-store",
    },
    customMetadata: {
      scanId: input.scanId,
      sha256: input.sha256,
      schema: "themys-scan-v1",
    },
  })
  return key
}

export async function readScanDocument(key: string | null | undefined): Promise<string | null> {
  if (!key) return null
  assertScanDocumentKey(key)
  const object = await getDocumentsBucket().get(key)
  return object ? object.text() : null
}

export async function deleteScanDocument(key: string | null | undefined): Promise<void> {
  if (!key) return
  assertScanDocumentKey(key)
  await getDocumentsBucket().delete(key)
}

export async function deleteUserScanDocuments(userId: string): Promise<number> {
  const prefix = `scans/${safeKeyPart(userId)}/`
  const bucket = getDocumentsBucket()
  let cursor: string | undefined
  let removed = 0

  do {
    const page = await bucket.list({ prefix, cursor, limit: 1000 })
    const keys = page.objects.map((object) => object.key)
    if (keys.length > 0) {
      await bucket.delete(keys)
      removed += keys.length
    }
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)

  return removed
}
