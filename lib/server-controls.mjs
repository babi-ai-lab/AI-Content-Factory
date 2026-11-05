export const MAX_BODY_BYTES = 16 * 1024;

const BUSINESS_TYPES = new Set([
  "retail",
  "services",
  "restaurant",
  "real_estate",
  "construction",
  "education",
  "fitness",
  "personal_brand",
  "other",
]);

const CONTENT_TEMPLATES = new Set([
  "balanced",
  "educational",
  "product_launch",
  "customer_story",
  "faq",
  "limited_offer",
  "lead_generation",
  "brand_awareness",
  "before_after",
  "problem_solution",
]);

const BRAND_PROFILE_LIMITS = Object.freeze({
  brandName: 120,
  tagline: 160,
  audience: 200,
  valueProposition: 320,
  voice: 120,
  preferredTerms: 300,
  avoidTerms: 300,
  cta: 180,
});

const FIELD_LIMITS = Object.freeze({
  businessName: 120,
  name: 120,
  price: 100,
  category: 120,
  fabric: 100,
  colors: 120,
  features: 1800,
  audience: 160,
  goal: 100,
  tone: 100,
  serviceArea: 160,
  offer: 180,
  differentiators: 220,
  additionalInfo: 1000,
});

export async function readBoundedJsonBody(stream, maxBytes = MAX_BODY_BYTES) {
  if (!stream || typeof stream.getReader !== "function") {
    return { error: "invalid" };
  }

  const reader = stream.getReader();
  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        try { await reader.cancel(); } catch {}
        return { error: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { error: "invalid" };
  } finally {
    try { reader.releaseLock(); } catch {}
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) };
  } catch {
    return { error: "invalid" };
  }
}

export function validateBusinessInput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const input = value;
  if (
    typeof input.name !== "string" ||
    typeof input.features !== "string" ||
    !input.name.trim() ||
    !input.features.trim()
  ) return null;

  const businessType = typeof input.businessType === "string" ? input.businessType : "retail";
  if (!BUSINESS_TYPES.has(businessType)) return null;

  const contentTemplate =
    typeof input.contentTemplate === "string" ? input.contentTemplate : "balanced";
  if (!CONTENT_TEMPLATES.has(contentTemplate)) return null;

  const sanitized = {};
  for (const [field, maxLength] of Object.entries(FIELD_LIMITS)) {
    const fieldValue = input[field];
    if (fieldValue === undefined || fieldValue === null) {
      sanitized[field] = "";
      continue;
    }
    if (typeof fieldValue !== "string") return null;
    const trimmed = fieldValue.trim();
    if (trimmed.length > maxLength) return null;
    sanitized[field] = trimmed;
  }

  if (sanitized.name.length < 2 || sanitized.features.length < 3) return null;

  const rawProfile = input.brandProfile;
  const profileInput =
    rawProfile === undefined || rawProfile === null
      ? {}
      : rawProfile && typeof rawProfile === "object" && !Array.isArray(rawProfile)
        ? rawProfile
        : null;
  if (profileInput === null) return null;

  const brandProfile = {};
  for (const [field, maxLength] of Object.entries(BRAND_PROFILE_LIMITS)) {
    const fieldValue = profileInput[field];
    if (fieldValue === undefined || fieldValue === null) {
      brandProfile[field] = "";
      continue;
    }
    if (typeof fieldValue !== "string") return null;
    const trimmed = fieldValue.trim();
    if (trimmed.length > maxLength) return null;
    brandProfile[field] = trimmed;
  }

  return {
    brandProfile,
    businessType,
    contentTemplate,
    businessName: sanitized.businessName,
    name: sanitized.name,
    price: sanitized.price,
    category: sanitized.category,
    fabric: sanitized.fabric,
    colors: sanitized.colors,
    features: sanitized.features,
    audience: sanitized.audience,
    goal: sanitized.goal,
    tone: sanitized.tone,
    serviceArea: sanitized.serviceArea,
    offer: sanitized.offer,
    differentiators: sanitized.differentiators,
    additionalInfo: sanitized.additionalInfo,
  };
}

export function checkRateLimit(store, userId, now, checks, options = {}) {
  const windowMs = options.windowMs ?? 10 * 60 * 1000;
  const limit = options.limit ?? 8;
  const maxEntries = options.maxEntries ?? 5000;
  const cleanupEvery = options.cleanupEvery ?? 64;

  if (checks % cleanupEvery === 0 || store.size >= maxEntries) {
    for (const [key, value] of store) {
      if (value.resetAt <= now) store.delete(key);
    }
  }

  const entry = store.get(userId);
  if (!entry || entry.resetAt <= now) {
    if (store.size >= maxEntries) return false;
    store.set(userId, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

const GEMINI_RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);

export function shouldRetryGeminiStatus(status) {
  return GEMINI_RETRYABLE_STATUSES.has(status);
}

export function shouldFallbackGeminiStatus(status) {
  return GEMINI_RETRYABLE_STATUSES.has(status);
}


/**
 * Demo content is only a local-development fallback. Production must never
 * present deterministic sample copy as a successful AI generation.
 */
export function shouldUseDemoGeneration(nodeEnv, apiKey) {
  return nodeEnv !== "production" && !apiKey;
}
