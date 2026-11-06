const SLIDE_ROLES = [
  "Cover: establish the subject and the central promise visually; create a strong first-slide composition.",
  "Problem: visualize the audience's real need or challenge without fearmongering or invented facts.",
  "Insight: visualize the most useful point or practical benefit contained in this slide's message.",
  "Action: visualize the practical step, method, or process described by the message.",
  "Closing: create a memorable final composition that supports a clear next step without rendering any text.",
];

export function buildCarouselSlidePrompts(brandBrief, stories) {
  if (typeof brandBrief !== "string" || brandBrief.trim().length < 20 || brandBrief.length > 3000) {
    throw new TypeError("شرح برند برای ساخت کاروسل معتبر نیست.");
  }
  if (!Array.isArray(stories) || stories.length !== 5 || stories.some((story) => typeof story !== "string" || !story.trim() || story.length > 1200)) {
    throw new TypeError("کاروسل باید دقیقاً پنج متن استوری معتبر داشته باشد.");
  }
  const safeBrandBrief = brandBrief.trim().slice(0, 1200);
  return stories.map((story, index) => [
    safeBrandBrief,
    `Create visual ${index + 1} of a cohesive five-slide Instagram carousel. ${SLIDE_ROLES[index]}`,
    `Visual context from the approved slide copy (use as meaning only; do not render it): ${story.trim().slice(0, 1000)}`,
    "Keep the same art direction, lighting language, and color family across all five visuals, while varying the composition to match each slide's role.",
    "No text, letters, numbers, logos, watermarks, or fake typography. Preserve clean negative space for Persian copy to be overlaid later.",
  ].join("\n\n"));
}
