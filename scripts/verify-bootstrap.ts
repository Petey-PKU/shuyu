import assert from 'node:assert/strict';
import { loadAppSnapshot, seedSampleOnce } from '../src/utils/bootstrap';
import type { Book, ReadingPreferences, ReadingStats, SavedWord } from '../src/types';

const userBook: Book = { id: 'mine', title: 'My book', author: 'Reader', format: 'txt', createdAt: '2026-09-09', lastOpenedAt: '2026-09-09', currentChapter: 2, currentParagraph: 3, currentOffset: 90, progress: 0.4, totalWords: 1000, chapterCount: 5, accent: '#333' };
const sampleBook: Book = { ...userBook, id: 'sample', format: 'sample', title: 'Sample' };
const stats: ReadingStats = { minutes: 120, words: 5000, todayMinutes: 10, todayWords: 100, todayDate: '2026-09-09', lastReadDate: '2026-09-09', streak: 3, dailyHistory: { '2026-09-08': { minutes: 8, words: 80 }, '2026-09-09': { minutes: 10, words: 100 } } };
const preferences: ReadingPreferences = { fontSize: 19, lineHeight: 32, dailyGoalMinutes: 15, theme: 'paper', onlineSentenceTranslation: false };
const words: SavedWord[] = [{ id: 'word', word: 'quiet', meaning: '安静的', context: 'It was quiet.', bookId: 'mine', bookTitle: 'My book', createdAt: '2026-09-09', mastered: false, reviewCount: 2 }];

async function main() {
  let failRead = true;
  let seedAttempts = 0;
  const storage = {
    loadBooks: async () => [userBook],
    loadWords: async () => words,
    loadStats: async () => stats,
    loadPreferences: async () => { if (failRead) throw new Error('temporary read failure'); return preferences; },
    loadRecommendationState: async () => ({ preferredGenres: [], savedBookIds: [], feedback: {} }),
    loadReadingSignals: async () => [],
    ensureSampleBook: async (books: Book[]) => { seedAttempts += 1; return books; },
  };
  await assert.rejects(() => loadAppSnapshot(storage), /temporary read failure/);
  assert.equal(seedAttempts, 0, 'A partial read failure must not initialize or write any library data');
  failRead = false;
  const recovered = await loadAppSnapshot(storage);
  assert.deepEqual(recovered.books, [userBook], 'Retry restores the original library and reading position');
  assert.deepEqual(recovered.words, words, 'Retry preserves saved words');
  assert.deepEqual(recovered.stats, stats, 'Retry preserves reading history');
  assert.equal(recovered.preferences.onlineSentenceTranslation, false, 'Retry preserves privacy preferences');

  const validSnapshotStorage = {
    ...storage,
    loadPreferences: async () => preferences,
    ensureSampleBook: async (books: Book[]) => books,
  };
  for (const [label, invalidStorage] of [
    ['books', { loadBooks: async () => [{}] }],
    ['words', { loadWords: async () => [{ id: 'bad' }] }],
    ['stats', { loadStats: async () => ({ minutes: 'bad' }) }],
    ['preferences', { loadPreferences: async () => ({ theme: 'unknown' }) }],
    ['recommendations', { loadRecommendationState: async () => ({ preferredGenres: ['unknown'], savedBookIds: [], feedback: {} }) }],
    ['signals', { loadReadingSignals: async () => [{ bookId: 'missing', lookups: 1, wordsRead: 0, minutes: 0 }] }],
  ] as const) {
    await assert.rejects(() => loadAppSnapshot({ ...validSnapshotStorage, ...invalidStorage } as unknown as Parameters<typeof loadAppSnapshot>[0]), /本地.*损坏/, `${label} corruption must stop startup before publishing a snapshot`);
  }

  let rolledBack = false;
  await loadAppSnapshot({ ...storage,
    recoverPendingRestore: async () => { rolledBack = true; },
    loadBooks: async () => { assert.ok(rolledBack, 'Restore recovery must finish before any library snapshot is read'); return [userBook]; },
  });
  let readAfterFailedRollback = false;
  await assert.rejects(() => loadAppSnapshot({ ...storage,
    recoverPendingRestore: async () => { throw new Error('rollback unavailable'); },
    loadBooks: async () => { readAfterFailedRollback = true; return []; },
  }), /rollback unavailable/);
  assert.equal(readAfterFailedRollback, false, 'An incomplete rollback must not expose a mixed library');

  let persistedBooks = [userBook];
  let seeded = false;
  let failIndex = true;
  let failMarker = false;
  let creates = 0;
  let removedSamples = 0;
  const sampleStorage = {
    isSeeded: async () => seeded,
    create: async () => { creates += 1; return sampleBook; },
    saveBooks: async (books: Book[]) => { if (failIndex) throw new Error('index write failure'); persistedBooks = books; },
    remove: async (book: Book) => { assert.equal(book.id, sampleBook.id); removedSamples += 1; },
    markSeeded: async () => { if (failMarker) throw new Error('marker write failure'); seeded = true; },
  };
  await assert.rejects(() => seedSampleOnce(persistedBooks, sampleStorage), /index write failure/);
  assert.equal(seeded, false, 'Do not mark initialization complete until the sample is indexed');
  assert.equal(removedSamples, 1, 'Failed sample indexing must clean up the created content');
  assert.deepEqual(persistedBooks, [userBook]);
  let partialIndexAttempt = 0;
  const partialStorage = {
    ...sampleStorage,
    saveBooks: async (books: Book[]) => {
      partialIndexAttempt += 1;
      if (partialIndexAttempt === 1) {
        persistedBooks = books;
        throw new Error('index acknowledgement failure');
      }
      persistedBooks = books;
    },
  };
  await assert.rejects(() => seedSampleOnce([userBook], partialStorage), /index acknowledgement failure/);
  assert.deepEqual(persistedBooks, [userBook], 'A partially acknowledged sample index must roll back to the old shelf');
  failIndex = false;
  failMarker = true;
  await assert.rejects(() => seedSampleOnce(persistedBooks, sampleStorage), /marker write failure/);
  assert.deepEqual(persistedBooks, [sampleBook, userBook], 'The complete index remains readable if only the marker fails');
  const creationsBeforeRetry = creates;
  failMarker = false;
  await seedSampleOnce(persistedBooks, sampleStorage);
  assert.equal(creates, creationsBeforeRetry, 'Retrying a failed marker must not duplicate the sample');
  assert.equal(seeded, true);
  assert.deepEqual(await seedSampleOnce([userBook], sampleStorage), [userBook], 'A previously deleted sample must stay deleted');
  console.log('Startup recovery and sample initialization verification passed.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
