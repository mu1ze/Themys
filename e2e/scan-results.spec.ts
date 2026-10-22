import { test, expect } from "@playwright/test";
import { createCloudflareD1AdminClient } from "../scripts/lib/cloudflare-admin.mjs";

/**
 * Scan Results Page — concept B three-pane workspace
 */

test.describe("Scan Results Page", () => {
  let fixtureScanId: string;
  let fixtureTitle: string;

  test.beforeEach(async ({ page }) => {
    const admin = createCloudflareD1AdminClient();
    fixtureScanId = "";
    await page.goto("/dashboard");
    const profileResponse = await page.request.get("/api/profile");
    const profileBody = await profileResponse.text();
    expect(profileResponse.status(), profileBody).toBe(200);
    const { profile } = JSON.parse(profileBody) as { profile: { id: string } };
    const marker = crypto.randomUUID();
    fixtureTitle = `Results E2E ${marker}`;

    const scan = await admin.from("scans").insert({
      user_id: profile.id,
      url: `https://results-${marker}.example/terms`,
      domain: `results-${marker}.example`,
      title: fixtureTitle,
      risk_score: 7.4,
      clause_count: 1,
      flagged_count: 1,
      raw_text: "These terms renew automatically unless the customer cancels.",
      source: "web",
    }).select("id").single();
    if (scan.error) throw scan.error;
    if (!scan.data) throw new Error("Results scan fixture was not returned");
    fixtureScanId = scan.data.id;

    const clause = await admin.from("clauses").insert({
      scan_id: fixtureScanId,
      text: "The subscription renews automatically unless cancelled.",
      category: "auto_renewal",
      risk_score: 7.4,
      risk_level: "red",
      position: 0,
      is_flagged: true,
      explanation: "Renewal occurs without another confirmation.",
      why_it_matters: "The customer must cancel before renewal.",
      recommended_action: "Add a renewal reminder and simple cancellation path.",
    });
    if (clause.error) throw clause.error;
  });

  test.afterEach(async () => {
    if (!fixtureScanId) return;
    const admin = createCloudflareD1AdminClient();
    const cleanup = await admin.from("scans").delete().eq("id", fixtureScanId);
    if (cleanup.error) throw cleanup.error;
    fixtureScanId = "";
  });

  test("dashboard loads with recent scans", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect(page.getByText(fixtureTitle).first()).toBeVisible({ timeout: 15_000 });
  });

  test("scan results page renders the left rail on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/history");
    await page.waitForLoadState("networkidle");

    const fixtureLink = page.locator(`a[href="/scan/results?id=${fixtureScanId}"]`).first();
    await expect(fixtureLink).toBeVisible({ timeout: 15_000 });
    await fixtureLink.click();
    await page.waitForLoadState("networkidle");

    const rail = page.locator('aside[aria-label="Scan results sidebar"]');
    await expect(rail).toBeVisible({ timeout: 10_000 });
    await expect(rail.getByText("This report")).toBeVisible();
    await expect(rail.getByRole("button", { name: "Flagged" })).toBeVisible();
  });

  test("rail collapse and expand works", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/scan/results?id=${fixtureScanId}`);
    await page.waitForLoadState("networkidle");

    const rail = page.locator('aside[aria-label="Scan results sidebar"]');
    await expect(rail).toBeVisible({ timeout: 10_000 });

    const toggle = rail.getByRole("button", { name: "Collapse sidebar" });
    await toggle.click();
    await expect(rail.getByText("This report")).toBeHidden({ timeout: 5_000 });
    await rail.getByRole("button", { name: "Expand sidebar" }).click();
    await expect(rail.getByText("This report")).toBeVisible({ timeout: 5_000 });
  });

  test("views switch between Summary, Flagged, Suggestions, and Extraction", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/scan/results?id=${fixtureScanId}`);
    await page.waitForLoadState("networkidle");

    const flagged = page.getByRole("button", { name: "Flagged" }).first();
    await expect(flagged).toBeVisible({ timeout: 10_000 });
    await flagged.click();
    await expect(page.getByRole("heading", { name: "Flagged Clauses" })).toBeVisible();

    await page.getByRole("button", { name: "Suggestions" }).first().click();
    await expect(page.getByRole("heading", { name: "Negotiation Suggestions" })).toBeVisible();

    await page.getByRole("button", { name: "Extraction" }).first().click();
    await expect(page.getByRole("heading", { name: "Document & extraction" })).toBeVisible();
  });

  test("original wording expands from the extraction view", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/scan/results?id=${fixtureScanId}`);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Extraction" }).first().click();
    await page.getByText("Read the original wording").click();
    await expect(page.getByText("These terms renew automatically unless the customer cancels.")).toBeVisible();
  });
});
