import assert from 'node:assert/strict';
import { hasSavedWord } from '../src/utils/savedWords';

const first = Object.freeze({ bookId: 'first_book', bookTitle: 'A Story', word: 'quiet', context: 'It was quiet.' });
const second = Object.freeze({ ...first, bookId: 'second_book' });
const words = Object.freeze([first]);
assert.equal(hasSavedWord(words, first), true, 'Repeated saves in the same book stay deduplicated');
assert.equal(hasSavedWord(words, { ...first, word: 'QUIET' }), true, 'Capitalization does not create a duplicate');
assert.equal(hasSavedWord(words, second), false, 'Matching titles, words and sentences in another book must remain savable');
assert.equal(hasSavedWord(words, { ...first, context: 'The quiet room was empty.' }), false,
  'A different sentence in the same book remains a separate learning context');
const renamed = { ...first, bookTitle: 'Renamed story' };
assert.equal(hasSavedWord(words, renamed), true, 'Renaming a book must not lose its bookmarked state');
const both = Object.freeze([first, second]);
assert.equal(hasSavedWord(both, first), true);
assert.equal(hasSavedWord(both, second), true);
const afterFirstBookRemoved = both.filter((item) => item.bookId !== first.bookId);
assert.equal(hasSavedWord(afterFirstBookRemoved, first), false);
assert.equal(hasSavedWord(afterFirstBookRemoved, second), true, 'Removing one source must not affect the other book');
assert.equal(words.length, 1, 'Bookmark checks never mutate saved data');
console.log('Saved word identity passed: book boundaries, case, sentence, rename and source removal.');
