import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("media studio presents a vendor-neutral product experience", async () => {
  const source = await readFile(new URL("../components/media-studio.tsx", import.meta.url), "utf8");
  assert.match(source, /استودیوی تصویر تبلیغاتی/);
  assert.match(source, /خروجی باکیفیت/);
  const helpers = await readFile(new URL("../lib/media-generation.mjs", import.meta.url), "utf8");
  const userFacingMessages = [...helpers.matchAll(/message: "([^"]+)"/g)].map((match) => match[1]).join(" ");
  assert.doesNotMatch(userFacingMessages, /Gemini|Google|گوگل|جمنای/i);
  assert.doesNotMatch(source, /API گوگل|سهمیه Gemini/i);
});

test("image generation failures are explained without exposing provider names", async () => {
  const source = await readFile(new URL("../app/api/media/generate/route.ts", import.meta.url), "utf8");
  assert.match(source, /getImageServiceFailure/);
  const helpers = await readFile(new URL("../lib/media-generation.mjs", import.meta.url), "utf8");
  assert.match(helpers, /دسترسی سرویس تولید تصویر موقتاً برقرار نیست/);
  assert.doesNotMatch(source, /شرح تصویر را ساده‌تر کن/);
  const messages = [...helpers.matchAll(/message: "([^"]+)"/g)].map((match) => match[1]).join(" ");
  assert.doesNotMatch(messages, /Gemini|Google|گوگل|جمنای/i);
});

test("public content-generation API uses provider-neutral quota codes", async () => {
  const source = await readFile(new URL("../app/api/generate/route.ts", import.meta.url), "utf8");
  assert.match(source, /CONTENT_GENERATION_QUOTA_EXCEEDED/);
  assert.doesNotMatch(source, /GEMINI_QUOTA_EXCEEDED/);
});
