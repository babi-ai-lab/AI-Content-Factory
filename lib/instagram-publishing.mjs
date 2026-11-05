export function validateInstagramMediaUrl(value, supabaseUrl, userId) {
  if (typeof value !== "string" || value.length > 2048 || !supabaseUrl || !userId) return false;
  try {
    const media = new URL(value);
    const base = new URL(supabaseUrl);
    if (media.protocol !== "https:" || media.origin !== base.origin) return false;
    if (media.username || media.password || media.port) return false;
    const expectedPrefix = `/storage/v1/object/public/instagram-media/${encodeURIComponent(userId)}/`;
    if (!media.pathname.startsWith(expectedPrefix)) return false;
    if (media.pathname.includes("..") || media.pathname.includes("%2f") || media.pathname.includes("%5c")) return false;
    return true;
  } catch {
    return false;
  }
}

export function validateInstagramPublishInput(input) {
  if (!input || typeof input !== "object") return { valid: false, error: "درخواست نامعتبر است." };
  const { mediaUrl, mediaType, caption, requestId } = input;
  if (mediaType !== "image" && mediaType !== "reel") return { valid: false, error: "نوع رسانه پشتیبانی نمی‌شود." };
  if (typeof mediaUrl !== "string" || mediaUrl.length > 2048) return { valid: false, error: "آدرس فایل رسانه معتبر نیست." };
  if (typeof caption !== "string" || caption.length > 2200) return { valid: false, error: "کپشن نباید بیشتر از ۲۲۰۰ نویسه باشد." };
  if (requestId !== undefined && (typeof requestId !== "string" || requestId.length > 80)) return { valid: false, error: "شناسه درخواست معتبر نیست." };
  return { valid: true, value: { mediaUrl, mediaType, caption: caption.trim(), requestId } };
}
