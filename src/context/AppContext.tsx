import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import type {
  Book,
  BookContent,
  BackupPayload,
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
  restoreBackupData,
  recoverPendingRestore,
  recoverPendingImport,
  savePendingImport,
  clearPendingImport,
} from '../services/library';
import { pickAndParseBook } from '../services/importer';
import { deferReview } from '../utils/review';
import { hasSavedWord } from '../utils/savedWords';
import { mergeOcrImportStatus } from '../utils/importStatus';
import { loadAppSnapshot } from '../utils/bootstrap';
import { createBackupPayload } from '../utils/backup';
import { createPersistenceTracker } from '../utils/persistence';
import { persistBookRemoval } from '../utils/bookRemoval';
import { accumulateReadingStats } from '../utils/readingStats';
import { pickBackupFile, writeBackupFile } from '../services/backup';

interface AddWordInput {
  word: string;
  phonetic?: string;
  meaning: string;
  context: string;
  contextTranslation?: string;
  bookId: string;
  bookTitle: string;
  chapterIndex?: number;
  paragraphIndex?: number;
}

interface AppContextValue {
  ready: boolean;
  storageActivity: 'export' | 'restore' | 'reset' | null;
  storageNotice: string | null;
  dismissStorageNotice: () => void;
  startupError: string | null;
  retryLoad: () => Promise<void>;
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
  updateProgress: (bookId: string, chapter: number, paragraph: number, progress: number, offset?: number) => Promise<void>;
  addWord: (input: AddWordInput) => Promise<void>;
  toggleMastered: (wordId: string) => Promise<void>;
  deferWord: (wordId: string) => Promise<void>;
  removeWord: (wordId: string) => Promise<void>;
  removeBook: (bookId: string) => Promise<void>;
  updateBookMetadata: (bookId: string, title: string, author: string) => Promise<void>;
  updatePreferences: (next: Partial<ReadingPreferences>) => Promise<void>;
  setReadingProfile: (profile: ReadingLevelProfile) => Promise<void>;
  togglePreferredGenre: (genre: BookGenre) => Promise<void>;
  toggleSavedRecommendedBook: (bookId: string) => Promise<void>;
  setRecommendedBookFeedback: (bookId: string, feedback: DifficultyFeedback) => Promise<void>;
  recordLookup: (bookId: string) => Promise<void>;
  addReadingMinutes: (bookId: string, minutes: number, wordsRead: number) => Promise<void>;
  resetAll: () => Promise<void>;
  exportBackup: () => Promise<string | null>;
  pickBackup: () => Promise<BackupPayload | null>;
  restoreBackup: (payload: BackupPayload) => Promise<void>;
  persistenceError: string | null;
  persistenceRetrying: boolean;
  retryPersistence: () => Promise<boolean>;
}

