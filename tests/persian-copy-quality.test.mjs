import test from "node:test";
import assert from "node:assert/strict";
import { buildPersianCopyQualityInstructions } from "../lib/persian-copy-quality.mjs";

test("adds native Persian quality, factuality, and anti-repetition constraints", () => {
  const instructions = buildPersianCopyQualityInstructions("general");
  assert.match(instructions, /فارسی معاصر، طبیعی، روان/);
  assert.match(instructions, /ادعای ساختگی/);
  assert.match(instructions, /نبود تکرار/);
  assert.match(instructions, /نیم‌فاصله/);
});

test("uses channel-specific writing guidance", () => {
  assert.match(buildPersianCopyQualityInstructions("sms"), /کوتاهی واقعی/);
  assert.match(buildPersianCopyQualityInstructions("instagram"), /قلاب/);
  assert.match(buildPersianCopyQualityInstructions("website"), /نیت جست‌وجوی مخاطب/);
});

test("falls back safely for unknown channels", () => {
  assert.match(buildPersianCopyQualityInstructions("unknown"), /قابل استفاده در کانال‌های مختلف/);
});
