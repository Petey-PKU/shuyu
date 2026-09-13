import type { Book, ReadingPreferences, ReadingSignal, ReadingStats, RecommendationState, SavedWord } from '../types';
import { validBook, validPreferences, validRecommendationState, validSignal, validStats, validWord } from './backup';

interface BootstrapStorage {
  recoverPendingRestore?: () => Promise<void>;
  recoverPendingImport?: () => Promise<void>;
  loadBooks: () => Promise<Book[]>;
  loadWords: () => Promise<SavedWord[]>;
  loadStats: () => Promise<ReadingStats>;
  loadPreferences: () => Promise<ReadingPreferences>;
  loadRecommendationState: () => Promise<RecommendationState>;
  loadReadingSignals: () => Promise<ReadingSignal[]>;
  ensureSampleBook: (books: Book[]) => Promise<Book[]>;
}

export interface PendingImportStorage {
  loadPendingImport: () => Promise<string | null>;
  clearPendingImport: () => Promise<void>;
  loadBooks: () => Promise<Book[]>;
  saveBooks: (books: Book[]) => Promise<void>;
  contentExists: (bookId: string) => Promise<boolean>;
}

/** Recover an imported book whose正文 exists but whose shelf index was not acknowledged. */
export async function recoverPendingImportOnce(storage: PendingImportStorage) {
  const raw = await storage.loadPendingImport();
  if (!raw) return;

  let pending: Book;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!validBook(parsed)) throw new Error('invalid pending import');
    pending = parsed;
  } catch {
    try { await storage.clearPendingImport(); } catch { /* A corrupt marker must not block startup. */ }
    return;
  }

  const books = await storage.loadBooks();
  if (books.some((book) => book.id === pending.id)) {
    try { await storage.clearPendingImport(); } catch { /* Retry cleanup on the next startup. */ }
    return;
  }

  let contentExists = false;
  try { contentExists = await storage.contentExists(pending.id); } catch { return; }
  if (!contentExists) {
    try { await storage.clearPendingImport(); } catch { /* Retry cleanup on the next startup. */ }
    return;
  }

  try {
    await storage.saveBooks([pending, ...books]);
    await storage.clearPendingImport();
  } catch {
    // Keep the marker so a later startup can retry without losing the import.
  }
}

function validateLocalSnapshot(books: unknown, words: unknown, stats: unknown, preferences: unknown, recommendationState: unknown, readingSignals: unknown) {
  if (!Array.isArray(books) || !books.every(validBook) || new Set(books.map((book) => book.id)).size !== books.length) {
    throw new Error('本地书架数据损坏，请重试读取或在设置中恢复备份。');
  }
  const bookIds = new Set(books.map((book) => book.id));
  if (!Array.isArray(words) || !words.every(validWord) || new Set(words.map((word) => word.id)).size !== words.length
    || words.some((word) => !bookIds.has(word.bookId))) {
    throw new Error('本地生词数据损坏，请重试读取或在设置中恢复备份。');
  }
  if (!validStats(stats)) throw new Error('本地阅读统计损坏，请重试读取或在设置中恢复备份。');
  if (!validPreferences(preferences)) throw new Error('本地阅读设置损坏，请重试读取或在设置中恢复备份。');
  if (!validRecommendationState(recommendationState)) throw new Error('本地推荐偏好损坏，请重试读取或在设置中恢复备份。');
  if (!Array.isArray(readingSignals) || !readingSignals.every(validSignal)
    || new Set(readingSignals.map((signal) => signal.bookId)).size !== readingSignals.length
    || readingSignals.some((signal) => !bookIds.has(signal.bookId))) {
    throw new Error('本地阅读记录损坏，请重试读取或在设置中恢复备份。');
  }
}

/** Publish a complete snapshot only after every persisted data group is readable. */
export async function loadAppSnapshot(storage: BootstrapStorage) {
  await storage.recoverPendingRestore?.();
  await storage.recoverPendingImport?.();
  const [books, words, stats, preferences, recommendationState, readingSignals] = await Promise.all([
    storage.loadBooks(), storage.loadWords(), storage.loadStats(), storage.loadPreferences(),
    storage.loadRecommendationState(), storage.loadReadingSignals(),
  ]);
  validateLocalSnapshot(books, words, stats, preferences, recommendationState, readingSignals);
  const seededBooks = await storage.ensureSampleBook(books);
  return { books: seededBooks, words, stats, preferences, recommendationState, readingSignals };
}

interface SampleStorage {
  isSeeded: () => Promise<boolean>;
  create: () => Promise<Book>;
  saveBooks: (books: Book[]) => Promise<void>;
  remove?: (book: Book) => Promise<void>;
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
  try {
    await storage.saveBooks(next);
  } catch (error) {
    try { await storage.remove?.(book); } catch { /* Preserve the original index error. */ }
    // Some storage providers may report an error after partially writing the
    // index. Best-effort restoration prevents it from referencing deleted content.
    try { await storage.saveBooks(books); } catch { /* Preserve the original index error. */ }
    throw error;
  }
  await storage.markSeeded();
  return next;
}
