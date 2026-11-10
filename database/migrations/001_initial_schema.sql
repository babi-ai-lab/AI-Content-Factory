-- AI Content Factory: initial MySQL schema for the ParsPack PHP runtime.
-- Target: MySQL 8.0.16+ / MariaDB 10.6+ with InnoDB and utf8mb4.
-- All timestamps are UTC. Store Persian calendar presentation in the application layer.
-- Do not import Supabase auth password hashes without a verified compatibility test.

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NULL,
  display_name VARCHAR(120) NULL,
  email_verified_at DATETIME NULL,
  status ENUM('active','pending','suspended','deletion_requested') NOT NULL DEFAULT 'pending',
  legacy_auth_id CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_legacy_auth_id (legacy_auth_id),
  KEY idx_users_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_sessions (
  id CHAR(64) NOT NULL,
  user_id CHAR(36) NOT NULL,
  ip_hash CHAR(64) NULL,
  user_agent VARCHAR(500) NULL,
  last_activity_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sessions_user_expiry (user_id, expires_at),
  KEY idx_sessions_expiry (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  purpose ENUM('verify_email','reset_password','delete_account') NOT NULL,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_auth_token_hash (token_hash),
  KEY idx_auth_tokens_user_purpose (user_id, purpose, expires_at),
  CONSTRAINT fk_auth_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS brands (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL,
  business_type VARCHAR(80) NULL,
  profile_json JSON NOT NULL,
  verified_facts_json JSON NULL,
  evidence_json JSON NULL,
  faq_json JSON NULL,
  forbidden_claims_json JSON NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_brands_user_updated (user_id, updated_at),
  CONSTRAINT fk_brands_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS content_items (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  brand_id CHAR(36) NULL,
  title VARCHAR(240) NULL,
  content_type VARCHAR(60) NOT NULL,
  business_type VARCHAR(80) NULL,
  prompt_data JSON NULL,
  content_json JSON NOT NULL,
  plain_text LONGTEXT NULL,
  review_status ENUM('draft','pending_review','approved','needs_revision') NOT NULL DEFAULT 'draft',
  review_note VARCHAR(500) NULL,
  folder_name VARCHAR(120) NULL,
  tags_json JSON NULL,
  is_favorite TINYINT(1) NOT NULL DEFAULT 0,
  generation_model VARCHAR(160) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_content_user_updated (user_id, updated_at),
  KEY idx_content_user_status (user_id, review_status, updated_at),
  KEY idx_content_user_type (user_id, content_type, created_at),
  KEY idx_content_brand (brand_id),
  CONSTRAINT fk_content_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_content_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS content_versions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  content_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  version_number INT UNSIGNED NOT NULL,
  content_json JSON NOT NULL,
  plain_text LONGTEXT NULL,
  change_note VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_content_version (content_id, version_number),
  KEY idx_versions_user_created (user_id, created_at),
  CONSTRAINT fk_versions_content FOREIGN KEY (content_id) REFERENCES content_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_versions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaigns (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  name VARCHAR(200) NOT NULL,
  objective VARCHAR(500) NULL,
  audience TEXT NULL,
  channels_json JSON NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'draft',
  checklist_json JSON NULL,
  starts_on DATE NULL,
  ends_on DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_campaigns_user_updated (user_id, updated_at),
  KEY idx_campaigns_user_status (user_id, status),
  CONSTRAINT fk_campaigns_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaign_content (
  campaign_id CHAR(36) NOT NULL,
  content_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (campaign_id, content_id),
  KEY idx_campaign_content_user (user_id),
  CONSTRAINT fk_campaign_content_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_campaign_content_content FOREIGN KEY (content_id) REFERENCES content_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_campaign_content_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaign_metrics (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  campaign_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  metric_date DATE NULL,
  budget_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  spend_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  revenue_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  impressions BIGINT UNSIGNED NOT NULL DEFAULT 0,
  clicks BIGINT UNSIGNED NOT NULL DEFAULT 0,
  leads BIGINT UNSIGNED NOT NULL DEFAULT 0,
  conversions BIGINT UNSIGNED NOT NULL DEFAULT 0,
  note VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_metrics_campaign_date (campaign_id, metric_date),
  KEY idx_metrics_user_date (user_id, metric_date),
  CONSTRAINT fk_metrics_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_metrics_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS media_assets (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  brand_id CHAR(36) NULL,
  content_id CHAR(36) NULL,
  storage_key VARCHAR(500) NOT NULL,
  original_name VARCHAR(255) NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL,
  width_px INT UNSIGNED NULL,
  height_px INT UNSIGNED NULL,
  metadata_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_media_storage_key (storage_key),
  KEY idx_media_user_created (user_id, created_at),
  CONSTRAINT fk_media_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_media_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL,
  CONSTRAINT fk_media_content FOREIGN KEY (content_id) REFERENCES content_items(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS usage_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id CHAR(36) NOT NULL,
  event_type VARCHAR(60) NOT NULL,
  provider VARCHAR(80) NULL,
  model VARCHAR(160) NULL,
  units DECIMAL(14,4) NOT NULL DEFAULT 0,
  status ENUM('success','failed','blocked') NOT NULL,
  request_id CHAR(36) NULL,
  metadata_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_usage_user_created (user_id, created_at),
  KEY idx_usage_model_created (model, created_at),
  KEY idx_usage_request (request_id),
  CONSTRAINT fk_usage_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key CHAR(64) NOT NULL,
  window_started_at DATETIME NOT NULL,
  request_count INT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  PRIMARY KEY (bucket_key),
  KEY idx_rate_limit_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(120) NOT NULL,
  setting_value_json JSON NOT NULL,
  is_secret TINYINT(1) NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Billing tables are intentionally a separate future migration.
-- Never store card data. Payment callbacks must be verified and idempotent.
