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
  assert.match(buildPersianCopyQualityInstructions("unknown"), /در کانال‌های مختلف قابل استفاده/);
});


test("sets relevant, restrained emoji rules by content and channel", () => {
  const instagram = buildPersianCopyQualityInstructions("instagram");
  assert.match(instagram, /۲ تا ۵ ایموجی/);
  assert.match(instagram, /🛠️ برای خدمات فنی/);
  assert.match(instagram, /🏡 برای ملک و بازسازی/);
  assert.match(instagram, /ایموجی‌های کلیشه‌ای و نامرتبط/);
  const sms = buildPersianCopyQualityInstructions("sms");
  assert.match(sms, /برای پیامک، وب‌سایت و ایمیل رسمی ایموجی را حذف کن/);
  const linkedin = buildPersianCopyQualityInstructions("linkedin");
  assert.match(linkedin, /لینکدین حداکثر یک ایموجی حرفه‌ای/);
});
