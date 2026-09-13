import assert from 'node:assert/strict';
import { effectiveReadingScore, hasRecommendationReadingSignal } from '../src/services/recommendation';
import { recommendedBooks } from '../src/data/recommendedBooks';
import type { Book, ReadingSignal, RecommendationState } from '../src/types';

const makeBook = (id: string, title: string): Book => ({
  id, title, author: 'Reader', format: 'txt', createdAt: '2026-09-13', lastOpenedAt: '2026-09-13',
  currentChapter: 0, currentParagraph: 0, progress: 0.5, totalWords: 1000, chapterCount: 1, accent: '#333',
});
const state: RecommendationState = { profile: { level: 'B1', score: 46, confidence: 'high', assessedAt: '2026-09-13', source: 'assessment' }, preferredGenres: [], savedBookIds: [], feedback: {} };
const matchedCatalogBook = recommendedBooks.find((book) => book.difficulty >= 40)!;
const matched = makeBook('matched', matchedCatalogBook.title);
const unmatched = makeBook('unmatched', 'A Private Book With No Catalog Match');
const matchedSignal: ReadingSignal = { bookId: matched.id, lookups: 2, wordsRead: 1000, minutes: 10 };
const unmatchedSignal: ReadingSignal = { bookId: unmatched.id, lookups: 2, wordsRead: 1000, minutes: 10 };

assert.equal(hasRecommendationReadingSignal([matchedSignal], [matched]), true);
assert.equal(hasRecommendationReadingSignal([unmatchedSignal], [unmatched]), false);
assert.equal(hasRecommendationReadingSignal([{ ...matchedSignal, wordsRead: 799 }], [matched]), false);
assert.equal(effectiveReadingScore(state, [unmatchedSignal], [unmatched]), 46, 'Unmatched reading must not alter the recommendation score');
assert.notEqual(effectiveReadingScore(state, [matchedSignal], [matched]), 46, 'Matched reading should be eligible to alter the recommendation score');
console.log('Recommendation basis verification passed.');
