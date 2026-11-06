const ALLOWED_ASPECT_RATIOS = new Set(["1:1", "4:5", "9:16", "16:9", "3:2", "2:3"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateMediaGenerationInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { valid: false, error: "ساختار درخواست معتبر نیست." };
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  const aspectRatio = typeof input.aspectRatio === "string" ? input.aspectRatio : "4:5";
  const contentHistoryId = input.contentHistoryId == null ? null : input.contentHistoryId;
  if (prompt.length < 20 || prompt.length > 3000) return { valid: false, error: "شرح تصویر باید بین ۲۰ تا ۳۰۰۰ نویسه باشد." };
  if (!ALLOWED_ASPECT_RATIOS.has(aspectRatio)) return { valid: false, error: "نسبت تصویر انتخاب‌شده پشتیبانی نمی‌شود." };
  if (contentHistoryId !== null && (typeof contentHistoryId !== "string" || !UUID_PATTERN.test(contentHistoryId))) return { valid: false, error: "شناسه محتوای مرتبط معتبر نیست." };
  return { valid: true, value: { prompt, aspectRatio, contentHistoryId } };
}

export function getGeneratedImageExtension(mimeType) {
  const normalized = String(mimeType || "").toLowerCase().split(";")[0].trim();
  if (normalized === "image/png") return "png";
  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/webp") return "webp";
  return null;
}

export function buildBrandSafeImagePrompt(prompt) {
  return `Create one polished, original commercial social-media visual for a Persian-speaking business.
Art direction: premium contemporary art direction, deliberate composition, strong visual hierarchy, realistic materials and lighting, refined color harmony, clean edges, professional advertising quality.
Use the user's brief as factual source material only. Do not invent product features, awards, prices, people, locations, certifications, statistics, testimonials, or results.
Do not render any words, letters, numbers, captions, logos, watermarks, UI, or fake typography. Keep intentional clean negative space where Persian typography can be added later in the app.
Avoid generic stock-photo clichés, clutter, distorted objects, malformed hands, and excessive decorative elements.
User brief:
${prompt}`;
}

const IMAGE_RESPONSE_ASPECT_RATIOS = Object.freeze({
  "1:1": "ASPECT_RATIO_ONE_BY_ONE", "4:5": "ASPECT_RATIO_FOUR_BY_FIVE",
  "9:16": "ASPECT_RATIO_NINE_BY_SIXTEEN", "16:9": "ASPECT_RATIO_SIXTEEN_BY_NINE",
  "3:2": "ASPECT_RATIO_THREE_BY_TWO", "2:3": "ASPECT_RATIO_TWO_BY_THREE",
});
export function toImageResponseAspectRatio(value) { return IMAGE_RESPONSE_ASPECT_RATIOS[value] || null; }

const IMAGE_RESPONSE_SIZES = Object.freeze({
  "512": "IMAGE_SIZE_FIVE_TWELVE", "1K": "IMAGE_SIZE_ONE_K",
  "2K": "IMAGE_SIZE_TWO_K", "4K": "IMAGE_SIZE_FOUR_K",
});
export function toImageResponseImageSize(value) { return IMAGE_RESPONSE_SIZES[value] || null; }

export function getImageServiceFailure(status, diagnosticMessage = "") {
  if (status === 429 && /(?:limit|quota)\s*[:=]?\s*0\b|free[_ -]?tier[^\n]{0,120}(?:quota|limit)[^\n]{0,40}0\b/i.test(String(diagnosticMessage))) {
    return { status: 503, message: "ظرفیت تولید تصویر برای حساب سرویس فعلی فعال نیست. برای فعال‌سازی، تنظیمات اعتبار و سطح دسترسی سرویس باید توسط مدیر سامانه بررسی شود." };
  }
  if (status === 429) return { status: 429, message: "ظرفیت سرویس تولید تصویر موقتاً به پایان رسیده است. بعداً دوباره تلاش کن." };
  if (status === 401 || status === 403) return { status: 503, message: "دسترسی سرویس تولید تصویر موقتاً برقرار نیست. لطفاً کمی بعد دوباره تلاش کن." };
  if (status === 404) return { status: 503, message: "سرویس تولید تصویر در حال حاضر در دسترس نیست. کمی بعد دوباره تلاش کن." };
  if (status === 400) return { status: 422, message: "درخواست تصویر قابل پردازش نیست. شرح تصویر را بررسی کن و دوباره تلاش کن." };
  return { status: 502, message: "در حال حاضر امکان تولید تصویر وجود ندارد. لطفاً کمی بعد دوباره تلاش کن." };
}
