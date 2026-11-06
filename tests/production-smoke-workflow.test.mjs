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
