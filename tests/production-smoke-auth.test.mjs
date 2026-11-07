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

test("production smoke verifies public privacy and account deletion resources", async () => {
  const source = await readFile(new URL("../scripts/production-smoke.mjs", import.meta.url), "utf8");
  assert.match(source, /path:\s*'\/privacy'/);
  assert.match(source, /path:\s*'\/account-deletion'/);
  assert.match(source, /Unpaid Services/);
  assert.match(source, /info@eltbabak\.ir/);
  assert.match(source, /حذف دائمی حساب و داده‌ها/);
});


test("initial auth snapshot cannot overwrite a newer auth-state event", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /let authEventReceived = false/);
  assert.match(source, /\.then\(\(\{ data, error \}\) => \{\s*if \(!mounted \|\| authEventReceived\) return;/);
  assert.match(source, /\.catch\(\(error: unknown\) => \{\s*if \(!mounted \|\| authEventReceived\) return;/);
  assert.match(source, /onAuthStateChange\(\(event, session\) => \{\s*if \(!mounted\) return;\s*authEventReceived = true;/);
});


test("auth effect cleanup clears its watchdog and unsubscribes from auth events", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /return \(\) => \{\s*mounted = false;\s*if \(authReadyTimeout !== undefined\) window\.clearTimeout\(authReadyTimeout\);\s*subscription\.unsubscribe\(\);\s*\};/);
});
