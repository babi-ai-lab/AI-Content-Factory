import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateInstagramMediaPath, validateInstagramPublishInput, validateInstagramScheduleTime } from "../lib/instagram-publishing.mjs";

const user = "user-123";

test("only media paths owned by the authenticated user and matching the media type are accepted", () => {
  assert.equal(validateInstagramMediaPath(user + "/photo.jpg", user, "image"), true);
  assert.equal(validateInstagramMediaPath(user + "/photo.jpeg", user, "image"), true);
  assert.equal(validateInstagramMediaPath(user + "/video.mp4", user, "reel"), true);
  assert.equal(validateInstagramMediaPath("another-user/photo.jpg", user, "image"), false);
  assert.equal(validateInstagramMediaPath(user + "/../secret.jpg", user, "image"), false);
  assert.equal(validateInstagramMediaPath(user + "/%2fsecret.jpg", user, "image"), false);
  assert.equal(validateInstagramMediaPath(user + "/video.mp4", user, "image"), false);
  assert.equal(validateInstagramMediaPath("https://evil.example/photo.jpg", user, "image"), false);
});

test("publishing input validates media type and caption length", () => {
  assert.equal(validateInstagramPublishInput({ mediaPath: user + "/photo.jpg", mediaType: "image", caption: "Hello" }).valid, true);
  assert.equal(validateInstagramPublishInput({ mediaPath: user + "/story.mp4", mediaType: "story", caption: "Hello" }).valid, false);
  assert.equal(validateInstagramPublishInput({ mediaPath: user + "/photo.jpg", mediaType: "image", caption: "x".repeat(2201) }).valid, false);
});

test("Instagram schedule time must be between two minutes and 90 days ahead", () => {
  const now = 1_800_000_000_000;
  assert.equal(validateInstagramScheduleTime(new Date(now + 3 * 60 * 1000).toISOString(), now), new Date(now + 3 * 60 * 1000).toISOString());
  assert.equal(validateInstagramScheduleTime(new Date(now + 60 * 1000).toISOString(), now), null);
  assert.equal(validateInstagramScheduleTime(new Date(now + 91 * 24 * 60 * 60 * 1000).toISOString(), now), null);
  assert.equal(validateInstagramScheduleTime("invalid", now), null);
});

test("Instagram OAuth callback bounds the request body before parsing credentials", async () => {
  const source = await readFile(new URL("../app/api/integrations/instagram/callback/route.ts", import.meta.url), "utf8");
  assert.ok(source.includes("readBoundedJsonBody(request.body, 8 * 1024)"));
  assert.ok(source.includes('parsedBody.error === "too_large"'));
  assert.ok(source.includes("Array.isArray(parsedBody.value)"));
  assert.equal(source.includes("request.json("), false);
});

test("Instagram connection status responses are never cached", async () => {
  const source = await readFile(new URL("../app/api/integrations/instagram/status/route.ts", import.meta.url), "utf8");
  assert.ok(source.includes('"Cache-Control": "private, no-store, max-age=0"'));
  assert.ok(source.includes('Pragma: "no-cache"'));
});
