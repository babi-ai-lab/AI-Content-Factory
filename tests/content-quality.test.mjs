import test from "node:test";
import assert from "node:assert/strict";
import { analyzeContent } from "../lib/content-quality.mjs";

const strongContent = {
  caption: "در این دوره تخصصی، مهارت‌های کاربردی را با برنامه‌ای منظم و همراهی مدرس باتجربه یاد می‌گیرید. برای مشاوره و دریافت اطلاعات بیشتر با ما تماس بگیرید.",
  reel: "00:00 شروع و نمایش مسئله\\n00:05 معرفی راهکار\\n00:12 نمایش نتیجه\\n00:18 دعوت به اقدام",
  stories: [
    "استوری اول: معرفی یک مسئله رایج و مهم برای مخاطب هدف",
    "استوری دوم: توضیح راهکار و روش پیشنهادی برای حل مسئله",
    "استوری سوم: معرفی مزیت اصلی و تفاوت خدمات برند",
    "استوری چهارم: پاسخ به یک سؤال متداول و رفع ابهام مخاطب",
    "استوری پنجم: دعوت مخاطب به تماس و دریافت مشاوره",
  ],
  ad: "برای ارتقای مهارت‌های خود، در برنامه آموزشی تخصصی ما شرکت کنید. برای مشاوره و ثبت‌نام با ما تماس بگیرید.",
};

test("scores complete general content and checks brand vocabulary", () => {
  const result = analyzeContent(strongContent, {
    cta: "برای مشاوره و دریافت اطلاعات بیشتر با ما تماس بگیرید",
    preferredTerms: "دوره تخصصی، مهارت‌های کاربردی",
    avoidTerms: "تضمینی",
  });
  assert.equal(result.score, 100);
  assert.equal(result.checks.every((check) => check.passed), true);
  assert.deepEqual(result.suggestions, []);
});

test("flags missing stories, weak reel structure, and missing CTA for Instagram", () => {
  const result = analyzeContent({
    caption: "متن کوتاه",
    reel: "یک ویدیوی ساده بدون زمان‌بندی",
    stories: ["فقط یک استوری کوتاه"],
    ad: "تبلیغ",
  }, {}, "instagram");
  assert.ok(result.score < 100);
  assert.ok(result.checks.some((check) => check.id === "stories-count" && !check.passed));
  assert.ok(result.checks.some((check) => check.id === "reel-structure" && !check.passed));
  assert.ok(result.suggestions.length > 0);
});

test("does not penalize SMS for irrelevant reels and stories", () => {
  const result = analyzeContent({
    caption: "برای رزرو وقت مشاوره همین حالا با ما تماس بگیرید.",
    reel: "",
    stories: [],
    ad: "برای دریافت مشاوره و ثبت درخواست با ما در ارتباط باشید.",
  }, {}, "sms");
  assert.equal(result.checks.some((check) => check.id === "stories-count"), false);
  assert.equal(result.checks.some((check) => check.id === "reel-structure"), false);
  assert.equal(result.checks.find((check) => check.id === "caption").passed, true);
});

test("checks video structure for YouTube without requiring Instagram stories", () => {
  const result = analyzeContent({
    caption: "در این ویدیو با چند نکته کاربردی برای انتخاب بهتر آشنا می‌شوید. برای اطلاعات بیشتر با ما تماس بگیرید.",
    reel: "صحنه ۱ (۰ تا ۵ ثانیه): معرفی موضوع\\nصحنه ۲ (۵ تا ۱۵ ثانیه): توضیح نکته\\nصحنه ۳ (۱۵ تا ۲۰ ثانیه): دعوت به اقدام",
    stories: [],
    ad: "برای دریافت اطلاعات بیشتر و مشاوره با ما تماس بگیرید.",
  }, {}, "youtube");
  assert.equal(result.checks.some((check) => check.id === "stories-count"), false);
  assert.equal(result.checks.find((check) => check.id === "reel-structure").passed, true);
});

test("does not penalize unconfigured brand vocabulary", () => {
  const result = analyzeContent(strongContent, {});
  assert.equal(result.checks.some((check) => check.id === "brand-terms"), false);
  assert.equal(result.checks.some((check) => check.id === "avoid-terms"), false);
});

test("returns an empty-state result when content is unavailable", () => {
  const result = analyzeContent(null);
  assert.equal(result.score, 0);
  assert.equal(result.checks.length, 0);
});
