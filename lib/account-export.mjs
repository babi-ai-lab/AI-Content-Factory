export const ACCOUNT_EXPORT_TABLES = Object.freeze([
  { key: "contentHistory", table: "content_history", columns: "id, product, content, created_at, updated_at", orderBy: "created_at" },
  { key: "contentVersions", table: "content_versions", columns: "id, history_id, content, created_at", orderBy: "created_at" },
  { key: "aiUsageEvents", table: "ai_usage_events", columns: "id, request_id, model, prompt_tokens, candidate_tokens, total_tokens, created_at", orderBy: "created_at" },
  { key: "marketingCampaigns", table: "marketing_campaigns", columns: "id, name, goal, audience, channels, status, stages, created_at, updated_at, currency_label, budget_amount, spend_amount, impressions, clicks, leads, conversions, revenue_amount", orderBy: "created_at" },
  { key: "campaignContent", table: "marketing_campaign_content", columns: "id, campaign_id, content_id, notes, created_at", orderBy: "created_at" },
  { key: "generatedMedia", table: "generated_media", columns: "id, storage_path, prompt, aspect_ratio, mime_type, byte_size, content_history_id, created_at", orderBy: "created_at" },
  { key: "instagramConnections", table: "instagram_connections", columns: "instagram_user_id, username, token_expires_at, connected_at, updated_at", orderBy: "connected_at" },
  { key: "instagramPublishJobs", table: "instagram_publish_jobs", columns: "id, request_id, media_type, media_url, caption, status, published_media_id, error_code, error_message, started_at, completed_at, created_at, scheduled_at, attempt_count", orderBy: "created_at" },
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
      "Content history and saved versions",
      "AI usage records",
      "Marketing campaigns and content links",
      "Generated media metadata",
      "Non-secret Instagram connection and publishing metadata",
    ],
    excluded: [
      "Passwords, access tokens, encrypted credentials, OAuth state hashes, and service secrets",
      "Binary media files; generated image files remain in the private media library and can be downloaded there",
    ],
  };
}
