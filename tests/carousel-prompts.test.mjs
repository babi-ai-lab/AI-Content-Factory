import test from "node:test";
import assert from "node:assert/strict";
import { buildCarouselSlidePrompts, compactCarouselCopy } from "../lib/carousel-prompts.mjs";

test("creates five distinct visual briefs from the five approved story texts", () => {
  const stories = ["اسلاید اول", "اسلاید دوم", "اسلاید سوم", "اسلاید چهارم", "اسلاید پنجم"];
  const prompts = buildCarouselSlidePrompts("تصویر برند برای کسب‌وکار خدماتی با سبک مینیمال و حرفه‌ای", stories);
  assert.equal(prompts.length, 5);
  prompts.forEach((prompt, index) => {
    assert.match(prompt, new RegExp(`visual ${index + 1} of a cohesive five-slide`, "i"));
    assert.ok(prompt.includes(stories[index]));
    assert.match(prompt, /No text, letters, numbers/);
  });
  assert.notEqual(prompts[0], prompts[4]);
  const maxLengthPrompts = buildCarouselSlidePrompts("x".repeat(3000), ["y".repeat(1200), "bb", "cc", "dd", "ee"]);
  assert.ok(maxLengthPrompts.every((prompt) => prompt.length <= 3000));
});

test("rejects incomplete or oversized carousel copy", () => {
  assert.throws(() => buildCarouselSlidePrompts("شرح معتبر برای تصویر برند", ["فقط یک اسلاید"]));
  assert.throws(() => buildCarouselSlidePrompts("شرح معتبر برای تصویر برند", ["a", "b", "c", "d", "e"]));
  assert.throws(() => buildCarouselSlidePrompts("short", ["a", "b", "c", "d", "e"]));
});

test("compacts slide copy at word boundaries for readable image overlays", () => {
  const text = "این یک متن بسیار طولانی برای نمایش روی تصویر کاروسل است که باید در اندازه مناسب خلاصه شود و در انتها کلمه نصفه نماند.";
  const compact = compactCarouselCopy(text, 60);
  assert.ok(compact.length <= 60);
  assert.ok(compact.endsWith("…"));
  assert.equal(compact.includes(" "), true);
  assert.throws(() => compactCarouselCopy("متن", 20));
});
