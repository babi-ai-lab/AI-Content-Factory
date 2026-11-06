import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("content versions support bounded per-version notes", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /versionNotes\?: Record<string, string>/);
  assert.match(source, /editContentVersionNote/);
  assert.match(source, /یادداشت این نسخه/);
  assert.match(source, /note\.trim\(\)\.slice\(0, 500\)/);
  assert.match(source, /Object\.entries\(nextNotes\)\.slice\(-10\)/);
});
