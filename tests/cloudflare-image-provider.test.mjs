import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const route = await readFile(new URL("../app/api/media/generate/route.ts", import.meta.url), "utf8");
const envExample = await readFile(new URL("../.env.example", import.meta.url), "utf8");
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

test("Cloudflare Workers AI is selectable without requiring the legacy image key", () => {
  assert.match(route, /IMAGE_GENERATION_PROVIDER/);
  assert.match(route, /CLOUDFLARE_ACCOUNT_ID/);
  assert.match(route, /CLOUDFLARE_API_TOKEN/);
  assert.match(route, /provider === "cloudflare" && \(!cloudflareAccountId \|\| !cloudflareApiToken\)/);
  assert.match(route, /provider === "gemini" && !apiKey/);
});

test("Cloudflare image generation uses the documented model and base64 response", () => {
  assert.match(route, /@cf\/black-forest-labs\/flux-1-schnell/);
  assert.match(route, /api\.cloudflare\.com\/client\/v4\/accounts/);
  assert.match(route, /result\?\.image/);
  assert.match(route, /steps: 4/);
  assert.match(route, /mimeType = "image\/jpeg"/);
});

test("Cloudflare credentials are documented as server-only environment variables", () => {
  assert.match(envExample, /IMAGE_GENERATION_PROVIDER=cloudflare/);
  assert.match(envExample, /CLOUDFLARE_ACCOUNT_ID=/);
  assert.match(envExample, /CLOUDFLARE_API_TOKEN=/);
  assert.match(readme, /فقط در محیط سرور/);
  assert.match(readme, /رایگان به معنی نامحدود/);
});

test("existing auth, atomic quota, and private media storage flow remains in place", () => {
  assert.match(route, /supabase\.auth\.getUser\(accessToken\)/);
  assert.match(route, /rpc\("reserve_media_generation"\)/);
  assert.match(route, /from\("generated-media"\)/);
  assert.match(route, /createSignedUrl\(storagePath, 60 \* 60\)/);
});
