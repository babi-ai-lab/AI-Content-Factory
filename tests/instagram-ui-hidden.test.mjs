import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Instagram account connection and publishing workspace stay hidden from the dashboard", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /InstagramIntegration/);
  assert.doesNotMatch(page, /instagram-integration-section/);
  assert.doesNotMatch(page, /مدیریت انتشار اینستاگرام/);
});
