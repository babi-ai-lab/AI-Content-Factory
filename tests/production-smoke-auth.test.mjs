import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("production smoke verifies anonymous API rejection without leaking processor names", async () => {
  const source = await readFile(new URL("../scripts/production-smoke.mjs", import.meta.url), "utf8");
  assert.match(source, /assertUnauthenticatedJson\(target\.origin, '\/api\/generate'\)/);
  assert.match(source, /assertUnauthenticatedJson\(target\.origin, '\/api\/media\/generate'\)/);
  assert.match(source, /assertUnauthenticatedJson\(target\.origin, '\/api\/account\/export', 'GET'\)/);
  assert.match(source, /Account export authentication response must be private and non-cacheable/);
  assert.match(source, /response\.status !== 401/);
  assert.match(source, /Gemini\|Google\|گوگل\|جمنای/);
  assert.match(source, /external processor branding is visible/);
});


test("production smoke verifies baseline browser security and cache headers", async () => {
  const source = await readFile(new URL("../scripts/production-smoke.mjs", import.meta.url), "utf8");
  for (const header of [
    "x-content-type-options",
    "x-frame-options",
    "referrer-policy",
    "permissions-policy",
    "strict-transport-security",
  ]) {
    assert.ok(source.includes(header), "smoke test must assert " + header);
  }
  assert.match(source, /public app shell must not be cached/);
  assert.match(source, /no-store/i);
});
