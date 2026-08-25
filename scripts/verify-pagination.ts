import assert from 'node:assert/strict';
import {
  pageAtOffset,
  paginateMeasuredText,
  paragraphAtOffset,
  paragraphStarts,
} from '../src/utils/pagination';

const source = 'One two three four\n\nFive six seven eight';
const lines = [
  { text: 'One two', y: 0, height: 10 },
  { text: 'three four', y: 10, height: 10 },
  { text: 'Five six', y: 30, height: 10 },
  { text: 'seven eight', y: 40, height: 10 },
];

const pages = paginateMeasuredText(source, lines, 20, 10);
assert.equal(pages.length, 3, 'first-page title allowance and paragraph gap should affect page count');
assert.equal(pages[0].text.trim(), 'One two');
assert.match(pages[1].text, /three four/);
assert.match(pages[2].text, /Five six/);
assert.match(pages[2].text, /seven eight/);

const starts = paragraphStarts(['One two three four', 'Five six seven eight']);
assert.deepEqual(starts, [0, 20]);
assert.equal(paragraphAtOffset(starts, 0), 0);
assert.equal(paragraphAtOffset(starts, 25), 1);
assert.equal(pageAtOffset(pages, pages[1].start), 1);

const fallback = paginateMeasuredText('Only text', [], 100, 100);
assert.deepEqual(fallback, [{ start: 0, end: 9, text: 'Only text' }]);

console.log('Pagination verification passed.');
