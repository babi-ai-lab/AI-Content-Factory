import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_BODY_BYTES,
  readBoundedJsonBody,
  validateBusinessInput,
  checkRateLimit,
  shouldUseDemoGeneration,
  hasAcceptedAiDataProcessingNotice,
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
  const options = { windowMs: 1000, limit: 1, maxEntries: 1, cleanupEvery: 100 };
  assert.equal(checkRateLimit(store, "user-a", 100, 1, options), true);
  assert.equal(checkRateLimit(store, "user-b", 100, 2, options), false);
  assert.equal(checkRateLimit(store, "user-b", 1200, 3, options), true);
});


test("does not retry or switch models for quota responses", async () => {
  const { shouldRetryGeminiStatus, shouldFallbackGeminiStatus } = await import("../lib/server-controls.mjs");
  assert.equal(shouldRetryGeminiStatus(429), false);
  assert.equal(shouldFallbackGeminiStatus(429), false);
});

test("retries and falls back for temporary Gemini service errors", async () => {
  const { shouldRetryGeminiStatus, shouldFallbackGeminiStatus } = await import("../lib/server-controls.mjs");
  for (const status of [500, 502, 503, 504]) {
    assert.equal(shouldRetryGeminiStatus(status), true);
    assert.equal(shouldFallbackGeminiStatus(status), true);
  }
  assert.equal(shouldRetryGeminiStatus(400), false);
  assert.equal(shouldFallbackGeminiStatus(401), false);
});


test("normalizes an optional brand profile and preserves its fields", () => {
  const value = validateBusinessInput({
    name: "دوره زبان",
    features: "آموزش تخصصی",
    brandProfile: {
      brandName: "  آکادمی زبان  ",
      voice: "  حرفه‌ای  ",
      cta: "ثبت‌نام",
      verifiedFacts: "  ۷ سال سابقه آموزش  ",
      proofPoints: "نمونه کارهای تأییدشده",
      faq: "پرسش: زمان کلاس؟ پاسخ: طبق برنامه.",
      prohibitedClaims: "تضمین نمره",
    },
  });
  assert.equal(value.brandProfile.brandName, "آکادمی زبان");
  assert.equal(value.brandProfile.voice, "حرفه‌ای");
  assert.equal(value.brandProfile.cta, "ثبت‌نام");
  assert.equal(value.brandProfile.verifiedFacts, "۷ سال سابقه آموزش");
  assert.equal(value.brandProfile.proofPoints, "نمونه کارهای تأییدشده");
  assert.equal(value.brandProfile.faq, "پرسش: زمان کلاس؟ پاسخ: طبق برنامه.");
  assert.equal(value.brandProfile.prohibitedClaims, "تضمین نمره");
  assert.equal(value.brandProfile.tagline, "");
});

test("defaults missing brand profile and rejects invalid profile fields", () => {
  const value = validateBusinessInput({ name: "دوره زبان", features: "آموزش تخصصی" });
  assert.equal(value.brandProfile.brandName, "");
  assert.equal(validateBusinessInput({ name: "دوره زبان", features: "آموزش تخصصی", brandProfile: "invalid" }), null);
  assert.equal(validateBusinessInput({ name: "دوره زبان", features: "آموزش تخصصی", brandProfile: { tagline: "x".repeat(161) } }), null);
  assert.equal(validateBusinessInput({ name: "دوره زبان", features: "آموزش تخصصی", brandProfile: { verifiedFacts: "x".repeat(2001) } }), null);
});


test("accepts supported content templates and defaults to balanced", () => {
  const value = validateBusinessInput({ name: "محصول جدید", features: "توضیحات معتبر", contentTemplate: "educational" });
  assert.equal(value.contentTemplate, "educational");
  const defaultValue = validateBusinessInput({ name: "محصول جدید", features: "توضیحات معتبر" });
  assert.equal(defaultValue.contentTemplate, "balanced");
  assert.equal(defaultValue.channel, "general");
});

test("rejects unsupported content template identifiers", () => {
  assert.equal(validateBusinessInput({ name: "محصول جدید", features: "توضیحات معتبر", contentTemplate: "fake-review" }), null);
});


test("allows demo generation only outside production when no provider key exists", () => {
  assert.equal(shouldUseDemoGeneration("development", ""), true);
  assert.equal(shouldUseDemoGeneration("test", ""), true);
  assert.equal(shouldUseDemoGeneration("production", ""), false);
  assert.equal(shouldUseDemoGeneration("production", "configured-key"), false);
});


test("requires a valid timestamped acknowledgement for external AI data processing", () => {
  assert.equal(hasAcceptedAiDataProcessingNotice(null), false);
  assert.equal(hasAcceptedAiDataProcessingNotice({}), false);
  assert.equal(hasAcceptedAiDataProcessingNotice({ aiContentFactoryDataProcessingNoticeAcceptedAt: "yes" }), false);
  assert.equal(
    hasAcceptedAiDataProcessingNotice({ aiContentFactoryDataProcessingNoticeAcceptedAt: "2026-11-06T00:00:00.000Z" }),
    true
  );
});


test("accepts supported content channels and rejects unknown channels", () => {
  const value = validateBusinessInput({ name: "محصول جدید", features: "توضیحات معتبر", channel: "telegram" });
  assert.equal(value.channel, "telegram");
  assert.equal(validateBusinessInput({ name: "محصول جدید", features: "توضیحات معتبر", channel: "unknown-channel" }), null);
});
