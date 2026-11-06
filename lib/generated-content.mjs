const LIMITS = { caption: 8000, reel: 12000, story: 1200, ad: 6000 };
const MAX_TOTAL = 24000;
const MAX_RESPONSE = 30000;

export function parseGeneratedContent(input) {
  if (typeof input !== 'string' || !input.length || input.length > MAX_RESPONSE) throw new Error('Generated response exceeded the allowed size.');
  const cleaned = input.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let value;
  try { value = JSON.parse(cleaned); } catch { throw new Error('Generated response was not valid JSON.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Generated response must be an object.');
  if (typeof value.caption !== 'string' || typeof value.reel !== 'string' || !Array.isArray(value.stories) || typeof value.ad !== 'string') throw new Error('Generated response has an invalid structure.');
  const caption = value.caption.trim();
  const reel = value.reel.trim();
  const ad = value.ad.trim();
  const stories = value.stories.map((item) => {
    if (typeof item !== 'string') throw new Error('Every story must be text.');
    return item.trim();
  });
  if (stories.length !== 5 || stories.some((item) => !item)) throw new Error('Generated response must contain exactly five non-empty stories.');
  if (!caption || !reel || !ad || caption.length > LIMITS.caption || reel.length > LIMITS.reel || ad.length > LIMITS.ad || stories.some((item) => item.length > LIMITS.story)) throw new Error('One or more generated fields are empty or exceed the allowed size.');
  const total = caption.length + reel.length + ad.length + stories.reduce((sum, item) => sum + item.length, 0);
  if (total > MAX_TOTAL) throw new Error('Generated content exceeded the total output limit.');
  return { caption, reel, stories, ad };
}
