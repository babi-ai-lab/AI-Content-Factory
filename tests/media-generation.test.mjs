import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBrandSafeImagePrompt,
  getGeneratedImageExtension,
  validateMediaGenerationInput,
} from "../lib/media-generation.mjs";

test("accepts supported image generation input and normalizes prompt", () => {
  const result = validateMediaGenerationInput({
    prompt: "  تصویر تبلیغاتی مینیمال برای معرفی خدمات طراحی داخلی  ",
    aspectRatio: "4:5",
    contentHistoryId: "b5f6d7b1-85f1-4c17-8f1b-4d1d1aab2d01",
  });
  assert.equal(result.valid, true);
  if (result.valid) assert.equal(result.value.prompt.startsWith("تصویر"), true);
});

test("rejects short prompts, unsupported ratios, and malformed content ids", () => {
  assert.equal(validateMediaGenerationInput({ prompt: "کوتاه", aspectRatio: "4:5" }).valid, false);
  assert.equal(validateMediaGenerationInput({ prompt: "یک شرح معتبر برای تصویر تبلیغاتی", aspectRatio: "7:5" }).valid, false);
  assert.equal(validateMediaGenerationInput({ prompt: "یک شرح معتبر برای تصویر تبلیغاتی", aspectRatio: "4:5", contentHistoryId: "not-a-uuid" }).valid, false);
});

test("allows only known raster image formats", () => {
  assert.equal(getGeneratedImageExtension("image/png"), "png");
  assert.equal(getGeneratedImageExtension("image/jpeg; charset=binary"), "jpg");
  assert.equal(getGeneratedImageExtension("image/webp"), "webp");
  assert.equal(getGeneratedImageExtension("image/svg+xml"), null);
});

test("image prompt protects brand truth and reserves space for Persian copy", () => {
  const prompt = buildBrandSafeImagePrompt("خدمات بازسازی منزل در تهران");
  assert.match(prompt, /Do not invent product features/);
  assert.match(prompt, /Do not render any words/);
  assert.match(prompt, /clean negative space/);
  assert.match(prompt, /خدمات بازسازی منزل/);
});
