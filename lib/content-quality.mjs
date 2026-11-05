const CTA_PATTERN = /(تماس|رزرو|سفارش|ثبت.?نام|مشاوره|دایرکت|پیام|خرید|همین حالا|اطلاعات بیشتر|کلیک کنید)/i;
const REEL_STRUCTURE_PATTERN = /(ثانیه|صحنه|کات|نمای|\b\d{1,2}:\d{2}\b)/i;

function normalizeTerms(value) {
  return String(value || "")
    .split(/[,،;؛\n]+/)
    .map((term) => term.trim().toLocaleLowerCase())
    .filter(Boolean);
}

export function analyzeContent(content, brandProfile = {}) {
  if (!content || typeof content !== "object") {
    return { score: 0, checks: [], suggestions: ["ابتدا یک بسته محتوایی تولید کن."] };
  }

  const caption = typeof content.caption === "string" ? content.caption.trim() : "";
  const reel = typeof content.reel === "string" ? content.reel.trim() : "";
  const ad = typeof content.ad === "string" ? content.ad.trim() : "";
  const stories = Array.isArray(content.stories)
    ? content.stories.filter((story) => typeof story === "string").map((story) => story.trim())
    : [];
  const allText = [caption, reel, ad, ...stories].join("\n").toLocaleLowerCase();

  const configuredCta = typeof brandProfile.cta === "string" ? brandProfile.cta.trim() : "";
  const preferredTerms = normalizeTerms(brandProfile.preferredTerms);
  const avoidTerms = normalizeTerms(brandProfile.avoidTerms);

  const checks = [
    {
      id: "caption",
      label: "کپشن به‌اندازه کافی کامل است",
      passed: caption.length >= 80,
      detail: caption.length >= 80 ? "طول کپشن مناسب است." : "کپشن کوتاه است؛ زمینه، مزیت و جزئیات بیشتری اضافه کن.",
    },
    {
      id: "cta",
      label: "دعوت به اقدام مشخص وجود دارد",
      passed: configuredCta
        ? allText.includes(configuredCta.toLocaleLowerCase())
        : CTA_PATTERN.test(caption) || CTA_PATTERN.test(ad),
      detail: configuredCta
        ? "دعوت به اقدام برند بررسی شد."
        : "یک دعوت روشن مانند تماس، رزرو، خرید یا ثبت‌نام اضافه کن.",
    },
    {
      id: "stories-count",
      label: "دقیقاً پنج استوری تولید شده است",
      passed: stories.length === 5,
      detail: `${stories.length} استوری شناسایی شد.`,
    },
    {
      id: "stories-quality",
      label: "متن استوری‌ها به‌اندازه کافی بسط یافته است",
      passed: stories.length === 5 && stories.every((story) => story.length >= 20),
      detail: "هر استوری باید یک پیام روشن و قابل فهم داشته باشد.",
    },
    {
      id: "reel-structure",
      label: "سناریوی ریلز نشانه‌های اجرایی دارد",
      passed: REEL_STRUCTURE_PATTERN.test(reel),
      detail: "زمان‌بندی، صحنه، نما یا کات را مشخص کن تا اجرای ویدیو آسان‌تر شود.",
    },
    {
      id: "ad",
      label: "متن تبلیغاتی کامل است",
      passed: ad.length >= 50,
      detail: ad.length >= 50 ? "متن تبلیغاتی به‌اندازه کافی بسط یافته است." : "متن تبلیغاتی را با مزیت و دعوت به اقدام کامل‌تر کن.",
    },
  ];

  if (preferredTerms.length) {
    const included = preferredTerms.filter((term) => allText.includes(term));
    checks.push({
      id: "brand-terms",
      label: "واژگان ترجیحی برند رعایت شده‌اند",
      passed: included.length > 0,
      detail: included.length
        ? `${included.length} عبارت ترجیحی در خروجی پیدا شد.`
        : "حداقل یکی از عبارت‌های ترجیحی برند را به‌صورت طبیعی وارد کن.",
    });
  }

  if (avoidTerms.length) {
    const found = avoidTerms.filter((term) => allText.includes(term));
    checks.push({
      id: "avoid-terms",
      label: "واژگان ممنوع برند استفاده نشده‌اند",
      passed: found.length === 0,
      detail: found.length
        ? `عبارت‌های نیازمند بازبینی: ${found.join("، ")}`
        : "عبارت ممنوعی در خروجی پیدا نشد.",
    });
  }

  const passedCount = checks.filter((check) => check.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);
  const suggestions = checks
    .filter((check) => !check.passed)
    .map((check) => check.detail);

  return { score, checks, suggestions };
}
