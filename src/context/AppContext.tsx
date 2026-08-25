import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import type {
  Book,
  BookContent,
  BookGenre,
  DifficultyFeedback,
  ImportStatus,
  ReadingLevelProfile,
  ReadingPreferences,
  ReadingSignal,
  ReadingStats,
  RecommendationState,
  SavedWord,
} from '../types';
import {
  clearAllLocalData,
  createBook,
  deleteBookContent,
  ensureSampleBook,
  loadBookContent,
  loadBooks,
  loadPreferences,
  loadReadingSignals,
  loadRecommendationState,
  loadStats,
  loadWords,
  makeId,
  saveBooks,
  savePreferences,
  saveReadingSignals,
  saveRecommendationState,
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
  importStatus: ImportStatus | null;
  books: Book[];
  words: SavedWord[];
  stats: ReadingStats;
  preferences: ReadingPreferences;
  recommendationState: RecommendationState;
  readingSignals: ReadingSignal[];
  importBook: () => Promise<Book | null>;
  cancelImport: () => void;
  getBookContent: (bookId: string) => Promise<BookContent>;
  updateProgress: (bookId: string, chapter: number, paragraph: number, progress: number) => Promise<void>;
  addWord: (input: AddWordInput) => Promise<void>;
  toggleMastered: (wordId: string) => Promise<void>;
  removeWord: (wordId: string) => Promise<void>;
  removeBook: (bookId: string) => Promise<void>;
  updatePreferences: (next: Partial<ReadingPreferences>) => Promise<void>;
  setReadingProfile: (profile: ReadingLevelProfile) => Promise<void>;
  togglePreferredGenre: (genre: BookGenre) => Promise<void>;
  toggleSavedRecommendedBook: (bookId: string) => Promise<void>;
  setRecommendedBookFeedback: (bookId: string, feedback: DifficultyFeedback) => Promise<void>;
  recordLookup: (bookId: string) => Promise<void>;
  addReadingMinutes: (bookId: string, minutes: number, wordsRead: number) => Promise<void>;
  resetAll: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function confirmScannedPdfOcr(pageCount: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    Alert.alert(
      '检测到扫描版 PDF',
      `这份 PDF 共 ${pageCount} 页，未找到足够的可复制文字。是否在本机逐页进行英文 OCR？识别可能需要较长时间，但书页不会上传。`,
      [
        { text: '取消导入', style: 'cancel', onPress: () => finish(false) },
        { text: '开始识别', onPress: () => finish(true) },
      ],
      { cancelable: true, onDismiss: () => finish(false) },
    );
  });
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [words, setWords] = useState<SavedWord[]>([]);
  const [stats, setStats] = useState<ReadingStats>({ minutes: 0, words: 0, streak: 0 });
  const [preferences, setPreferences] = useState<ReadingPreferences>({
    fontSize: 19,
    lineHeight: 32,
    theme: 'paper',
    onlineSentenceTranslation: true,
  });
  const [recommendationState, setRecommendationState] = useState<RecommendationState>({
    preferredGenres: [],
    savedBookIds: [],
    feedback: {},
  });
  const [readingSignals, setReadingSignals] = useState<ReadingSignal[]>([]);
  const readingSignalsRef = useRef<ReadingSignal[]>([]);
  const ocrCancelRef = useRef<(() => void) | null>(null);

  const hydrate = useCallback(async () => {
    const [loadedBooks, loadedWords, loadedStats, loadedPreferences, loadedRecommendations, loadedSignals] = await Promise.all([
      loadBooks(), loadWords(), loadStats(), loadPreferences(), loadRecommendationState(), loadReadingSignals(),
    ]);
    const sampleBook = await ensureSampleBook();
    const nextBooks = sampleBook ? [sampleBook, ...loadedBooks] : loadedBooks;
    if (sampleBook) await saveBooks(nextBooks);
    setBooks(nextBooks);
    setWords(loadedWords);
    setStats(loadedStats);
    setPreferences(loadedPreferences);
    setRecommendationState(loadedRecommendations);
    setReadingSignals(loadedSignals);
    readingSignalsRef.current = loadedSignals;
    setReady(true);
  }, []);

  useEffect(() => {
    hydrate().catch((error) => {
      console.error(error);
      setReady(true);
    });
  }, [hydrate]);

  const importBook = useCallback(async () => {
    setImportStatus({ phase: 'parsing' });
    try {
      const parsed = await pickAndParseBook({
        confirmOcr: async (pageCount) => {
          // Close the React Native import modal before opening the native Alert.
          setImportStatus(null);
          const confirmed = await confirmScannedPdfOcr(pageCount);
          if (confirmed) {
            setImportStatus({ phase: 'ocr', currentPage: 0, totalPages: pageCount, skippedPages: 0 });
          }
          return confirmed;
        },
        onOcrProgress: ({ currentPage, totalPages, skippedPages, cancelling }) => {
          setImportStatus((current) => ({
            phase: 'ocr',
            currentPage,
            totalPages,
            skippedPages,
            cancelling: current?.cancelling || cancelling,
          }));
        },
        registerOcrCancel: (cancel) => {
          ocrCancelRef.current = cancel;
        },
      });
      if (!parsed) return null;
      const { book } = await createBook(parsed);
      const next = [book, ...books];
      setBooks(next);
      await saveBooks(next);
      return book;
    } finally {
      ocrCancelRef.current = null;
      setImportStatus(null);
    }
  }, [books]);

  const cancelImport = useCallback(() => {
    const cancel = ocrCancelRef.current;
    if (!cancel) return;
    setImportStatus((current) => current?.phase === 'ocr'
      ? { ...current, cancelling: true }
      : current);
    cancel();
  }, []);

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

  const setReadingProfile = useCallback(async (profile: ReadingLevelProfile) => {
    const next = { ...recommendationState, profile };
    setRecommendationState(next);
    await saveRecommendationState(next);
  }, [recommendationState]);

  const togglePreferredGenre = useCallback(async (genre: BookGenre) => {
    const exists = recommendationState.preferredGenres.includes(genre);
    const preferredGenres = exists
      ? recommendationState.preferredGenres.filter((item) => item !== genre)
      : [...recommendationState.preferredGenres, genre];
    const next = { ...recommendationState, preferredGenres };
    setRecommendationState(next);
    await saveRecommendationState(next);
  }, [recommendationState]);

  const toggleSavedRecommendedBook = useCallback(async (bookId: string) => {
    const exists = recommendationState.savedBookIds.includes(bookId);
    const savedBookIds = exists
      ? recommendationState.savedBookIds.filter((item) => item !== bookId)
      : [...recommendationState.savedBookIds, bookId];
    const next = { ...recommendationState, savedBookIds };
    setRecommendationState(next);
    await saveRecommendationState(next);
  }, [recommendationState]);

  const setRecommendedBookFeedback = useCallback(async (bookId: string, feedback: DifficultyFeedback) => {
    const next = { ...recommendationState, feedback: { ...recommendationState.feedback, [bookId]: feedback } };
    setRecommendationState(next);
    await saveRecommendationState(next);
  }, [recommendationState]);

  const recordLookup = useCallback(async (bookId: string) => {
    const currentSignals = readingSignalsRef.current;
    const current = currentSignals.find((signal) => signal.bookId === bookId);
    const next = current
      ? currentSignals.map((signal) => signal.bookId === bookId ? { ...signal, lookups: signal.lookups + 1 } : signal)
      : [...currentSignals, { bookId, lookups: 1, wordsRead: 0, minutes: 0 }];
    readingSignalsRef.current = next;
    setReadingSignals(next);
    await saveReadingSignals(next);
  }, []);

  const addReadingMinutes = useCallback(async (bookId: string, minutes: number, wordsRead: number) => {
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
    const currentSignals = readingSignalsRef.current;
    const currentSignal = currentSignals.find((signal) => signal.bookId === bookId);
    const nextSignals = currentSignal
      ? currentSignals.map((signal) => signal.bookId === bookId
        ? { ...signal, minutes: signal.minutes + Math.max(0, minutes), wordsRead: signal.wordsRead + Math.max(0, wordsRead) }
        : signal)
      : [...currentSignals, { bookId, lookups: 0, minutes: Math.max(0, minutes), wordsRead: Math.max(0, wordsRead) }];
    readingSignalsRef.current = nextSignals;
    setReadingSignals(nextSignals);
    await Promise.all([saveStats(next), saveReadingSignals(nextSignals)]);
  }, [stats]);

  const resetAll = useCallback(async () => {
    await clearAllLocalData();
    setReady(false);
    setBooks([]);
    setWords([]);
    setStats({ minutes: 0, words: 0, streak: 0 });
    setPreferences({ fontSize: 19, lineHeight: 32, theme: 'paper', onlineSentenceTranslation: true });
    setRecommendationState({ preferredGenres: [], savedBookIds: [], feedback: {} });
    setReadingSignals([]);
    readingSignalsRef.current = [];
    await hydrate();
  }, [hydrate]);

  const value = useMemo(() => ({
    ready, importing: importStatus !== null, importStatus, books, words, stats, preferences, recommendationState, readingSignals, importBook, cancelImport,
    getBookContent: loadBookContent, updateProgress, addWord, toggleMastered,
    removeWord, removeBook, updatePreferences, setReadingProfile, togglePreferredGenre,
    toggleSavedRecommendedBook, setRecommendedBookFeedback, recordLookup, addReadingMinutes, resetAll,
  }), [
    ready, importStatus, books, words, stats, preferences, recommendationState, readingSignals, importBook, cancelImport, updateProgress,
    addWord, toggleMastered, removeWord, removeBook, updatePreferences, addReadingMinutes, resetAll,
    setReadingProfile, togglePreferredGenre, toggleSavedRecommendedBook, setRecommendedBookFeedback, recordLookup,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
