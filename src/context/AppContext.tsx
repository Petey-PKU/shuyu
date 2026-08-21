import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Book, BookContent, ReadingPreferences, ReadingStats, SavedWord } from '../types';
import {
  clearAllLocalData,
  createBook,
  deleteBookContent,
  ensureSampleBook,
  loadBookContent,
  loadBooks,
  loadPreferences,
  loadStats,
  loadWords,
  makeId,
  migrateLegacyData,
  saveBooks,
  savePreferences,
  saveStats,
  saveWords,
} from '../services/library';
import { pickAndParseBook } from '../services/importer';

interface AddWordInput {
  word: string;
  phonetic?: string;
  meaning: string;
  context: string;
  contextTranslation?: string;
  bookId: string;
  bookTitle: string;
}

interface AppContextValue {
  ready: boolean;
  importing: boolean;
  books: Book[];
  words: SavedWord[];
  stats: ReadingStats;
  preferences: ReadingPreferences;
  importBook: () => Promise<Book | null>;
  getBookContent: (bookId: string) => Promise<BookContent>;
  updateProgress: (bookId: string, chapter: number, paragraph: number, progress: number) => Promise<void>;
  addWord: (input: AddWordInput) => Promise<void>;
  toggleMastered: (wordId: string) => Promise<void>;
  removeWord: (wordId: string) => Promise<void>;
  removeBook: (bookId: string) => Promise<void>;
  updatePreferences: (next: Partial<ReadingPreferences>) => Promise<void>;
  addReadingMinutes: (minutes: number, wordsRead: number) => Promise<void>;
  resetAll: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [importing, setImporting] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [words, setWords] = useState<SavedWord[]>([]);
  const [stats, setStats] = useState<ReadingStats>({ minutes: 0, words: 0, streak: 0 });
  const [preferences, setPreferences] = useState<ReadingPreferences>({
    fontSize: 19,
    lineHeight: 32,
    theme: 'paper',
    onlineSentenceTranslation: true,
  });

  const hydrate = useCallback(async () => {
    await migrateLegacyData();
    const [loadedBooks, loadedWords, loadedStats, loadedPreferences] = await Promise.all([
      loadBooks(), loadWords(), loadStats(), loadPreferences(),
    ]);
    const sampleBook = await ensureSampleBook();
    const nextBooks = sampleBook ? [sampleBook, ...loadedBooks] : loadedBooks;
    if (sampleBook) await saveBooks(nextBooks);
    setBooks(nextBooks);
    setWords(loadedWords);
    setStats(loadedStats);
    setPreferences(loadedPreferences);
    setReady(true);
  }, []);

  useEffect(() => {
    hydrate().catch((error) => {
      console.error(error);
      setReady(true);
    });
  }, [hydrate]);

  const importBook = useCallback(async () => {
    setImporting(true);
    try {
      const parsed = await pickAndParseBook();
      if (!parsed) return null;
      const { book } = await createBook(parsed);
      const next = [book, ...books];
      setBooks(next);
      await saveBooks(next);
      return book;
    } finally {
      setImporting(false);
    }
  }, [books]);

  const updateProgress = useCallback(async (bookId: string, chapter: number, paragraph: number, progress: number) => {
    const current = books.find((book) => book.id === bookId);
    if (current && current.currentChapter === chapter && current.currentParagraph === paragraph && Math.abs(current.progress - progress) < 0.0001) return;
    const now = new Date().toISOString();
    const next = books.map((book) => book.id === bookId
      ? { ...book, currentChapter: chapter, currentParagraph: paragraph, progress, lastOpenedAt: now }
      : book);
    setBooks(next);
    await saveBooks(next);
  }, [books]);

  const addWord = useCallback(async (input: AddWordInput) => {
    const existing = words.find((item) => item.word.toLowerCase() === input.word.toLowerCase() && item.context === input.context);
    if (existing) return;
    const next = [{ ...input, id: makeId('word'), createdAt: new Date().toISOString(), mastered: false, reviewCount: 0 }, ...words];
    setWords(next);
    await saveWords(next);
  }, [words]);

  const toggleMastered = useCallback(async (wordId: string) => {
    const next = words.map((item) => item.id === wordId
      ? { ...item, mastered: !item.mastered, reviewCount: item.reviewCount + 1 }
      : item);
    setWords(next);
    await saveWords(next);
  }, [words]);

  const removeWord = useCallback(async (wordId: string) => {
    const next = words.filter((item) => item.id !== wordId);
    setWords(next);
    await saveWords(next);
  }, [words]);

  const removeBook = useCallback(async (bookId: string) => {
    const nextBooks = books.filter((book) => book.id !== bookId);
    const nextWords = words.filter((word) => word.bookId !== bookId);
    setBooks(nextBooks);
    setWords(nextWords);
    await Promise.all([saveBooks(nextBooks), saveWords(nextWords), deleteBookContent(bookId)]);
  }, [books, words]);

  const updatePreferences = useCallback(async (next: Partial<ReadingPreferences>) => {
    const value = { ...preferences, ...next };
    setPreferences(value);
    await savePreferences(value);
  }, [preferences]);

  const addReadingMinutes = useCallback(async (minutes: number, wordsRead: number) => {
    if (minutes <= 0 && wordsRead <= 0) return;
    const today = localDateKey(new Date());
    let streak = stats.streak;
    if (stats.lastReadDate !== today) {
      const yesterday = localDateKey(new Date(Date.now() - 86_400_000));
      streak = stats.lastReadDate === yesterday ? stats.streak + 1 : 1;
    }
    const next = {
      minutes: stats.minutes + Math.max(0, minutes),
      words: stats.words + Math.max(0, wordsRead),
      streak,
      lastReadDate: today,
    };
    setStats(next);
    await saveStats(next);
  }, [stats]);

  const resetAll = useCallback(async () => {
    await clearAllLocalData();
    setReady(false);
    setBooks([]);
    setWords([]);
    setStats({ minutes: 0, words: 0, streak: 0 });
    setPreferences({ fontSize: 19, lineHeight: 32, theme: 'paper', onlineSentenceTranslation: true });
    await hydrate();
  }, [hydrate]);

  const value = useMemo(() => ({
    ready, importing, books, words, stats, preferences, importBook,
    getBookContent: loadBookContent, updateProgress, addWord, toggleMastered,
    removeWord, removeBook, updatePreferences, addReadingMinutes, resetAll,
  }), [
    ready, importing, books, words, stats, preferences, importBook, updateProgress,
    addWord, toggleMastered, removeWord, removeBook, updatePreferences, addReadingMinutes, resetAll,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
