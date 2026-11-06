export function validateInstagramMediaPath(value, userId, mediaType) {
  if (typeof value !== "string" || value.length > 512 || !userId) return false;
  if (value.startsWith("/") || value.includes("\\") || value.includes("..") || /%2f|%5c/i.test(value)) return false;
  const prefix = userId + "/";
  if (!value.startsWith(prefix)) return false;
  const filename = value.slice(prefix.length);
  if (!filename || filename.includes("/") || !/^[A-Za-z0-9._-]{1,180}$/.test(filename)) return false;
  const extension = filename.toLowerCase().split(".").pop();
  if (mediaType === "image") return extension === "jpg" || extension === "jpeg";
  if (mediaType === "reel") return extension === "mp4";
  return false;
}

export function validateInstagramPublishInput(input) {
  if (!input || typeof input !== "object") return { valid: false, error: "درخواست نامعتبر است." };
  const { mediaPath, mediaType, caption, requestId } = input;
  if (mediaType !== "image" && mediaType !== "reel") return { valid: false, error: "نوع رسانه پشتیبانی نمی‌شود." };
  if (typeof mediaPath !== "string" || mediaPath.length > 512) return { valid: false, error: "مسیر فایل رسانه معتبر نیست." };
  if (typeof caption !== "string" || caption.length > 2200) return { valid: false, error: "کپشن نباید بیشتر از ۲۲۰۰ نویسه باشد." };
  if (requestId !== undefined && (typeof requestId !== "string" || requestId.length > 80)) return { valid: false, error: "شناسه درخواست معتبر نیست." };
  return { valid: true, value: { mediaPath, mediaType, caption: caption.trim(), requestId } };
}

export function validateInstagramScheduleTime(value, now = Date.now()) {
  if (typeof value !== "string" || value.length > 64) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const delta = timestamp - now;
  if (delta < 2 * 60 * 1000 || delta > 90 * 24 * 60 * 60 * 1000) return null;
  return new Date(timestamp).toISOString();
}
