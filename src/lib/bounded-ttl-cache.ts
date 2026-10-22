type CacheEntry<V> = {
  value: V
  expiresAt: number
  bytes: number
}

export type BoundedTtlCacheOptions<K, V> = {
  maxEntries: number
  maxBytes: number
  maxEntryBytes: number
  estimateBytes: (key: K, value: V) => number
  now?: () => number
}

/** Small runtime fallback cache with TTL, LRU eviction, and a hard memory budget. */
export class BoundedTtlCache<K, V> {
  private readonly entriesMap = new Map<K, CacheEntry<V>>()
  private retainedBytes = 0
  private readonly options: BoundedTtlCacheOptions<K, V>

  constructor(options: BoundedTtlCacheOptions<K, V>) {
    this.options = options
  }

  get(key: K): V | undefined {
    const entry = this.entriesMap.get(key)
    if (!entry) return undefined
    if (entry.expiresAt <= this.now()) {
      this.remove(key, entry)
      return undefined
    }

    // Map insertion order is the LRU order. Refresh a hit without reallocating it.
    this.entriesMap.delete(key)
    this.entriesMap.set(key, entry)
    return entry.value
  }

  set(key: K, value: V, ttlMs: number): boolean {
    this.pruneExpired()
    const bytes = Math.max(0, Math.ceil(this.options.estimateBytes(key, value)))
    if (bytes > this.options.maxEntryBytes || bytes > this.options.maxBytes) return false

    const existing = this.entriesMap.get(key)
    if (existing) this.remove(key, existing)

    while (
      this.entriesMap.size >= this.options.maxEntries
      || this.retainedBytes + bytes > this.options.maxBytes
    ) {
      const oldestKey = this.entriesMap.keys().next().value as K | undefined
      if (oldestKey === undefined) break
      const oldest = this.entriesMap.get(oldestKey)
      if (oldest) this.remove(oldestKey, oldest)
    }

    this.entriesMap.set(key, {
      value,
      expiresAt: this.now() + Math.max(0, ttlMs),
      bytes,
    })
    this.retainedBytes += bytes
    return true
  }

  delete(key: K): boolean {
    const entry = this.entriesMap.get(key)
    if (!entry) return false
    this.remove(key, entry)
    return true
  }

  entries(): Array<[K, V]> {
    this.pruneExpired()
    return Array.from(this.entriesMap, ([key, entry]) => [key, entry.value])
  }

  stats(): { entries: number; bytes: number } {
    this.pruneExpired()
    return { entries: this.entriesMap.size, bytes: this.retainedBytes }
  }

  private now(): number {
    return this.options.now?.() ?? Date.now()
  }

  private pruneExpired(): void {
    const now = this.now()
    for (const [key, entry] of this.entriesMap) {
      if (entry.expiresAt <= now) this.remove(key, entry)
    }
  }

  private remove(key: K, entry: CacheEntry<V>): void {
    if (!this.entriesMap.delete(key)) return
    this.retainedBytes = Math.max(0, this.retainedBytes - entry.bytes)
  }
}
