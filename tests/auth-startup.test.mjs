import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("auth startup falls back quickly without allowing a stale session snapshot to overwrite auth events", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /authReadyTimeout = window\.setTimeout\([\s\S]*?\}, 4000\);/);
  assert.match(source, /if \(!mounted \|\| authEventReceived\) return;/);
  assert.match(source, /بررسی نشست بیشتر از حد معمول طول کشید/);
});
