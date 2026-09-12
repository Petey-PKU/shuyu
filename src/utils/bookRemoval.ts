import type { Book, ReadingSignal, SavedWord } from '../types';

interface RemovalSnapshot {
  books: Book[];
  words: SavedWord[];
  readingSignals: ReadingSignal[];
}

interface RemovalStorage {
  saveBooks: (books: Book[]) => Promise<void>;
  saveWords: (words: SavedWord[]) => Promise<void>;
  saveReadingSignals: (signals: ReadingSignal[]) => Promise<void>;
  deleteBookContent: (bookId: string) => Promise<void>;
}

/**
 * Retain the source book until every dependent index has stopped referencing it.
 *
 * The dependent indexes are written first and the book index last. If the
 * process stops between storage writes, this can leave an extra book or an
 * incomplete deletion, but it cannot leave words/signals pointing at a book
 * that the shelf no longer contains (which would block startup validation).
 */
export async function persistBookRemoval(bookId: string, snapshot: RemovalSnapshot, storage: RemovalStorage): Promise<void> {
  const results = await Promise.allSettled([
    storage.saveWords(snapshot.words),
    storage.saveReadingSignals(snapshot.readingSignals),
  ]);
  const failure = results.find((result) => result.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
  await storage.saveBooks(snapshot.books);
  await storage.deleteBookContent(bookId);
}
