import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  getClauseClassification,
  getClauseClassificationLabel,
  classificationDotClass,
} from "../components/scan-results/types.ts";

test("clause classification reserves warnings strictly for egregious non-standard clauses", () => {
  // Egregious clause (red risk level and not standard practice)
  const egregious = {
    riskLevel: "red" as const,
    isStandardPractice: false,
  };
  assert.equal(getClauseClassification(egregious), "warning");
  assert.equal(getClauseClassificationLabel(egregious), "Warning");
  assert.equal(classificationDotClass("warning"), "bg-[var(--ds-danger)]");

  // Standard practice clause with red riskLevel must be downgraded to noteworthy
  const standardWithRed = {
    riskLevel: "red" as const,
    isStandardPractice: true,
  };
  assert.equal(getClauseClassification(standardWithRed), "noteworthy");
  assert.equal(getClauseClassificationLabel(standardWithRed), "Noteworthy");
  assert.equal(classificationDotClass("noteworthy"), "bg-[var(--ds-warning)]");

  // Typical yellow clause (moderate / review)
  const yellowReview = {
    riskLevel: "yellow" as const,
    isStandardPractice: false,
  };
  assert.equal(getClauseClassification(yellowReview), "noteworthy");
  assert.equal(getClauseClassificationLabel(yellowReview), "Noteworthy");

  // Standard green / safe clause
  const safe = {
    riskLevel: "green" as const,
    isStandardPractice: false,
  };
  assert.equal(getClauseClassification(safe), "informational");
  assert.equal(getClauseClassificationLabel(safe), "Informational");
  assert.equal(classificationDotClass("informational"), "bg-[var(--ds-success)]");
});

test("llm system prompt contains explicit directives reserving high severity for egregious terms", async () => {
  const llmContent = await readFile(join(process.cwd(), "src/lib/llm.ts"), "utf8");

  assert.match(llmContent, /EGREGIOUS/);
  assert.match(llmContent, /strictly reserved for EGREGIOUS clauses/i);
  assert.match(llmContent, /isStandardPractice: true, and set severity to "medium"/);
});
