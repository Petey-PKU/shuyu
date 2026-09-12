import assert from 'node:assert/strict';
import { isBookContent, parseBookContent } from '../src/utils/bookContent';
import { resolveReadingPosition } from '../src/utils/reading';
import type { BookContent } from '../src/types';

const content: BookContent = {
  id: 'book_test', title: 'A readable book', chapters: [
    { id: 'chapter_empty', title: 'Front matter', wordCount: 0, paragraphs: [] },
    { id: 'chapter_text', title: 'Chapter one', wordCount: 3, paragraphs: ['One two three.'] },
  ],
};
const raw = JSON.stringify(content);
assert.deepEqual(parseBookContent(raw, content.id), content);
assert.deepEqual(resolveReadingPosition(content.chapters, 0), { chapterIndex: 0, paragraphIndex: 0, offset: 0 },
  'Empty front matter must retain its chapter index so saved word sources do not shift');
assert.equal(resolveReadingPosition(content.chapters, 1).chapterIndex, 1);
assert.throws(() => parseBookContent(raw.slice(0, -4), content.id), /正文已损坏/);
assert.throws(() => parseBookContent(raw, 'another_book'), /不匹配/);
assert.throws(() => parseBookContent(JSON.stringify({ ...content, chapters: [] }), content.id), /没有可阅读的章节/);

for (const malformed of [
  null, [], { ...content, chapters: null }, { ...content, title: null },
  { ...content, chapters: [null] },
  { ...content, chapters: [{ ...content.chapters[1], paragraphs: 'not an array' }] },
  { ...content, chapters: [{ ...content.chapters[1], paragraphs: ['One', null] }] },
  { ...content, chapters: [{ ...content.chapters[1], title: {} }] },
  { ...content, chapters: [{ ...content.chapters[1], wordCount: -1 }] },
  { ...content, chapters: [{ ...content.chapters[1], wordCount: '3' }] },
  { ...content, chapters: [{ ...content.chapters[1], id: '../outside' }] },
  { ...content, chapters: [content.chapters[1], content.chapters[1]] },
]) {
  assert.equal(isBookContent(malformed), false);
  assert.throws(() => parseBookContent(JSON.stringify(malformed), content.id), /正文不完整/,
    'Malformed content should produce a recovery message before it reaches the reader');
}
assert.equal(isBookContent({ ...content, chapters: [{ ...content.chapters[1], wordCount: Infinity }] }), false);
assert.equal(isBookContent({ ...content, author: 'An author' }), true);
assert.equal(isBookContent({ ...content, chapters: [{ ...content.chapters[1], wordCount: 0, paragraphs: ['中文正文。'] }] }), true,
  'Zero English words does not make non-English text invalid');

console.log('Book content validation and empty-chapter position verification passed.');
