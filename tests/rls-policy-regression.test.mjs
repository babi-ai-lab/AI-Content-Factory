import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const migrationDirectory = new URL("../supabase/migrations/", import.meta.url);
const ownerScopedTables = [
  "ai_usage_events",
  "instagram_connections",
  "instagram_oauth_states",
  "marketing_campaigns",
  "marketing_campaign_content",
  "generated_media",
  "media_generation_allowance",
];

async function loadMigrations() {
  const directory = new URL(migrationDirectory);
  const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
  const contents = await Promise.all(files.map((file) => readFile(join(directory.pathname, file), "utf8")));
  return contents.join("\n");
}

test("sensitive user tables keep RLS enabled in versioned migrations", async () => {
  const sql = await loadMigrations();
  for (const table of ownerScopedTables) {
    assert.match(
      sql,
      new RegExp("ALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?public\\." + table + "\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY", "i"),
      table + " must explicitly enable row-level security",
    );
  }
});

test("sensitive user tables have authenticated owner-scoped policies", async () => {
  const sql = await loadMigrations();
  for (const table of ownerScopedTables) {
    const policyBlocks = [...sql.matchAll(
      new RegExp("CREATE\\s+POLICY\\s+[\\s\\S]*?ON\\s+public\\." + table + "[\\s\\S]*?;", "gi"),
    )].map((match) => match[0]);

    assert.ok(policyBlocks.length > 0, table + " must define at least one explicit RLS policy");
    assert.ok(
      policyBlocks.some((policy) => /auth\\.uid\\s*\\(/i.test(policy)),
      table + " policies must scope access to the authenticated owner",
    );
    assert.ok(
      policyBlocks.every((policy) => !/\\bTO\\s+anon\\b/i.test(policy)),
      table + " must not grant an anonymous RLS policy",
    );
  }
});

// These migration checks catch accidental policy removal; they do not replace
// the separate production acceptance test with two independent user accounts.
