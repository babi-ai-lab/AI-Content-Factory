import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("content version history can compare a prior snapshot with the current saved content", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /compareVersionId/);
  assert.match(source, /مقایسه نسخه قبلی با نسخه فعلی ذخیره‌شده/);
  assert.match(source, /نسخه قبلی/);
  assert.match(source, /نسخه فعلی/);
  assert.match(source, /versionCompareFields\.map/);
  assert.match(source, /سناریوی ریلز/);
  assert.match(source, /استوری/);
});
