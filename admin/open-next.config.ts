import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";

const config = {
  ...defineCloudflareConfig({
    incrementalCache: kvIncrementalCache,
    enableCacheInterception: false,
  }),
  // The generated Worker must resolve OpenNext's patched Next.js copy, not
  // the app-only package aliases used to typecheck shared ../src components.
  buildCommand: "pnpm build && node ../scripts/prepare-worker-build.mjs",
};

export default config;
