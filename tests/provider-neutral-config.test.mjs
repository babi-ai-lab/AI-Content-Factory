import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("public configuration examples use product-owned environment names", async () => {
  const env = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  assert.match(env, /CONTENT_GENERATION_API_KEY/);
  assert.match(env, /CONTENT_GENERATION_MODEL/);
  assert.match(env, /CONTENT_GENERATION_FALLBACK_MODEL/);
  assert.doesNotMatch(env, /GEMINI|Google|Gemini/i);
  assert.doesNotMatch(readme, /GEMINI|Google|Gemini|گوگل|جمنای/i);
});

test("runtime supports product-owned configuration while preserving deployed legacy settings", async () => {
  const textRoute = await readFile(new URL("../app/api/generate/route.ts", import.meta.url), "utf8");
  const imageRoute = await readFile(new URL("../app/api/media/generate/route.ts", import.meta.url), "utf8");
  assert.match(textRoute, /CONTENT_GENERATION_API_KEY \|\| process\.env\.GEMINI_API_KEY/);
  assert.match(imageRoute, /CONTENT_GENERATION_API_KEY \|\| process\.env\.GEMINI_API_KEY/);
  assert.match(textRoute, /CONTENT_GENERATION_MODEL \|\| process\.env\.GEMINI_MODEL/);
  assert.match(textRoute, /CONTENT_GENERATION_FALLBACK_MODEL \|\|/);
});
