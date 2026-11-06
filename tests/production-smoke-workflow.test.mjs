import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("production smoke runs on schedule or manual dispatch, not before auto-deploy", async () => {
  const source = await readFile(new URL("../.github/workflows/production-smoke.yml", import.meta.url), "utf8");
  assert.match(source, /workflow_dispatch:/);
  assert.match(source, /schedule:/);
  assert.match(source, /cron: ["']17,47 \* \* \* \*["']/);
  assert.doesNotMatch(source, /\n  push:/);
});

test("production smoke checks the public Android download and installation page", async () => {
  const source = await readFile(new URL("../scripts/production-smoke.mjs", import.meta.url), "utf8");
  assert.match(source, /\/download/);
  assert.match(source, /نسخه رسمی اندروید/);
  assert.match(source, /افزودن به صفحه اصلی/);
  assert.match(source, /SHA-256/);
  assert.match(source, /AI-Content-Factory-1\.0\.0\.apk/);
  assert.match(source, /ir\.eltbabak\.contentfactory/);
});
