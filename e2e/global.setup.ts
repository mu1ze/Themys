import { test as setup, expect } from "@playwright/test";
import { clerkSetup, clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { createClerkClient } from "@clerk/backend";

const authFile = "./e2e/.auth/user.json";

setup.describe.configure({ mode: "serial" });

/**
 * Global setup: authenticate with Clerk and save storage state.
 *
 * This runs once before all tests. It:
 * 1. Calls clerkSetup() to configure the Clerk testing environment
 * 2. Signs in with the test user credentials
 * 3. Saves the authenticated storage state to .auth/user.json
 *
 * Requires these env vars in .env.local:
 *   CLERK_SECRET_KEY              — Clerk backend API key
 *   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY — Clerk frontend key (pk_test_...)
 *   CLERK_TEST_USER_EMAIL         — optional reserved test email override
 */
setup("configure Clerk testing", async () => {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey?.startsWith("pk_test_") || !process.env.CLERK_SECRET_KEY?.startsWith("sk_test_")) {
    throw new Error("Authenticated E2E tests require Clerk development-instance pk_test_ and sk_test_ keys.");
  }
  await clerkSetup({ publishableKey });
});

setup("authenticate as test user", async ({ page }) => {
  setup.setTimeout(90_000);
  await setupClerkTestingToken({ page });

  // Navigate to the app — Clerk JS must be loaded on the page
  await page.goto("/");

  // Wait for Clerk to be ready
  await clerk.loaded({ page });

  // Sign in with the test user's email (uses sign-in tokens under the hood)
  const testEmail = process.env.CLERK_TEST_USER_EMAIL ?? "e2e+clerk_test@themys.ca";
  const client = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const existing = await client.users.getUserList({ emailAddress: [testEmail], limit: 1 });
  if (existing.data.length === 0) {
    await client.users.createUser({
      emailAddress: [testEmail],
      username: "themys_e2e",
      firstName: "Themys",
      lastName: "E2E",
      skipPasswordRequirement: true,
      skipLegalChecks: true,
    });
  }

  await clerk.signIn({ page, emailAddress: testEmail });

  // Provision the application profile through the same authenticated API used
  // by onboarding so every protected route has realistic persisted state.
  const profileResponse = await page.request.post("/api/profile", {
    data: { targetClauses: [], strictMode: false },
  });
  expect(profileResponse.ok(), await profileResponse.text()).toBe(true);

  // Verify the session through a protected route rather than a visual selector.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

  // Save authenticated state
  await page.context().storageState({ path: authFile });
});
