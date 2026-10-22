import { test as base, expect } from "@playwright/test";

/**
 * Extended test fixtures for Themys E2E tests.
 *
 * Usage:
 *   import { test, expect } from "../fixtures";
 *
 *   test("my test", async ({ page, authedPage }) => {
 *     // page is already authenticated via storageState
 *     await page.goto("/dashboard");
 *   });
 */
export const test = base.extend<{}>({});

export { expect };
