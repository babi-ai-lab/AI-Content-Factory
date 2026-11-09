import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("ParsPack PHP migration keeps secrets out of the repository", () => {
  const gitignore = read("../.gitignore");
  const htaccess = read("../parspack-php/.htaccess");
  assert.match(gitignore, /parspack-php\/config\.php/);
  assert.ok(htaccess.includes(String.raw`RewriteRule ^config(\.example)?\.php$ - [F,L,NC]`));
  assert.ok(htaccess.includes("RewriteRule ^(app|database|storage)/ - [F,L,NC]"));
});

test("PHP entry point exposes only a minimal health endpoint before feature migration", () => {
  const entry = read("../parspack-php/public/index.php");
  assert.match(entry, /\/api\/health/);
  assert.match(entry, /DATABASE_UNAVAILABLE/);
  assert.match(entry, /NOT_FOUND/);
  const diagnostics = read("../parspack-php/bin/check-hosting.php");
  assert.match(diagnostics, /Outbound HTTPS transport/);
  assert.match(diagnostics, /PDO MySQL|pdo_mysql/i);
  assert.doesNotMatch(entry, /password_hash|api_key|secret_key/i);
});

test("initial MySQL schema scopes user-owned records with foreign keys", () => {
  const schema = read("../parspack-php/database/schema.mysql.sql");
  for (const table of [
    "users",
    "brand_profiles",
    "content_history",
    "content_versions",
    "marketing_campaigns",
    "marketing_campaign_content",
    "ai_usage_events",
    "generated_media",
    "generation_rate_limits",
    "media_generation_allowance",
  ]) {
    assert.match(schema, new RegExp("CREATE TABLE IF NOT EXISTS " + table));
  }
  assert.match(schema, /ON DELETE CASCADE/);
  assert.match(schema, /utf8mb4/);
  assert.match(schema, /email_verification_tokens/);
  assert.match(schema, /auth_rate_limits/);
  assert.match(schema, /session_version/);
  assert.match(schema, /ai_data_notice_accepted_at/);
});

test("local authentication requires CSRF, verified email and versioned sessions", () => {
  const security = read("../parspack-php/app/security.php");
  const auth = read("../parspack-php/app/auth.php");
  const bootstrap = read("../parspack-php/app/bootstrap.php");
  assert.match(security, /hash_equals/);
  assert.match(auth, /password_hash/);
  assert.match(security, /session_version/);
  assert.match(auth, /pending_verification/);
  assert.match(auth, /email_verified_at/);
  assert.match(auth, /auth_verify_email_preview/);
  assert.match(auth, /method === 'POST'/);
  assert.match(auth, /session_regenerate_id/);
  assert.match(bootstrap, /session.use_strict_mode/);
});

test("text generation requires consent, enforces quotas and validates provider output", () => {
  const generator = read("../parspack-php/app/content_generation.php");
  const auth = read("../parspack-php/app/auth.php");
  assert.match(generator, /AI_DATA_PROCESSING_NOTICE_REQUIRED/);
  assert.match(generator, /consume_generation_request/);
  assert.match(generator, /OUTBOUND_HTTPS_UNAVAILABLE/);
  assert.match(generator, /count\(\$stories\) !== 5/);
  assert.match(auth, /ai-data-notice\/accept/);
});

test("history APIs scope reads, updates, deletes and version restores to the current user", () => {
  const history = read("../parspack-php/app/history.php");
  assert.match(history, /WHERE id = :id AND user_id = :user_id/);
  assert.match(history, /history_id = :history_id AND user_id = :user_id/);
  assert.match(history, /history_validate_payload/);
  assert.match(history, /count\(\$content\['stories'\]\) !== 5/);
  assert.match(history, /history_restore/);
});

