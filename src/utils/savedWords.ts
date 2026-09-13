import type { SavedWord } from '../types';

type WordSource = Pick<SavedWord, 'bookId' | 'word' | 'context'>;

/** Bookmark state and save deduplication must identify the same book context. */
export function hasSavedWord(words: readonly WordSource[], source: WordSource): boolean {
  const normalized = source.word.toLowerCase();
  return words.some((item) => item.bookId === source.bookId
    && item.word.toLowerCase() === normalized && item.context === source.context);
}
