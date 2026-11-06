import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTENT_REVIEW_STATUSES,
  getContentReviewStatusLabel,
  normalizeContentReviewStatus,
} from "../lib/content-approval.mjs";

test("provides a safe default and four editorial review states", () => {
  assert.equal(normalizeContentReviewStatus(undefined), "draft");
  assert.equal(normalizeContentReviewStatus("unknown"), "draft");
  assert.deepEqual(CONTENT_REVIEW_STATUSES.map((status) => status.value), [
    "draft",
    "in_review",
    "approved",
    "changes_requested",
  ]);
  assert.equal(getContentReviewStatusLabel("approved"), "تأییدشده برای انتشار");
});

test("normalizes persisted review status values without changing valid states", () => {
  for (const status of CONTENT_REVIEW_STATUSES) {
    assert.equal(normalizeContentReviewStatus(status.value), status.value);
    assert.equal(getContentReviewStatusLabel(status.value), status.label);
  }
});
