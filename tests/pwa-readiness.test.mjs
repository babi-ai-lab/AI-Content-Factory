import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
test("PWA manifest declares standalone identity and Chromium install icon sizes", async () => {
  const manifest = await readFile(new URL("../app/manifest.ts", import.meta.url), "utf8");
  assert.match(manifest, /start_url:\s*"\/?\?source=android"/);
  assert.match(manifest, /display:\s*"standalone"/);
  assert.match(manifest, /sizes:\s*"192x192"/);
  assert.match(manifest, /sizes:\s*"512x512"/);
  assert.match(manifest, /purpose:\s*"maskable"/);
  assert.match(manifest, /theme_color:\s*"#1c2b5e"/);
});
test("service worker never caches private pages, API responses, or media", async () => {
  const worker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(worker, /request\.mode !== "navigate"/);
  assert.match(worker, /cache: "no-store"/);
  assert.match(worker, /Never cache authenticated HTML/);
  assert.doesNotMatch(worker, /caches\.put\(request/);
});
test("offline page explains private data is not available offline", async () => {
  const page = await readFile(new URL("../app/offline/page.tsx", import.meta.url), "utf8");
  assert.match(page, /اطلاعات خصوصی/);
});
