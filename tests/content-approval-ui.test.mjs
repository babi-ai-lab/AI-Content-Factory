import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("content history supports editorial review, approval and status filtering", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /historyReviewFilter/);
  assert.match(source, /فیلتر وضعیت بازبینی/);
  assert.match(source, /وضعیت بازبینی:/);
  assert.match(source, /reviewUpdatedAt/);
  assert.match(source, /updateHistoryMeta\(item, \{ reviewStatus:/);
  assert.match(source, /CONTENT_REVIEW_STATUSES\.map/);
});
