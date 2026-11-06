import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGeneratedContent } from '../lib/generated-content.mjs';

const valid = { caption: 'متن اصلی', reel: 'سناریوی ویدیو', stories: ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم'], ad: 'متن تبلیغ' };

test('parses valid JSON and trims fields', () => {
  const result = parseGeneratedContent(JSON.stringify({ ...valid, caption: '  متن اصلی  ' }));
  assert.equal(result.caption, 'متن اصلی');
  assert.equal(result.stories.length, 5);
});

test('accepts fenced JSON', () => {
  assert.equal(parseGeneratedContent('```json\n' + JSON.stringify(valid) + '\n```').ad, valid.ad);
});

test('rejects malformed JSON and non-object responses', () => {
  assert.throws(() => parseGeneratedContent('{'), /valid JSON/);
  assert.throws(() => parseGeneratedContent('[]'), /object/);
});

test('rejects missing, blank, and non-text fields', () => {
  assert.throws(() => parseGeneratedContent(JSON.stringify({ ...valid, stories: ['only one'] })), /five/);
  assert.throws(() => parseGeneratedContent(JSON.stringify({ ...valid, caption: ' ' })), /empty/);
  assert.throws(() => parseGeneratedContent(JSON.stringify({ ...valid, stories: ['a', 'b', 3, 'd', 'e'] })), /text/);
});

test('rejects oversized fields and responses', () => {
  assert.throws(() => parseGeneratedContent(JSON.stringify({ ...valid, caption: 'x'.repeat(8001) })), /allowed size/);
  assert.throws(() => parseGeneratedContent('x'.repeat(30001)), /allowed size/);
});
