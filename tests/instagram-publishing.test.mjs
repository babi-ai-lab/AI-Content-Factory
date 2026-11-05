import test from "node:test";
import assert from "node:assert/strict";
import { validateInstagramMediaUrl, validateInstagramPublishInput, validateInstagramScheduleTime } from "../lib/instagram-publishing.mjs";

const base = "https://project.supabase.co";
const user = "user-123";

test("only the authenticated user's public Instagram media URLs are accepted", () => {
  assert.equal(validateInstagramMediaUrl(`${base}/storage/v1/object/public/instagram-media/${user}/photo.jpg`, base, user), true);
  assert.equal(validateInstagramMediaUrl(`${base}/storage/v1/object/public/instagram-media/another-user/photo.jpg`, base, user), false);
  assert.equal(validateInstagramMediaUrl("http://project.supabase.co/storage/v1/object/public/instagram-media/user-123/a.jpg", base, user), false);
  assert.equal(validateInstagramMediaUrl("https://evil.example/photo.jpg", base, user), false);
  assert.equal(validateInstagramMediaUrl(`${base}/storage/v1/object/public/avatars/${user}/photo.jpg`, base, user), false);
  assert.equal(validateInstagramMediaUrl(`${base}/storage/v1/object/public/instagram-media/${user}/../secret`, base, user), false);
});

test("publishing input validates media type and caption length", () => {
  assert.equal(validateInstagramPublishInput({ mediaUrl: "https://x", mediaType: "image", caption: "Hello" }).valid, true);
  assert.equal(validateInstagramPublishInput({ mediaUrl: "https://x", mediaType: "story", caption: "Hello" }).valid, false);
  assert.equal(validateInstagramPublishInput({ mediaUrl: "https://x", mediaType: "image", caption: "x".repeat(2201) }).valid, false);
});

test("Instagram schedule time must be between two minutes and 90 days ahead", () => {
  const now = 1_800_000_000_000;
  assert.equal(validateInstagramScheduleTime(new Date(now + 3 * 60 * 1000).toISOString(), now), new Date(now + 3 * 60 * 1000).toISOString());
  assert.equal(validateInstagramScheduleTime(new Date(now + 60 * 1000).toISOString(), now), null);
  assert.equal(validateInstagramScheduleTime(new Date(now + 91 * 24 * 60 * 60 * 1000).toISOString(), now), null);
  assert.equal(validateInstagramScheduleTime("invalid", now), null);
});
