import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ACCOUNT_EXPORT_TABLES, createAccountExportPayload } from "../lib/account-export.mjs";

test("account export includes owner data tables but excludes credentials and ephemeral OAuth state", () => {
  const tables = ACCOUNT_EXPORT_TABLES.map((entry) => entry.table);
  assert.deepEqual(tables, [
    "content_history",
    "content_versions",
    "ai_usage_events",
    "marketing_campaigns",
    "marketing_campaign_content",
    "generated_media",
    "instagram_connections",
    "instagram_publish_jobs",
  ]);
  const columns = ACCOUNT_EXPORT_TABLES.map((entry) => entry.columns).join(",");
  assert.doesNotMatch(columns, /encrypted_access_token|access_token|state_hash|password|secret/i);
  assert.doesNotMatch(tables.join(","), /instagram_oauth_states|media_generation_allowance/);
  assert.doesNotMatch(ACCOUNT_EXPORT_TABLES.find((entry) => entry.table === "ai_usage_events").columns, /model/i);
  assert.match(ACCOUNT_EXPORT_TABLES.find((entry) => entry.table === "instagram_connections").columns, /username/);
  assert.doesNotMatch(ACCOUNT_EXPORT_TABLES.find((entry) => entry.table === "instagram_connections").columns, /encrypted_access_token/);
});

test("builds a versioned account export with user metadata and an explicit media-file limitation", () => {
  const payload = createAccountExportPayload({
    id: "user-123",
    email: "owner@example.test",
    created_at: "2026-11-01T00:00:00.000Z",
    user_metadata: { aiContentFactoryBrandProfile: { brandName: "نمونه" } },
  }, {
    contentHistory: [{ id: "content-1" }],
    generatedMedia: [{ storage_path: "user-123/image.png" }],
  }, "2026-11-06T07:00:00.000Z");

  assert.equal(payload.format, "ai-content-factory-account-export");
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.exportedAt, "2026-11-06T07:00:00.000Z");
  assert.equal(payload.account.id, "user-123");
  assert.equal(payload.account.email, "owner@example.test");
  assert.deepEqual(payload.account.userMetadata, { aiContentFactoryBrandProfile: { brandName: "نمونه" } });
  assert.deepEqual(payload.data.contentHistory, [{ id: "content-1" }]);
  assert.ok(payload.excluded.some((item) => item.includes("فایل‌های باینری رسانه")));
  assert.ok(payload.excluded.some((item) => item.includes("توکن‌های دسترسی")));
});

test("rejects invalid account identities and export timestamps", () => {
  assert.throws(() => createAccountExportPayload(null, {}), /verified account/);
  assert.throws(() => createAccountExportPayload({ id: "user-1" }, null), /data must be an object/);
  assert.throws(() => createAccountExportPayload({ id: "user-1" }, {}, "not-a-date"), /timestamp is invalid/);
});

test("account export API authenticates the caller and prevents caching", async () => {
  const source = await readFile(new URL("../app/api/account/export/route.ts", import.meta.url), "utf8");
  assert.match(source, /authorization/);
  assert.match(source, /client\.auth\.getUser\(token\)/);
  assert.match(source, /ACCOUNT_EXPORT_TABLES/);
  assert.match(source, /Cache-Control/);
  assert.match(source, /private, no-store/);
  assert.match(source, /status: 413/);
  assert.match(source, /MAX_EXPORT_BYTES/);
  assert.match(source, /Buffer\.byteLength/);
  assert.doesNotMatch(source, /SERVICE_ROLE|service_role|SUPABASE_SERVICE_ROLE_KEY/);
});

test("workspace exposes a loading-aware account backup action", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /دریافت نسخه پشتیبان/);
  assert.match(source, /fetch\("\/api\/account\/export"/);
  assert.match(source, /accountExportLoading/);
  assert.match(source, /URL\.createObjectURL/);
});
