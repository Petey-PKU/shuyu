import { recommendedBooks } from '../data/recommendedBooks';
import type {
  Book,
  BookGenre,
  DifficultyFeedback,
  LanguageLevel,
  ReadingSignal,
  RecommendationState,
  RecommendedBook,
} from '../types';

export const levelOrder: LanguageLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const levelLabels: Record<LanguageLevel, string> = {
  A1: '基础入门', A2: '初级阅读', B1: '中级阅读', B2: '中高级', C1: '高级阅读', C2: '精通挑战',
};

export const genreLabels: Record<BookGenre, string> = {
  adventure: '冒险', biography: '传记', classic: '经典', contemporary: '当代', crime: '犯罪', fantasy: '奇幻',
  history: '历史', humor: '幽默', mystery: '悬疑', nonfiction: '非虚构', romance: '爱情', science: '科学', society: '社会',
};

export const genreOptions = Object.keys(genreLabels) as BookGenre[];

const levelScores: Record<LanguageLevel, number> = { A1: 16, A2: 31, B1: 46, B2: 61, C1: 77, C2: 93 };

function normalizeTitle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function stableNoise(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  return Math.abs(hash % 100) / 100;
}

function hasComparableReadingSignal(signal: ReadingSignal, books: Book[]) {
  if (signal.wordsRead < 800) return false;
  const imported = books.find((book) => book.id === signal.bookId);
  if (!imported) return false;
  return recommendedBooks.some((book) => normalizeTitle(book.title) === normalizeTitle(imported.title));
}

export function hasRecommendationReadingSignal(signals: ReadingSignal[], books: Book[]) {
  return signals.some((signal) => hasComparableReadingSignal(signal, books));
}

export function effectiveReadingScore(state: RecommendationState, signals: ReadingSignal[], books: Book[]) {
  const base = state.profile?.score ?? levelScores.B1;
  const adjustments: number[] = [];

  for (const signal of signals) {
    if (!hasComparableReadingSignal(signal, books)) continue;
    const imported = books.find((book) => book.id === signal.bookId);
    const catalogBook = imported && recommendedBooks.find((book) => normalizeTitle(book.title) === normalizeTitle(imported.title));
    if (!catalogBook) continue;
    const lookupsPerThousand = signal.lookups / Math.max(1, signal.wordsRead) * 1000;
    if (lookupsPerThousand <= 10 && catalogBook.difficulty >= base - 6) adjustments.push(4);
    if (lookupsPerThousand >= 35) adjustments.push(-5);
  }

  for (const [bookId, feedback] of Object.entries(state.feedback)) {
    const catalogBook = recommendedBooks.find((book) => book.id === bookId);
    if (!catalogBook) continue;
    if (feedback === 'easy') adjustments.push(catalogBook.difficulty >= base - 8 ? 4 : 2);
    if (feedback === 'hard') adjustments.push(catalogBook.difficulty <= base + 8 ? -4 : -2);
    if (feedback === 'right') adjustments.push(Math.max(-3, Math.min(3, catalogBook.difficulty - base)));
  }

  if (!adjustments.length) return base;
  const adjustment = adjustments.reduce((sum, value) => sum + value, 0) / adjustments.length;
  return Math.max(4, Math.min(100, Math.round(base + Math.max(-5, Math.min(5, adjustment)))));
}

function feedbackBoost(feedback?: DifficultyFeedback) {
  if (feedback === 'right') return 10;
  if (feedback === 'easy') return -2;
  if (feedback === 'hard') return -12;
  return 0;
}

export function rankRecommendedBooks(
  state: RecommendationState,
  signals: ReadingSignal[],
  importedBooks: Book[],
  books: RecommendedBook[] = recommendedBooks,
) {
  const target = effectiveReadingScore(state, signals, importedBooks);
  return [...books].sort((left, right) => {
    const score = (book: RecommendedBook) => {
      const difficultyFit = Math.max(0, 100 - Math.abs(book.difficulty - target) * 4);
      const interestFit = state.preferredGenres.length
        ? Math.min(100, book.genres.filter((genre) => state.preferredGenres.includes(genre)).length * 65)
        : 58;
      const savedBoost = state.savedBookIds.includes(book.id) ? 5 : 0;
      return difficultyFit * 0.62 + interestFit * 0.28 + feedbackBoost(state.feedback[book.id]) + savedBoost + stableNoise(book.id) * 3;
    };
    return score(right) - score(left);
  });
}

export function recommendationMatchLabel(book: RecommendedBook, targetScore: number) {
  const distance = book.difficulty - targetScore;
  if (distance <= -9) return '轻松阅读';
  if (distance <= 7) return '正合适';
  if (distance <= 14) return '稍有挑战';
  return '进阶挑战';
}
