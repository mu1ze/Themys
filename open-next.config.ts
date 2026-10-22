import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";

export default defineCloudflareConfig({
  // Public stats use unstable_cache and therefore need a writable store.
  // The static-assets override is intentionally read-only.
  incrementalCache: kvIncrementalCache,
  enableCacheInterception: true,
});
