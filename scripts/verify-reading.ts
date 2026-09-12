import assert from 'node:assert/strict';
import { progressAtPage, ReadingCoverage, resolveReadingPosition } from '../src/utils/reading';
import { pageAtOffset, type ReaderPage } from '../src/utils/pagination';
import { recordReadingDay } from '../src/utils/readingStats';
import type { Chapter } from '../src/types';

const chapters: Chapter[] = [
  { id: 'first', title: 'First', wordCount: 7, paragraphs: ['One two three four five six', 'Seven'] },
  { id: 'second', title: 'Second', wordCount: 2, paragraphs: ['Eight nine'] },
];
const pages: ReaderPage[] = [
  { start: 0, end: 8, text: 'One two ' },
  { start: 8, end: 19, text: 'three four ' },
  { start: 19, end: 27, text: 'five six' },
];

const resumed = resolveReadingPosition(chapters, 0, 0, 19);
assert.equal(resumed.paragraphIndex, 0, 'A long paragraph can span several pages');
assert.equal(pageAtOffset(pages, resumed.offset), 2, 'Reopening must restore the saved page within that paragraph');
assert.deepEqual(resolveReadingPosition(chapters, 0, 1), { chapterIndex: 0, paragraphIndex: 1, offset: 29 }, 'Old data without an offset still resumes at its paragraph');
assert.equal(resolveReadingPosition(chapters, 999, 999, 999).chapterIndex, 1);
assert.equal(resolveReadingPosition(chapters, -1, -1, -1).offset, 0);
assert.equal(resolveReadingPosition(chapters, NaN, NaN, NaN).offset, 0);
assert.throws(() => resolveReadingPosition([]), /没有可阅读/);
assert.equal(pageAtOffset([{ start: 2, end: 8, text: 'One two' }, { start: 10, end: 15, text: 'three' }], 0), 0, 'Leading whitespace should not reopen the final page');
assert.equal(pageAtOffset([{ start: 2, end: 8, text: 'One two' }, { start: 10, end: 15, text: 'three' }], 9), 1, 'Whitespace between pages resumes at the following page');
assert.equal(progressAtPage(0, 10, 10, 10, 10), 1, 'A one-page book reaches 100% after its only page');
assert.equal(progressAtPage(0, 10, 10, 4, 10), 0.4, 'An intermediate page reports its visible text share');
assert.equal(progressAtPage(10, 10, 20, 10, 10), 1, 'A final page completes the overall book after earlier chapters');

const coverage = new ReadingCoverage();
coverage.recordPage('first', pages[0]);
assert.equal(coverage.totalWords, 2, 'Only visible words count, not an entire long paragraph');
coverage.recordPage('first', pages[0]);
assert.equal(coverage.totalWords, 2, 'Returning to a page must not count it again');
coverage.recordPage('first', pages[1]);
coverage.recordPage('second', { start: 0, end: 10, text: 'Eight nine' });
assert.equal(coverage.totalWords, 6, 'Changing chapters retains the words already seen');
coverage.recordPage('first', { start: 0, end: 27, text: 'One two three four five six' });
assert.equal(coverage.totalWords, 8, 'Reflow only adds words not already displayed');

const recorded = recordReadingDay(recordReadingDay(undefined, '2026-09-10', 4, 40), '2026-09-10', 3, 20);
assert.deepEqual(recorded?.['2026-09-10'], { minutes: 7, words: 60 }, 'Daily reading history accumulates the same day');
const oldHistory = Object.fromEntries(Array.from({ length: 91 }, (_, index) => {
  const day = String(index + 1).padStart(2, '0');
  return [`2026-08-${day}`, { minutes: 1, words: 1 }];
}));
assert.equal(Object.keys(recordReadingDay(oldHistory, '2026-11-01', 2, 3) ?? {}).length, 90, 'Daily history is capped to the latest 90 days');

console.log('Reading resume and cross-chapter coverage verification passed.');