const AppContext = createContext<AppContextValue | null>(null);

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
  const [startupError, setStartupError] = useState<string | null>(null);
  const hydratingRef = useRef(false);
  const resettingRef = useRef(false);
  const importingRef = useRef(false);
  const storageActivityRef = useRef<'export' | 'restore' | 'reset' | null>(null);
  const [storageActivity, setStorageActivity] = useState<'export' | 'restore' | 'reset' | null>(null);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const booksRef = useRef<Book[]>([]);
  const [words, setWords] = useState<SavedWord[]>([]);
  const wordsRef = useRef<SavedWord[]>([]);
  const [stats, setStats] = useState<ReadingStats>({ minutes: 0, words: 0, todayMinutes: 0, todayWords: 0, streak: 0 });
  const statsRef = useRef<ReadingStats>({ minutes: 0, words: 0, todayMinutes: 0, todayWords: 0, streak: 0 });
  const [preferences, setPreferences] = useState<ReadingPreferences>({
    fontSize: 19,
    lineHeight: 32,
    dailyGoalMinutes: 15,
    theme: 'paper',
    onlineSentenceTranslation: false,
    readingStatsEnabled: true,
    speechVoice: undefined,
  });
  const preferencesRef = useRef<ReadingPreferences>(preferences);
  const [recommendationState, setRecommendationState] = useState<RecommendationState>({
    preferredGenres: [],
    savedBookIds: [],
    feedback: {},
  });
  const recommendationStateRef = useRef<RecommendationState>(recommendationState);
  const [readingSignals, setReadingSignals] = useState<ReadingSignal[]>([]);
  const readingSignalsRef = useRef<ReadingSignal[]>([]);
  const ocrCancelRef = useRef<(() => void) | null>(null);
  const importCancelRequestedRef = useRef(false);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [persistenceRetrying, setPersistenceRetrying] = useState(false);
  const [persistence] = useState(() => createPersistenceTracker((state) => {
    setPersistenceError(state.error);
    setPersistenceRetrying(state.retrying);
  }));
  const persist = persistence.persist;

  const retryPersistence = useCallback(async () => {
    if (storageActivityRef.current || resettingRef.current || hydratingRef.current) return false;
    return persistence.retryAll();
  }, [persistence]);

  const dismissStorageNotice = useCallback(() => setStorageNotice(null), []);

  const hydrate = useCallback(async () => {
    if (hydratingRef.current) return;
    hydratingRef.current = true;
    setReady(false);
    setStartupError(null);
    try {
      const snapshot = await loadAppSnapshot({
        recoverPendingRestore, recoverPendingImport, loadBooks, loadWords, loadStats, loadPreferences, loadRecommendationState, loadReadingSignals, ensureSampleBook,
      });
      booksRef.current = snapshot.books;
      wordsRef.current = snapshot.words;
      statsRef.current = snapshot.stats;
      preferencesRef.current = snapshot.preferences;
      recommendationStateRef.current = snapshot.recommendationState;
      readingSignalsRef.current = snapshot.readingSignals;
      setBooks(snapshot.books);
      setWords(snapshot.words);
      setStats(snapshot.stats);
      setPreferences(snapshot.preferences);
      setRecommendationState(snapshot.recommendationState);
      setReadingSignals(snapshot.readingSignals);
      if (snapshot.pendingImportRecovered) setStorageNotice('已恢复上次未完成的导入，书籍已回到书架。');
      setReady(true);
    } catch {
      setStartupError('暂时无法读取本地书架。重试不会清除已有数据；若问题持续，可先重启应用。');
    } finally {
      hydratingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const importBook = useCallback(async () => {
    if (storageActivityRef.current || resettingRef.current || importingRef.current) return null;
    importingRef.current = true;
    importCancelRequestedRef.current = false;
    const startedAt = Date.now();
    let selectedFileName: string | undefined;
    setImportStatus({ phase: 'parsing', stage: 'selecting', startedAt });
    try {
      const parsed = await pickAndParseBook({
        isCancelled: () => importCancelRequestedRef.current,
        onFileSelected: (fileName) => {
          selectedFileName = fileName;
          setImportStatus((current) => current ? { ...current, fileName } : current);
        },
        onImportStage: (stage) => setImportStatus((current) => current ? { ...current, stage } : current),
        confirmOcr: async (pageCount) => {
          // Close the React Native import modal before opening the native Alert.
          setImportStatus(null);
          const confirmed = await confirmScannedPdfOcr(pageCount);
          if (confirmed) {
            setImportStatus({ phase: 'ocr', fileName: selectedFileName, startedAt, currentPage: 0, totalPages: pageCount, skippedPages: 0 });
          }
          return confirmed;
        },
        onOcrProgress: (progress) => {
          setImportStatus((current) => mergeOcrImportStatus(current, progress, startedAt));
        },
        registerOcrCancel: (cancel) => {
          ocrCancelRef.current = cancel;
        },
      });
      if (!parsed || importCancelRequestedRef.current) return null;
      setImportStatus((current) => current ? { ...current, stage: 'saving' } : current);
      const { book } = await createBook(parsed);
      try {
        await savePendingImport(book);
      } catch {
        // A temporary provider failure should not leave the freshly written
        //正文 without a recovery marker. Retry once before aborting safely.
        try {
          await savePendingImport(book);
        } catch {
          await deleteBookContent(book.id).catch(() => undefined);
          throw new Error('无法记录导入恢复状态，请检查设备空间后重试');
        }
      }
      if (importCancelRequestedRef.current) {
        await deleteBookContent(book.id);
        await clearPendingImport(book.id).catch(() => undefined);
        return null;
      }
      const next = [book, ...booksRef.current];
      booksRef.current = next;
      setBooks(next);
      const persistImportedBook = async () => {
        await saveBooks(next);
        await clearPendingImport(book.id);
      };
      const retryImportedBook = async () => {
        await saveBooks(booksRef.current);
        await clearPendingImport(book.id);
      };
      try {
        await persist('books', '书架', persistImportedBook, retryImportedBook);
      } catch {
        // Keep the imported book available for immediate reading. The
        // persistence tracker retains the latest index and exposes a retry
        // banner, so the user does not need to import the same file again.
      }
      return book;
    } catch (error) {
      if (error instanceof Error && error.message === '导入已取消') return null;
      throw error;
    } finally {
      importingRef.current = false;
      importCancelRequestedRef.current = false;
      ocrCancelRef.current = null;
      setImportStatus(null);
    }
  }, [persist]);

  const cancelImport = useCallback(() => {
    if (!importingRef.current || importStatus?.stage === 'saving') return;
    importCancelRequestedRef.current = true;
    const cancel = ocrCancelRef.current;
    setImportStatus((current) => current?.phase === 'ocr'
      ? { ...current, cancelling: true }
      : current ? { ...current, cancelling: true } : current);
    if (cancel) cancel();
  }, [importStatus?.stage]);

  const updateProgress = useCallback(async (bookId: string, chapter: number, paragraph: number, progress: number, offset?: number) => {
    if (storageActivityRef.current || resettingRef.current) return;
    const current = booksRef.current.find((book) => book.id === bookId);
    if (!current) return;
    const now = new Date().toISOString();
    const next = booksRef.current.map((book) => book.id === bookId
      ? { ...book, currentChapter: chapter, currentParagraph: paragraph, currentOffset: offset, progress, lastOpenedAt: now }
      : book);
    booksRef.current = next;
    setBooks(next);
    await persist('books', '阅读进度', () => saveBooks(next), () => saveBooks(booksRef.current));
  }, [persist]);

  const addWord = useCallback(async (input: AddWordInput) => {
    if (storageActivityRef.current || resettingRef.current || !booksRef.current.some((book) => book.id === input.bookId)) return;
    const currentWords = wordsRef.current;
    if (hasSavedWord(currentWords, input)) return;
    const next = [{ ...input, id: makeId('word'), createdAt: new Date().toISOString(), mastered: false, reviewCount: 0, nextReviewAt: new Date().toISOString() }, ...currentWords];
    wordsRef.current = next;
    setWords(next);
    await persist('words', '生词', () => saveWords(next), () => saveWords(wordsRef.current));
  }, [persist]);

  const toggleMastered = useCallback(async (wordId: string) => {
    if (storageActivityRef.current || resettingRef.current) return;
    const reviewedAt = new Date().toISOString();
    const next = wordsRef.current.map((item) => item.id === wordId
      ? { ...item, mastered: !item.mastered, reviewCount: item.reviewCount + 1, lastReviewedAt: reviewedAt, nextReviewAt: item.mastered ? reviewedAt : undefined }
      : item);
    wordsRef.current = next;
    setWords(next);
    await persist('words', '生词', () => saveWords(next), () => saveWords(wordsRef.current));
  }, [persist]);

  const deferWord = useCallback(async (wordId: string) => {
    if (storageActivityRef.current || resettingRef.current) return;
    const currentWords = wordsRef.current;
    const current = currentWords.find((item) => item.id === wordId);
    if (!current) return;
    const next = currentWords.map((item) => item.id === wordId ? deferReview(item) : item);
    wordsRef.current = next;
    setWords(next);
    await persist('words', '生词', () => saveWords(next), () => saveWords(wordsRef.current));
  }, [persist]);

  const removeWord = useCallback(async (wordId: string) => {
    if (storageActivityRef.current || resettingRef.current) return;
    const next = wordsRef.current.filter((item) => item.id !== wordId);
    wordsRef.current = next;
    setWords(next);
    await persist('words', '生词', () => saveWords(next), () => saveWords(wordsRef.current));
  }, [persist]);

  const removeBook = useCallback(async (bookId: string) => {
    if (storageActivityRef.current || resettingRef.current) return;
    const nextBooks = booksRef.current.filter((book) => book.id !== bookId);
    const nextWords = wordsRef.current.filter((word) => word.bookId !== bookId);
    const nextSignals = readingSignalsRef.current.filter((signal) => signal.bookId !== bookId);
    readingSignalsRef.current = nextSignals;
    setReadingSignals(nextSignals);
    booksRef.current = nextBooks;
    wordsRef.current = nextWords;
    setBooks(nextBooks);
    setWords(nextWords);
    const writeRemoval = () => persistBookRemoval(bookId, {
      books: booksRef.current,
      words: wordsRef.current,
      readingSignals: readingSignalsRef.current,
    }, { saveBooks, saveWords, saveReadingSignals, deleteBookContent });
    await persist(`delete-book:${bookId}`, '书籍删除', writeRemoval, writeRemoval);
  }, [persist]);

  const updateBookMetadata = useCallback(async (bookId: string, title: string, author: string) => {
    if (storageActivityRef.current || resettingRef.current) return;
    const nextTitle = title.trim();
    if (!nextTitle) throw new Error('书名不能为空');
    const next = booksRef.current.map((book) => book.id === bookId
      ? { ...book, title: nextTitle, author: author.trim() || '未知作者' }
      : book);
    const nextWords = wordsRef.current.map((word) => word.bookId === bookId
      ? { ...word, bookTitle: nextTitle }
      : word);
    booksRef.current = next;
    wordsRef.current = nextWords;
    setBooks(next);
    setWords(nextWords);
    await persist('book-metadata', '书籍信息', () => Promise.all([saveBooks(next), saveWords(nextWords)]).then(() => undefined), async () => {
      await Promise.all([saveBooks(booksRef.current), saveWords(wordsRef.current)]);
    });
  }, [persist]);

  const updatePreferences = useCallback(async (next: Partial<ReadingPreferences>) => {
    if (storageActivityRef.current || resettingRef.current) return;
    const value = { ...preferencesRef.current, ...next };
    preferencesRef.current = value;
    setPreferences(value);
    await persist('preferences', '阅读设置', () => savePreferences(value), () => savePreferences(preferencesRef.current));
  }, [persist]);

  const setReadingProfile = useCallback(async (profile: ReadingLevelProfile) => {
    if (storageActivityRef.current || resettingRef.current) return;
    const next = { ...recommendationStateRef.current, profile };
    recommendationStateRef.current = next;
    setRecommendationState(next);
    await persist('recommendations', '推荐偏好', () => saveRecommendationState(next), () => saveRecommendationState(recommendationStateRef.current));
  }, [persist]);

  const togglePreferredGenre = useCallback(async (genre: BookGenre) => {
    if (storageActivityRef.current || resettingRef.current) return;
    const current = recommendationStateRef.current;
    const exists = current.preferredGenres.includes(genre);
    const preferredGenres = exists
      ? current.preferredGenres.filter((item) => item !== genre)
      : [...current.preferredGenres, genre];
    const next = { ...current, preferredGenres };
    recommendationStateRef.current = next;
    setRecommendationState(next);
    await persist('recommendations', '推荐偏好', () => saveRecommendationState(next), () => saveRecommendationState(recommendationStateRef.current));
  }, [persist]);

  const toggleSavedRecommendedBook = useCallback(async (bookId: string) => {
    if (storageActivityRef.current || resettingRef.current) return;
    const current = recommendationStateRef.current;
    const exists = current.savedBookIds.includes(bookId);
    const savedBookIds = exists
      ? current.savedBookIds.filter((item) => item !== bookId)
      : [...current.savedBookIds, bookId];
    const next = { ...current, savedBookIds };
    recommendationStateRef.current = next;
    setRecommendationState(next);
    await persist('recommendations', '推荐偏好', () => saveRecommendationState(next), () => saveRecommendationState(recommendationStateRef.current));
  }, [persist]);

  const setRecommendedBookFeedback = useCallback(async (bookId: string, feedback: DifficultyFeedback) => {
    if (storageActivityRef.current || resettingRef.current) return;
    const current = recommendationStateRef.current;
    const next = { ...current, feedback: { ...current.feedback, [bookId]: feedback } };
    recommendationStateRef.current = next;
    setRecommendationState(next);
    await persist('recommendations', '推荐反馈', () => saveRecommendationState(next), () => saveRecommendationState(recommendationStateRef.current));
  }, [persist]);

  const recordLookup = useCallback(async (bookId: string) => {
    if (storageActivityRef.current || resettingRef.current || !booksRef.current.some((book) => book.id === bookId)) return;
    const currentSignals = readingSignalsRef.current;
    const current = currentSignals.find((signal) => signal.bookId === bookId);
    const next = current
      ? currentSignals.map((signal) => signal.bookId === bookId ? { ...signal, lookups: signal.lookups + 1 } : signal)
      : [...currentSignals, { bookId, lookups: 1, wordsRead: 0, minutes: 0 }];
    readingSignalsRef.current = next;
    setReadingSignals(next);
    await persist('reading-signals', '阅读记录', () => saveReadingSignals(next), () => saveReadingSignals(readingSignalsRef.current));
  }, [persist]);

  const addReadingMinutes = useCallback(async (bookId: string, minutes: number, wordsRead: number) => {
    if (storageActivityRef.current || resettingRef.current || !booksRef.current.some((book) => book.id === bookId)) return;
    if (preferencesRef.current.readingStatsEnabled === false) return;
    const currentStats = statsRef.current;
    const next = accumulateReadingStats(currentStats, minutes, wordsRead);
    if (next === currentStats) return;
    const addedMinutes = next.minutes - currentStats.minutes;
    const addedWords = next.words - currentStats.words;
    statsRef.current = next;
    setStats(next);
    const currentSignals = readingSignalsRef.current;
    const currentSignal = currentSignals.find((signal) => signal.bookId === bookId);
    const nextSignals = currentSignal
      ? currentSignals.map((signal) => signal.bookId === bookId
        ? { ...signal, minutes: signal.minutes + addedMinutes, wordsRead: signal.wordsRead + addedWords }
        : signal)
      : [...currentSignals, { bookId, lookups: 0, minutes: addedMinutes, wordsRead: addedWords }];
    readingSignalsRef.current = nextSignals;
    setReadingSignals(nextSignals);
    await persist('reading-stats', '阅读统计', () => Promise.all([saveStats(next), saveReadingSignals(nextSignals)]).then(() => undefined), async () => {
      await Promise.all([saveStats(statsRef.current), saveReadingSignals(readingSignalsRef.current)]);
    });
  }, [persist]);

  const resetAll = useCallback(async () => {
    if (resettingRef.current || importingRef.current || storageActivityRef.current) return;
    resettingRef.current = true;
    storageActivityRef.current = 'reset';
    setStorageActivity('reset');
    setReady(false);
    setStartupError(null);
    setStorageNotice(null);
    try {
      await persistence.waitForIdle();
      await clearAllLocalData();
      persistence.clear();
      setBooks([]);
      booksRef.current = [];
      setWords([]);
      wordsRef.current = [];
      const emptyStats = { minutes: 0, words: 0, todayMinutes: 0, todayWords: 0, streak: 0 };
      statsRef.current = emptyStats;
      setStats(emptyStats);
      const emptyPreferences = { fontSize: 19, lineHeight: 32, dailyGoalMinutes: 15, theme: 'paper' as const, onlineSentenceTranslation: false, readingStatsEnabled: true, speechVoice: undefined };
      const emptyRecommendations = { preferredGenres: [], savedBookIds: [], feedback: {} };
      preferencesRef.current = emptyPreferences;
      recommendationStateRef.current = emptyRecommendations;
      setPreferences(emptyPreferences);
      setRecommendationState(emptyRecommendations);
      setReadingSignals([]);
      readingSignalsRef.current = [];
      await hydrate();
    } catch {
      setStartupError('清除数据未能完成。请重新读取当前数据，确认书架状态后再操作。');
    } finally {
      resettingRef.current = false;
      storageActivityRef.current = null;
      setStorageActivity(null);
    }
  }, [hydrate, persistence]);

  const exportBackup = useCallback(async () => {
    if (storageActivityRef.current || resettingRef.current || importingRef.current) throw new Error('请等待当前数据操作完成后再备份');
    storageActivityRef.current = 'export';
    setStorageActivity('export');
    const snapshot = {
      books: booksRef.current,
      words: wordsRef.current,
      stats: statsRef.current,
      preferences: preferencesRef.current,
      recommendationState: recommendationStateRef.current,
      readingSignals: readingSignalsRef.current,
    };
    try {
      await persistence.waitForIdle();
      const contents: Record<string, BookContent> = {};
      for (const book of snapshot.books) contents[book.id] = await loadBookContent(book.id);
      return await writeBackupFile(createBackupPayload({ ...snapshot, contents }));
    } finally {
      storageActivityRef.current = null;
      setStorageActivity(null);
    }
  }, [persistence]);

  const restoreBackup = useCallback(async (payload: BackupPayload) => {
    if (storageActivityRef.current || resettingRef.current || importingRef.current) throw new Error('请等待当前数据操作完成后再恢复');
    storageActivityRef.current = 'restore';
    setStorageActivity('restore');
    setReady(false);
    setStartupError(null);
    setStorageNotice(null);
    try {
      await persistence.waitForIdle();
      const restored = await restoreBackupData(payload);
      persistence.clear();
      booksRef.current = restored.books;
      wordsRef.current = restored.words;
      statsRef.current = restored.stats;
      preferencesRef.current = restored.preferences;
      recommendationStateRef.current = restored.recommendationState;
      readingSignalsRef.current = restored.readingSignals;
      setBooks(restored.books);
      setWords(restored.words);
      setStats(restored.stats);
      setPreferences(restored.preferences);
      setRecommendationState(restored.recommendationState);
      setReadingSignals(restored.readingSignals);
      setStorageNotice('恢复完成：书架、阅读进度、生词和设置已从备份恢复。');
      setReady(true);
    } catch (error) {
      // Re-read only after the persisted rollback has completed; otherwise stay on recovery screen.
      await hydrate();
      throw error;
    } finally {
      storageActivityRef.current = null;
      setStorageActivity(null);
    }
  }, [hydrate, persistence]);

  const value = useMemo(() => ({
    ready, storageActivity, storageNotice, dismissStorageNotice, startupError, retryLoad: hydrate, importing: importStatus !== null, importStatus, books, words, stats, preferences, recommendationState, readingSignals, importBook, cancelImport,
    getBookContent: loadBookContent, updateProgress, addWord, toggleMastered, deferWord,
    removeWord, removeBook, updateBookMetadata, updatePreferences, setReadingProfile, togglePreferredGenre,
    toggleSavedRecommendedBook, setRecommendedBookFeedback, recordLookup, addReadingMinutes, resetAll, persistenceError, persistenceRetrying, retryPersistence,
    exportBackup, pickBackup: pickBackupFile, restoreBackup,
  }), [
    ready, storageActivity, storageNotice, dismissStorageNotice, startupError, hydrate, importStatus, books, words, stats, preferences, recommendationState, readingSignals, importBook, cancelImport, updateProgress,
    addWord, toggleMastered, deferWord, removeWord, removeBook, updateBookMetadata, updatePreferences, addReadingMinutes, resetAll,
    setReadingProfile, togglePreferredGenre, toggleSavedRecommendedBook, setRecommendedBookFeedback, recordLookup,
    exportBackup, restoreBackup, persistenceError, persistenceRetrying, retryPersistence,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
