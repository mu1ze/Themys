import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";

const config = {
  ...defineCloudflareConfig({
    // Public stats use unstable_cache and therefore need a writable store.
    // The static-assets override is intentionally read-only.
    incrementalCache: kvIncrementalCache,
    enableCacheInterception: true,
  }),
  buildCommand: "pnpm build && node scripts/prepare-worker-build.mjs",
};

export default config;
