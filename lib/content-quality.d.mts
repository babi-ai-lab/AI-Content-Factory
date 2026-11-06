export interface ContentQualityCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface ContentQualityResult {
  score: number;
  checks: ContentQualityCheck[];
  suggestions: string[];
}

export function analyzeContent(
  content: { caption?: string; reel?: string; stories?: string[]; ad?: string } | null,
  brandProfile?: {
    cta?: string;
    preferredTerms?: string;
    avoidTerms?: string;
    prohibitedClaims?: string;
  },
  channel?: string
): ContentQualityResult;
