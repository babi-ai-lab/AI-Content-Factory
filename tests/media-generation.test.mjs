import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBrandSafeImagePrompt,
  getImageServiceFailure,
  getGeneratedImageExtension,
  toImageResponseAspectRatio,
  toImageResponseImageSize,
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

test("maps supported image sizes to provider enum values", () => {
  assert.equal(toImageResponseImageSize("512"), "IMAGE_SIZE_FIVE_TWELVE");
  assert.equal(toImageResponseImageSize("1K"), "IMAGE_SIZE_ONE_K");
  assert.equal(toImageResponseImageSize("2K"), "IMAGE_SIZE_TWO_K");
  assert.equal(toImageResponseImageSize("4K"), "IMAGE_SIZE_FOUR_K");
  assert.equal(toImageResponseImageSize("1k"), null);
  assert.equal(toImageResponseImageSize("8K"), null);
});

test("maps upstream image failures to accurate vendor-neutral user messages", async () => {
  assert.deepEqual(getImageServiceFailure(429), {
    status: 429,
    message: "ظرفیت سرویس تولید تصویر موقتاً به پایان رسیده است. بعداً دوباره تلاش کن.",
  });
  const disabledQuota = getImageServiceFailure(
    429,
    "Quota exceeded for metric; limit: 0, model image, Free Tier",
  );
  assert.equal(disabledQuota.status, 503);
  assert.match(disabledQuota.message, /تنظیمات اعتبار و سطح دسترسی/);
  assert.doesNotMatch(disabledQuota.message, /Gemini|Google|گوگل|جمنای/i);
  assert.equal(getImageServiceFailure(401).status, 503);
  assert.equal(getImageServiceFailure(403).status, 503);
  assert.equal(getImageServiceFailure(404).status, 503);
  assert.equal(getImageServiceFailure(400).status, 422);
  assert.match(getImageServiceFailure(400).message, /درخواست تصویر قابل پردازش نیست/);
  assert.equal(getImageServiceFailure(500).status, 502);
  assert.doesNotMatch(
    Object.values([400, 401, 403, 404, 429, 500]).map((status) => getImageServiceFailure(status).message).join(" "),
    /Gemini|Google|گوگل|جمنای/i,
  );
});
