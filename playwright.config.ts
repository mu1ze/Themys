import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// Load env files — .env has the Clerk keys, .env.local can override
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

/**
 * Playwright config for Themys E2E tests.
 *
 * Uses @clerk/testing for authentication. Requires:
 *   CLERK_SECRET_KEY       — from Clerk dashboard (Settings > API keys)
 *   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY — Clerk frontend key (starts with pk_test_ or pk_live_)
 *
 * Set these in .env.local (already gitignored).
 *
 * Run:
 *   pnpm test:e2e                    — all tests, headless
 *   pnpm test:e2e --ui               — interactive UI
 *   pnpm test:e2e --headed           — watch the browser
 *   pnpm test:e2e scan-results.spec  — single file
 */

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // Clerk auth state sharing requires serial runs
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // single worker to avoid Clerk rate limits
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    ignoreHTTPSErrors: process.env.PLAYWRIGHT_IGNORE_HTTPS_ERRORS === "1",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "clerk-setup",
      testMatch: /global\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: process.env.PLAYWRIGHT_STORAGE_STATE || "./e2e/.auth/user.json",
      },
      dependencies: ["clerk-setup"],
    },
  ],

  /* Start dev server before tests if not already running */
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER === "1"
    ? undefined
    : {
        command: process.env.PLAYWRIGHT_SERVER_COMMAND || "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
