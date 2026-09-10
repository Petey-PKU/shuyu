import type { Book, ReadingPreferences, ReadingSignal, ReadingStats, RecommendationState, SavedWord } from '../types';

interface BootstrapStorage {
  recoverPendingRestore?: () => Promise<void>;
  loadBooks: () => Promise<Book[]>;
  loadWords: () => Promise<SavedWord[]>;
  loadStats: () => Promise<ReadingStats>;
  loadPreferences: () => Promise<ReadingPreferences>;
  loadRecommendationState: () => Promise<RecommendationState>;
  loadReadingSignals: () => Promise<ReadingSignal[]>;
  ensureSampleBook: (books: Book[]) => Promise<Book[]>;
}

/** Publish a complete snapshot only after every persisted data group is readable. */
export async function loadAppSnapshot(storage: BootstrapStorage) {
  await storage.recoverPendingRestore?.();
  const [books, words, stats, preferences, recommendationState, readingSignals] = await Promise.all([
    storage.loadBooks(), storage.loadWords(), storage.loadStats(), storage.loadPreferences(),
    storage.loadRecommendationState(), storage.loadReadingSignals(),
  ]);
  const seededBooks = await storage.ensureSampleBook(books);
  return { books: seededBooks, words, stats, preferences, recommendationState, readingSignals };
}

interface SampleStorage {
  isSeeded: () => Promise<boolean>;
  create: () => Promise<Book>;
  saveBooks: (books: Book[]) => Promise<void>;
  markSeeded: () => Promise<void>;
}

/** Write the book index before the seed marker, so interruption remains retryable. */
export async function seedSampleOnce(books: Book[], storage: SampleStorage): Promise<Book[]> {
  if (await storage.isSeeded()) return books;
  if (books.some((book) => book.format === 'sample')) {
    await storage.markSeeded();
    return books;
  }
  const book = await storage.create();
  const next = [book, ...books];
  await storage.saveBooks(next);
  await storage.markSeeded();
  return next;
}
