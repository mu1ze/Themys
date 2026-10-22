import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/lib/security-headers";

const isDevelopment = process.env.NODE_ENV === "development";
const securityHeaders = buildSecurityHeaders(isDevelopment);

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: process.env.DEV_ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean),
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    // Preserve compiler artifacts between production builds. This is especially
    // valuable in CI when the .next cache directory is restored.
    turbopackFileSystemCacheForBuild: true,
  },
  // PDF generation is dynamically imported by a client component. Excluding
  // its transitive package tree from server tracing avoids pnpm symlinks being
  // copied into the Cloudflare Worker, where they are neither executable nor
  // needed by a server request.
  outputFileTracingExcludes: {
    "/*": [
      // Native app sources and Xcode outputs are released separately.
      "./ios/**/*",
      "./node_modules/.pnpm/@react-pdf+*/**/*",
      "./node_modules/.pnpm/color-string@*/**/*",
      "./node_modules/.pnpm/color-name@*/**/*",
      "./node_modules/@react-pdf/renderer/**/*",
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// Runtime reporting is initialized with @sentry/cloudflare at the Worker
// boundary and @sentry/browser in client bundles. Do not import
// withSentryConfig here: OpenNext traces next.config into the Worker, and that
// build-only plugin dynamically compiles WebAssembly that workerd rejects.
export default nextConfig;

if (process.env.NODE_ENV === "development") {
  void import("@opennextjs/cloudflare").then((m) =>
    m.initOpenNextCloudflareForDev({ remoteBindings: false })
  );
}
