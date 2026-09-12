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

/** Retain the source file until every index stops referencing the deleted book. */
export async function persistBookRemoval(bookId: string, snapshot: RemovalSnapshot, storage: RemovalStorage): Promise<void> {
  const results = await Promise.allSettled([
    storage.saveBooks(snapshot.books),
    storage.saveWords(snapshot.words),
    storage.saveReadingSignals(snapshot.readingSignals),
  ]);
  const failure = results.find((result) => result.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
  await storage.deleteBookContent(bookId);
}
