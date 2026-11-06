export type MediaGenerationInput = { prompt: string; aspectRatio: string; contentHistoryId: string | null };
export function validateMediaGenerationInput(input: unknown): { valid: true; value: MediaGenerationInput } | { valid: false; error: string };
export function getGeneratedImageExtension(mimeType: string): "png" | "jpg" | "webp" | null;
export function buildBrandSafeImagePrompt(prompt: string): string;

export type ImageResponseAspectRatio =
  | "ASPECT_RATIO_ONE_BY_ONE"
  | "ASPECT_RATIO_FOUR_BY_FIVE"
  | "ASPECT_RATIO_NINE_BY_SIXTEEN"
  | "ASPECT_RATIO_SIXTEEN_BY_NINE"
  | "ASPECT_RATIO_THREE_BY_TWO"
  | "ASPECT_RATIO_TWO_BY_THREE";
export function toImageResponseAspectRatio(aspectRatio: string): ImageResponseAspectRatio | null;
