import path from "node:path";
import type { NextConfig } from "next";
import { buildSecurityHeaders } from "../src/lib/security-headers";

const isDevelopment = process.env.NODE_ENV === "development";
const securityHeaders = buildSecurityHeaders(isDevelopment);
const adminNodeModules = path.join(process.cwd(), "node_modules");

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "",
  trailingSlash: false,
  experimental: {
    // Shared UI lives in ../src; resolve its npm deps from this package.
    externalDir: true,
    turbopackFileSystemCacheForBuild: true,
  },
  webpack: (config, { webpack }) => {
    config.resolve.modules = [adminNodeModules, ...(config.resolve.modules ?? [])];
    // Next.js only rewrites `next/dynamic` to its app-router implementation for
    // files inside the project root. Shared ../src components live outside it,
    // so apply the same rewrite here (this app is entirely App Router).
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^next\/dynamic$/, (resource: { request: string }) => {
        resource.request = "next/dist/api/app-dynamic";
      }),
    );
    return config;
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

// `getCloudflareContext()` is backed by the local Wrangler runtime in
// development. Without this bridge, `next dev` renders the admin route but
// every D1-backed metric query fails because the DB binding does not exist.
if (process.env.NODE_ENV === "development") {
  void import("@opennextjs/cloudflare").then((m) =>
    m.initOpenNextCloudflareForDev({ remoteBindings: false })
  );
}
