import assert from 'node:assert/strict';
import {
  parseBingPageCredentials,
  parseBingTranslation,
  splitBingTranslationText,
  splitTranslationText,
} from '../src/services/translation';

const now = 1_730_000_000_000;
const credentials = parseBingPageCredentials(`
  <script>var pageData = {"IG":"ABCDEF0123456789"};</script>
  <div data-iid="translator.5024"></div>
  <script>var params_AbusePreventionHelper = [${now},"temporary-token",3600000];</script>
`, now);

assert.deepEqual(credentials, {
  key: String(now),
  token: 'temporary-token',
  ig: 'ABCDEF0123456789',
  iid: 'translator.5024',
  expiresAt: now + 55 * 60 * 1000,
});
assert.equal(parseBingPageCredentials('<html>changed page</html>', now), undefined);

assert.equal(parseBingTranslation([
  { translations: [{ text: '那座老房子静静地矗立在冬日天空下。' }] },
], 'The old house stood quietly beneath the winter sky.'), '那座老房子静静地矗立在冬日天空下。');
assert.equal(parseBingTranslation({ statusCode: 429 }, 'Hello'), undefined);
assert.equal(parseBingTranslation([{ translations: [{ text: 'Hello' }] }], 'Hello'), undefined);

const longSentence = Array.from({ length: 500 }, () => 'word').join(' ');
const bingChunks = splitBingTranslationText(longSentence);
assert.ok(bingChunks.length > 1);
assert.ok(bingChunks.every((chunk) => Array.from(chunk).length <= 950));
assert.equal(bingChunks.join(' '), longSentence);

const unbroken = 'x'.repeat(2_100);
const unbrokenChunks = splitBingTranslationText(unbroken);
assert.deepEqual(unbrokenChunks.map((chunk) => chunk.length), [950, 950, 200]);
assert.equal(unbrokenChunks.join(''), unbroken);

const fallbackChunks = splitTranslationText(Array.from({ length: 180 }, () => 'reader').join(' '));
assert.ok(fallbackChunks.length > 1);
const longToken = '读'.repeat(300);
const longTokenChunks = splitTranslationText(longToken);
assert.ok(longTokenChunks.length > 1);
assert.ok(longTokenChunks.every((chunk) => new TextEncoder().encode(chunk).length <= 450));
assert.equal(longTokenChunks.join(''), longToken, 'Unbroken translation tokens must be split without losing text');

console.log('Translation helpers verified: Bing credentials, response validation, and safe chunking.');
