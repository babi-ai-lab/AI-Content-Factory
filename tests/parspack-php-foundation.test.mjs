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
  assert.match(auth, /session_regenerate_id/);
  assert.match(bootstrap, /session.use_strict_mode/);
});
