export const ACCOUNT_EXPORT_TABLES = Object.freeze([
  { key: "contentHistory", table: "content_history", columns: "id, product, content, created_at, updated_at", orderBy: "created_at" },
  { key: "contentVersions", table: "content_versions", columns: "id, history_id, content, created_at", orderBy: "created_at" },
  { key: "aiUsageEvents", table: "ai_usage_events", columns: "id, request_id, prompt_tokens, candidate_tokens, total_tokens, created_at", orderBy: "created_at" },
  { key: "marketingCampaigns", table: "marketing_campaigns", columns: "id, name, goal, audience, channels, status, stages, created_at, updated_at, currency_label, budget_amount, spend_amount, impressions, clicks, leads, conversions, revenue_amount", orderBy: "created_at" },
  { key: "campaignContent", table: "marketing_campaign_content", columns: "id, campaign_id, content_id, notes, created_at", orderBy: "created_at" },
  { key: "generatedMedia", table: "generated_media", columns: "id, storage_path, prompt, aspect_ratio, mime_type, byte_size, content_history_id, created_at", orderBy: "created_at" },
  { key: "instagramConnections", table: "instagram_connections", columns: "instagram_user_id, username, token_expires_at, connected_at, updated_at", orderBy: "connected_at" },
  { key: "instagramPublishJobs", table: "instagram_publish_jobs", columns: "id, request_id, media_type, caption, status, published_media_id, started_at, completed_at, created_at, scheduled_at, attempt_count", orderBy: "created_at" },
]);

export function createAccountExportPayload(user, data, exportedAt = new Date()) {
  if (!user || typeof user.id !== "string" || !user.id) {
    throw new TypeError("A verified account is required for export.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new TypeError("Account export data must be an object.");
  }
  const timestamp = exportedAt instanceof Date ? exportedAt : new Date(exportedAt);
  if (Number.isNaN(timestamp.getTime())) {
    throw new TypeError("Export timestamp is invalid.");
  }

  return {
    format: "ai-content-factory-account-export",
    schemaVersion: 1,
    exportedAt: timestamp.toISOString(),
    account: {
      id: user.id,
      email: typeof user.email === "string" ? user.email : null,
      createdAt: typeof user.created_at === "string" ? user.created_at : null,
      userMetadata: user.user_metadata && typeof user.user_metadata === "object" && !Array.isArray(user.user_metadata)
        ? user.user_metadata
        : {},
    },
    data,
    included: [
      "تاریخچه محتوا و نسخه‌های ذخیره‌شده",
      "آمار مصرف و تعداد تولیدها",
      "کمپین‌های بازاریابی و پیوند محتواها",
      "فراداده رسانه‌های تولیدشده",
      "فراداده غیرمحرمانه اتصال و انتشار شبکه اجتماعی",
    ],
    excluded: [
      "رمزها، توکن‌های دسترسی، اطلاعات رمزنگاری‌شده، هش وضعیت ورود و کلیدهای محرمانه",
      "فایل‌های باینری رسانه؛ تصاویر در کتابخانه خصوصی رسانه باقی می‌مانند و از همان‌جا جداگانه دانلود می‌شوند"
    ],
  };
}
