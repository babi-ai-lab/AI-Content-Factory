import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBrandSafeImagePrompt,
  getGeneratedImageExtension,
  toImageResponseAspectRatio,
  toImageResponseSize,
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

test("maps supported UI aspect ratios to the image API enum values", () => {
  assert.deepEqual(
    ["1:1", "4:5", "9:16", "16:9", "3:2", "2:3"].map(toImageResponseAspectRatio),
    [
      "ASPECT_RATIO_ONE_BY_ONE",
      "ASPECT_RATIO_FOUR_BY_FIVE",
      "ASPECT_RATIO_NINE_BY_SIXTEEN",
      "ASPECT_RATIO_SIXTEEN_BY_NINE",
      "ASPECT_RATIO_THREE_BY_TWO",
      "ASPECT_RATIO_TWO_BY_THREE",
    ],
  );
  assert.equal(toImageResponseAspectRatio("7:5"), null);
});

test("maps supported image sizes to the image API enum values", () => {
  assert.deepEqual(
    ["512", "1K", "2K", "4K"].map(toImageResponseSize),
    [
      "IMAGE_SIZE_FIVE_TWELVE",
      "IMAGE_SIZE_ONE_K",
      "IMAGE_SIZE_TWO_K",
      "IMAGE_SIZE_FOUR_K",
    ],
  );
  assert.equal(toImageResponseSize("8K"), null);
});
