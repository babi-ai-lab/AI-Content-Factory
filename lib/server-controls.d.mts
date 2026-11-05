export const MAX_BODY_BYTES: number;

export interface BrandProfileInput {
  brandName: string;
  tagline: string;
  audience: string;
  valueProposition: string;
  voice: string;
  preferredTerms: string;
  avoidTerms: string;
  cta: string;
}

export interface BusinessInput {
  brandProfile: BrandProfileInput;
  businessType: "retail" | "services" | "restaurant" | "real_estate" | "construction" | "education" | "fitness" | "personal_brand" | "other";
  contentTemplate: "balanced" | "educational" | "product_launch" | "customer_story" | "faq" | "limited_offer" | "lead_generation" | "brand_awareness" | "before_after" | "problem_solution";
  businessName: string;
  name: string;
  price: string;
  category: string;
  fabric: string;
  colors: string;
  features: string;
  audience: string;
  goal: string;
  tone: string;
  serviceArea: string;
  offer: string;
  differentiators: string;
  additionalInfo: string;
}

export function readBoundedJsonBody(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes?: number
): Promise<{ value: unknown } | { error: "too_large" | "invalid" }>;

export function validateBusinessInput(value: unknown): BusinessInput | null;

export function checkRateLimit(
  store: Map<string, { count: number; resetAt: number }>,
  userId: string,
  now: number,
  checks: number,
  options?: { windowMs?: number; limit?: number; maxEntries?: number; cleanupEvery?: number }
): boolean;

export function shouldRetryGeminiStatus(status: number): boolean;
export function shouldFallbackGeminiStatus(status: number): boolean;

export function shouldUseDemoGeneration(nodeEnv: string | undefined, apiKey: string | undefined): boolean;
