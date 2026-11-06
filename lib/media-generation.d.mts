export type MediaGenerationInput = { prompt: string; aspectRatio: string; contentHistoryId: string | null };
export function validateMediaGenerationInput(input: unknown): { valid: true; value: MediaGenerationInput } | { valid: false; error: string };
export function getGeneratedImageExtension(mimeType: string): "png" | "jpg" | "webp" | null;
export function buildBrandSafeImagePrompt(prompt: string): string;
