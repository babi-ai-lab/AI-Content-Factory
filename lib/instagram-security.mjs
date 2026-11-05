import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const STATE_TTL_SECONDS = 10 * 60;

export function createInstagramOAuthState(userId, secret, now = Date.now()) {
  if (!userId || !secret) throw new Error("Instagram OAuth state configuration is incomplete.");
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    exp: Math.floor(now / 1000) + STATE_TTL_SECONDS,
    nonce: randomBytes(24).toString("base64url"),
  })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyInstagramOAuthState(state, secret, now = Date.now()) {
  if (typeof state !== "string" || state.length > 2048 || !secret) return null;
  const [payload, signature, extra] = state.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = createHmac("sha256", secret).update(payload).digest();
  let received;
  try {
    received = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      typeof decoded.sub !== "string" ||
      typeof decoded.exp !== "number" ||
      decoded.exp < Math.floor(now / 1000) ||
      typeof decoded.nonce !== "string"
    ) return null;
    return { userId: decoded.sub, expiresAt: decoded.exp };
  } catch {
    return null;
  }
}

export function hashInstagramOAuthState(state) {
  return createHash("sha256").update(state).digest("hex");
}

function encryptionKey(encodedKey) {
  if (!encodedKey) throw new Error("INSTAGRAM_TOKEN_ENCRYPTION_KEY is not configured.");
  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32) {
    throw new Error("INSTAGRAM_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  }
  return key;
}

export function encryptInstagramToken(token, encodedKey) {
  if (typeof token !== "string" || token.length < 20) throw new Error("Invalid Instagram access token.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(encodedKey), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptInstagramToken(value, encodedKey) {
  if (typeof value !== "string") throw new Error("Invalid encrypted Instagram token.");
  const [version, ivText, tagText, encryptedText, extra] = value.split(".");
  if (version !== "v1" || !ivText || !tagText || !encryptedText || extra !== undefined) {
    throw new Error("Unsupported encrypted Instagram token format.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(encodedKey),
    Buffer.from(ivText, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
