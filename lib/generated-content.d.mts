export type GeneratedContent = { caption: string; reel: string; stories: string[]; ad: string };
export function parseGeneratedContent(input: string): GeneratedContent;
