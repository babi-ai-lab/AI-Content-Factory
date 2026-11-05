import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_BODY_BYTES,
  readBoundedJsonBody,
  validateBusinessInput,
  checkRateLimit,
} from "../lib/server-controls.mjs";

function streamOf(text) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

test("accepts valid business input and strips unknown fields", () => {
  const value = validateBusinessInput({
    businessType: "education",
    name: "دوره آیلتس",
    features: "آموزش مهارت‌های چهارگانه",
    unknownAdminFlag: true,
  });
  assert.equal(value.businessType, "education");
  assert.equal(value.unknownAdminFlag, undefined);
  assert.equal(value.businessName, "");
});

test("rejects unsupported business types and non-string fields", () => {
  assert.equal(validateBusinessInput({ businessType: "unknown", name: "نام", features: "شرح کافی" }), null);
  assert.equal(validateBusinessInput({ name: "نام", features: "شرح کافی", price: 123 }), null);
});

test("rejects missing required fields and excessive field lengths", () => {
  assert.equal(validateBusinessInput({ name: "نام", features: "  " }), null);
  assert.equal(validateBusinessInput({ name: "نام", features: "شرح معتبر", additionalInfo: "x".repeat(1001) }), null);
});

test("trims valid strings before returning normalized input", () => {
  const value = validateBusinessInput({ name: "  دوره  ", features: "  توضیحات کامل  " });
  assert.equal(value.name, "دوره");
  assert.equal(value.features, "توضیحات کامل");
});

test("parses a valid bounded JSON stream", async () => {
  const result = await readBoundedJsonBody(streamOf('{"ok":true}'), 100);
  assert.deepEqual(result, { value: { ok: true } });
});

test("rejects malformed JSON and invalid UTF-8", async () => {
  assert.deepEqual(await readBoundedJsonBody(streamOf("{broken"), 100), { error: "invalid" });
  const invalidUtf8 = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array([0xc3, 0x28])); controller.close(); },
  });
  assert.deepEqual(await readBoundedJsonBody(invalidUtf8, 100), { error: "invalid" });
});

test("rejects oversized body even when caller does not supply Content-Length", async () => {
  assert.deepEqual(await readBoundedJsonBody(streamOf("x".repeat(MAX_BODY_BYTES + 1))), { error: "too_large" });
});

test("rate limits each user and resets after the window", () => {
  const store = new Map();
  const options = { windowMs: 1000, limit: 2, cleanupEvery: 100 };
  assert.equal(checkRateLimit(store, "user-a", 100, 1, options), true);
  assert.equal(checkRateLimit(store, "user-a", 200, 2, options), true);
  assert.equal(checkRateLimit(store, "user-a", 300, 3, options), false);
  assert.equal(checkRateLimit(store, "user-a", 1200, 4, options), true);
});

test("rate limit isolates users and caps in-memory entries", () => {
  const store = new Map();
  const options = { limit: 1, maxEntries: 1, cleanupEvery: 100 };
  assert.equal(checkRateLimit(store, "user-a", 100, 1, options), true);
  assert.equal(checkRateLimit(store, "user-b", 100, 2, options), false);
  assert.equal(checkRateLimit(store, "user-b", 1200, 3, options), true);
});