test("campaign APIs enforce ownership and validate metrics and campaign stages", () => {
  const campaigns = read("../parspack-php/app/campaigns.php");
  assert.match(campaigns, /WHERE id = :id AND user_id = :user_id/);
  assert.match(campaigns, /CONTENT_ALREADY_LINKED/);
  assert.match(campaigns, /CAMPAIGN_METRIC_INVALID/);
  assert.match(campaigns, /CAMPAIGN_STAGES_INVALID/);
  assert.match(campaigns, /marketing_campaign_content/);
});

test("analytics and calendar queries are scoped to the authenticated account", () => {
  const module = read("../parspack-php/app/analytics_calendar.php");
  assert.match(module, /WHERE user_id = :user_id/);
  assert.match(module, /JSON_EXTRACT\(product, '\$\._factoryMeta\.scheduledAt'\)/);
  assert.match(module, /get_ai_usage|ai_usage_events/);
  assert.match(module, /CALENDAR_RANGE_INVALID/);
});

test("Persian workspace UI is connected to the local generation and history APIs", () => {
  const page = read("../parspack-php/public/index.php");
  const script = read("../parspack-php/public/auth.js");
  assert.match(page, /id="generate-form"/);
  assert.match(page, /id="history-items"/);
  assert.match(script, /\/api\/generate/);
  assert.match(script, /\/api\/history/);
  assert.match(page, /id="image-form"/);
  assert.match(page, /id="calendar-items"/);
  assert.match(page, /id="campaign-form"/);
  assert.match(page, /id="analytics-period"/);
  assert.match(script, /\/api\/analytics/);
  assert.match(script, /\/api\/campaigns/);
  assert.match(page, /name="scheduledAt"/);
  assert.match(script, /\/api\/calendar/);
  assert.match(script, /\/api\/calendar\/ics/);
  assert.match(page, /id="calendar-export"/);
  assert.match(script, /\/api\/media\/generate/);
  assert.match(script, /\/api\/media/);
  assert.match(page, /id="brand-form"/);
  assert.match(script, /\/api\/brands/);
  assert.match(script, /\/api\/auth\/ai-data-notice\/accept/);
});

test("generated media is private, owner-scoped and constrained by MIME and size", () => {
  const media = read("../parspack-php/app/media.php");
  assert.match(media, /AICF_IMAGE_MAX_BYTES/);
  assert.match(media, /FILEINFO_MIME_TYPE/);
  assert.match(media, /WHERE id = :id AND user_id = :user_id/);
  assert.match(media, /generated-media/);
  assert.match(media, /media_generation_allowance/);
});

test("brand profile API enforces per-user ownership and a ten-profile cap", () => {
  const profiles = read("../parspack-php/app/brand_profiles.php");
  const generator = read("../parspack-php/app/content_generation.php");
  assert.match(profiles, /BRAND_PROFILE_LIMIT/);
  assert.match(profiles, />= 10/);
  assert.match(profiles, /WHERE id = :id AND user_id = :user_id/);
  assert.match(generator, /brandProfileId/);
  assert.match(generator, /brand_profiles WHERE id = :id AND user_id = :user_id/);
});

test("account export excludes password hashes and deletion requires password confirmation", () => {
  const account = read("../parspack-php/app/account.php");
  const page = read("../parspack-php/public/index.php");
  assert.match(account, /password_verify/);
  assert.match(account, /confirmation !== 'DELETE'/);
  assert.match(account, /Content-Disposition: attachment/);
  assert.doesNotMatch(account, /SELECT .*password_hash.*export/i);
  assert.match(page, /id="delete-account-form"/);
  assert.match(page, /\/api\/account\/export/);
});

test("calendar ICS export is authenticated and escapes user content", () => {
  const calendar = read("../parspack-php/app/analytics_calendar.php");
  assert.match(calendar, /calendar_export_ics/);
  assert.match(calendar, /Content-Type: text\/calendar/);
  assert.match(calendar, /ics_escape/);
  assert.match(calendar, /WHERE user_id = :user_id/);
});
