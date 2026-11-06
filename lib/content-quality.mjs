const CTA_PATTERN = /(تماس|رزرو|سفارش|ثبت.?نام|مشاوره|دایرکت|پیام|خرید|همین حالا|اطلاعات بیشتر|کلیک کنید)/i;
const REEL_STRUCTURE_PATTERN = /(ثانیه|صحنه|کات|نمای|\b\d{1,2}:\d{2}\b)/i;

function normalizeTerms(value) {
  return String(value || "")
    .split(/[,،;؛\n]+/)
    .map((term) => term.trim().toLocaleLowerCase())
    .filter(Boolean);
}

export function analyzeContent(content, brandProfile = {}, channel = "general") {
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
  const isSms = channel === "sms";
  const usesStories = channel === "general" || channel === "instagram";
  const usesReel = channel === "general" || channel === "instagram" || channel === "youtube";

  const checks = [
    {
      id: "caption",
      label: isSms ? "متن پیامک کوتاه و مستقیم است" : "متن اصلی کانال به‌اندازه کافی کامل است",
      passed: isSms ? caption.length >= 20 && caption.length <= 300 : caption.length >= 80,
      detail: isSms
        ? "پیامک باید روشن و مختصر باشد؛ متن‌های طولانی ممکن است به چند پیامک تقسیم شوند."
        : caption.length >= 80
          ? "طول متن اصلی مناسب است."
          : "متن اصلی کوتاه است؛ زمینه، مزیت و جزئیات بیشتری اضافه کن.",
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
  ];

  if (channel === "email") {
    checks.push({
      id: "email-subject",
      label: "موضوع ایمیل مشخص شده است",
      passed: /(موضوع|subject)\s*[:：]/i.test(caption),
      detail: "برای ایمیل، موضوع کوتاه و مرتبط را در ابتدای متن قرار بده.",
    });
  }

  if (usesReel) {
    checks.push({
      id: "reel-structure",
      label: channel === "youtube" ? "سناریوی ویدیو نشانه‌های اجرایی دارد" : "سناریوی ریلز نشانه‌های اجرایی دارد",
      passed: REEL_STRUCTURE_PATTERN.test(reel),
      detail: "زمان‌بندی، صحنه، نما یا کات را مشخص کن تا اجرای ویدیو آسان‌تر شود.",
    });
  }

  if (usesStories) {
    checks.push(
      {
        id: "stories-count",
        label: "دقیقاً پنج استوری تولید شده است",
        passed: stories.length === 5,
        detail: String(stories.length) + " استوری شناسایی شد.",
      },
      {
        id: "stories-quality",
        label: "متن استوری‌ها به‌اندازه کافی بسط یافته است",
        passed: stories.length === 5 && stories.every((story) => story.length >= 20),
        detail: "هر استوری باید یک پیام روشن و قابل فهم داشته باشد.",
      }
    );
  }

  checks.push({
    id: "ad",
    label: "متن تبلیغاتی کامل است",
    passed: ad.length >= 50,
    detail: ad.length >= 50 ? "متن تبلیغاتی به‌اندازه کافی بسط یافته است." : "متن تبلیغاتی را با مزیت و دعوت به اقدام کامل‌تر کن.",
  });

  if (preferredTerms.length) {
    const included = preferredTerms.filter((term) => allText.includes(term));
    checks.push({
      id: "brand-terms",
      label: "واژگان ترجیحی برند رعایت شده‌اند",
      passed: included.length > 0,
      detail: included.length
        ? String(included.length) + " عبارت ترجیحی در خروجی پیدا شد."
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
        ? "عبارت‌های نیازمند بازبینی: " + found.join("، ")
        : "عبارت ممنوعی در خروجی پیدا نشد.",
    });
  }

  const passedCount = checks.filter((check) => check.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);
  const suggestions = checks.filter((check) => !check.passed).map((check) => check.detail);

  return { score, checks, suggestions };
}
