import test from "node:test";
import assert from "node:assert/strict";
import {
  createInstagramOAuthState,
  verifyInstagramOAuthState,
  hashInstagramOAuthState,
  encryptInstagramToken,
  decryptInstagramToken,
} from "../lib/instagram-security.mjs";

const secret = "test-only-meta-app-secret";
const key = Buffer.alloc(32, 7).toString("base64");

test("Instagram OAuth state is signed, expires, and identifies its owner", () => {
  const now = 1_800_000_000_000;
  const state = createInstagramOAuthState("user-123", secret, now);
  assert.equal(verifyInstagramOAuthState(state, secret, now)?.userId, "user-123");
  assert.equal(verifyInstagramOAuthState(state, "wrong-secret", now), null);
  assert.equal(verifyInstagramOAuthState(state, secret, now + 11 * 60 * 1000), null);
  assert.equal(verifyInstagramOAuthState(`${state}x`, secret, now), null);
});

test("Instagram OAuth state hashes are deterministic and opaque", () => {
  const state = createInstagramOAuthState("user-123", secret);
  assert.equal(hashInstagramOAuthState(state), hashInstagramOAuthState(state));
  assert.notEqual(hashInstagramOAuthState(state), state);
});

test("Instagram access tokens are encrypted and can be decrypted", () => {
  const token = "IGQVJX-EXAMPLE-ACCESS-TOKEN-THAT-IS-LONG";
  const encrypted = encryptInstagramToken(token, key);
  assert.notEqual(encrypted, token);
  assert.equal(decryptInstagramToken(encrypted, key), token);
  assert.throws(() => decryptInstagramToken(encrypted, Buffer.alloc(32, 8).toString("base64")));
});

test("Instagram token encryption rejects invalid key sizes", () => {
  assert.throws(() => encryptInstagramToken("IGQVJX-EXAMPLE-ACCESS-TOKEN-THAT-IS-LONG", "bad"));
});
