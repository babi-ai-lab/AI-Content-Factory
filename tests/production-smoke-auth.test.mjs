import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("production smoke verifies anonymous API rejection without leaking processor names", async () => {
  const source = await readFile(new URL("../scripts/production-smoke.mjs", import.meta.url), "utf8");
  assert.match(source, /assertUnauthenticatedJson\(target\.origin, '\/api\/generate'\)/);
  assert.match(source, /assertUnauthenticatedJson\(target\.origin, '\/api\/media\/generate'\)/);
  assert.match(source, /response\.status !== 401/);
  assert.match(source, /Gemini\|Google\|گوگل\|جمنای/);
});
