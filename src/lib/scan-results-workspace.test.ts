import assert from "node:assert/strict";
import test from "node:test";
import {
  clauseExcerpt,
  isWorkspacePanel,
  toAttentionScore100,
  WORKSPACE_PANELS,
} from "./scan-results-workspace.ts";

test("workspace panels include a full document view", () => {
  assert.deepEqual(WORKSPACE_PANELS, [
    "summary",
    "flagged",
    "suggestions",
    "compliance",
    "extraction",
    "document",
  ]);
  assert.equal(isWorkspacePanel("summary"), true);
  assert.equal(isWorkspacePanel("document"), true);
});

test("attention score converts the 0-10 scan scale to 0-100", () => {
  assert.equal(toAttentionScore100(7.2), 72);
  assert.equal(toAttentionScore100(0), 0);
  assert.equal(toAttentionScore100(10), 100);
  assert.equal(toAttentionScore100(null), 0);
  assert.equal(toAttentionScore100(72), 72);
});

test("clause excerpts collapse whitespace and ellipsize", () => {
  assert.equal(clauseExcerpt("Short clause."), "Short clause.");
  assert.equal(clauseExcerpt("a".repeat(160)).endsWith("…"), true);
  assert.equal(clauseExcerpt("a".repeat(160)).length, 141);
  assert.equal(clauseExcerpt("one   two\nthree", 20), "one two three");
});
