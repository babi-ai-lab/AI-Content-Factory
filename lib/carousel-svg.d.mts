export type BuildCarouselSlideSvgInput = {
  imageDataUrl: string;
  lines: readonly string[];
  slideNumber: number;
  totalSlides?: number;
};
export function buildCarouselSlideSvg(input: BuildCarouselSlideSvgInput): string;
