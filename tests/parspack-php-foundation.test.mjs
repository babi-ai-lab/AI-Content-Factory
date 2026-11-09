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
});
