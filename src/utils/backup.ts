import type { BackupPayload, Book, ReadingPreferences, ReadingSignal, ReadingStats, RecommendationState, SavedWord } from '../types';
import { isBookContent, isSafeBookId } from './bookContent';
import { isDateKey } from './calendar';
export { isSafeBookId } from './bookContent';

export function createBackupPayload(data: Omit<BackupPayload, 'app' | 'schemaVersion' | 'exportedAt'>, exportedAt = new Date().toISOString()): BackupPayload {
  if (data.books.some((book) => !data.contents[book.id] || data.contents[book.id].id !== book.id)) {
    throw new Error('有书籍正文无法读取，备份未生成');
  }
  // Older releases retained recommendation signals after deleting a book.
  const bookIds = new Set(data.books.map((book) => book.id));
  const payload: BackupPayload = { ...data, app: 'shuyu', schemaVersion: 1, exportedAt,
    readingSignals: data.readingSignals.filter((signal) => bookIds.has(signal.bookId)),
  };
  validateBackupPayload(payload);
  return payload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function isIsoDate(value: unknown) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}
function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}
export function validBook(value: unknown): value is Book {
  if (!isRecord(value)) return false;
  const progress = value.progress;
  return isSafeBookId(value.id) && typeof value.title === 'string' && typeof value.author === 'string'
    && ['txt', 'epub', 'mobi', 'azw3', 'kf8', 'pdf', 'sample'].includes(value.format as string)
    && isIsoDate(value.createdAt) && isIsoDate(value.lastOpenedAt)
    && typeof value.accent === 'string'
    && ['currentChapter', 'currentParagraph', 'totalWords', 'chapterCount'].every((key) => isNonNegativeInteger(value[key]))
    && isFiniteNumber(progress) && progress >= 0 && progress <= 1
    && (value.currentOffset === undefined || isNonNegativeInteger(value.currentOffset));
}
export function validWord(value: unknown): value is SavedWord {
  if (!isRecord(value)) return false;
  return isSafeBookId(value.id) && typeof value.word === 'string' && typeof value.meaning === 'string' && typeof value.context === 'string'
    && isSafeBookId(value.bookId) && typeof value.bookTitle === 'string' && isIsoDate(value.createdAt)
    && (value.phonetic === undefined || typeof value.phonetic === 'string')
    && (value.contextTranslation === undefined || typeof value.contextTranslation === 'string')
    && (value.chapterIndex === undefined || isNonNegativeInteger(value.chapterIndex))
    && (value.paragraphIndex === undefined || isNonNegativeInteger(value.paragraphIndex))
    && typeof value.mastered === 'boolean' && isNonNegativeInteger(value.reviewCount)
    && (value.nextReviewAt === undefined || isIsoDate(value.nextReviewAt))
    && (value.lastReviewedAt === undefined || isIsoDate(value.lastReviewedAt));
}
export function validStats(value: unknown): value is ReadingStats {
  const history = isRecord(value) ? value.dailyHistory : undefined;
  const validHistory = history === undefined || (isRecord(history) && Object.entries(history).every(([date, entry]) => {
    return isDateKey(date) && isRecord(entry)
      && isNonNegativeNumber(entry.minutes) && isNonNegativeInteger(entry.words);
  }));
  return isRecord(value) && ['words', 'todayWords', 'streak'].every((key) => isNonNegativeInteger(value[key]))
    && isNonNegativeNumber(value.minutes) && isNonNegativeNumber(value.todayMinutes)
    && (value.todayDate === undefined || typeof value.todayDate === 'string')
    && (value.lastReadDate === undefined || typeof value.lastReadDate === 'string')
    && validHistory;
}
export function validPreferences(value: unknown): value is ReadingPreferences {
  if (!isRecord(value)) return false;
  const { fontSize, lineHeight, dailyGoalMinutes } = value;
  return isFiniteNumber(fontSize) && fontSize >= 12 && fontSize <= 40
    && isFiniteNumber(lineHeight) && lineHeight >= 16 && lineHeight <= 64
    && isNonNegativeInteger(dailyGoalMinutes) && dailyGoalMinutes > 0 && dailyGoalMinutes <= 180
    && (value.theme === 'paper' || value.theme === 'white' || value.theme === 'night') && typeof value.onlineSentenceTranslation === 'boolean'
    && (value.readingStatsEnabled === undefined || typeof value.readingStatsEnabled === 'boolean')
    && (value.speechVoice === undefined || typeof value.speechVoice === 'string');
}
export function validRecommendationState(value: unknown): value is RecommendationState {
  if (!isRecord(value)) return false;
  const profile = value.profile;
  const genres = ['adventure', 'biography', 'classic', 'contemporary', 'crime', 'fantasy', 'history', 'humor', 'mystery', 'nonfiction', 'romance', 'science', 'society'];
  return Array.isArray(value.preferredGenres) && value.preferredGenres.every((item) => genres.includes(item as string))
    && Array.isArray(value.savedBookIds) && value.savedBookIds.every((item) => typeof item === 'string')
    && isRecord(value.feedback) && Object.values(value.feedback).every((item) => ['easy', 'right', 'hard'].includes(item as string))
    && (profile === undefined || (isRecord(profile) && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(profile.level as string)
      && isFiniteNumber(profile.score) && ['low', 'medium', 'high'].includes(profile.confidence as string)
      && isIsoDate(profile.assessedAt) && ['assessment', 'manual'].includes(profile.source as string)));
}
export function validSignal(value: unknown): value is ReadingSignal {
  return isRecord(value) && isSafeBookId(value.bookId) && ['lookups', 'wordsRead'].every((key) => isNonNegativeInteger(value[key])) && isNonNegativeNumber(value.minutes);
}

export function parseBackupPayload(raw: string): BackupPayload {
  if (raw.length > 140_000_000) throw new Error('备份文件过大，无法在本机安全读取');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('备份文件格式无法识别'); }
  return validateBackupPayload(value);
}

export function validateBackupPayload(value: unknown): BackupPayload {
  if (!isRecord(value) || value.app !== 'shuyu' || value.schemaVersion !== 1 || !isIsoDate(value.exportedAt)
    || !Array.isArray(value.books) || !value.books.every(validBook) || !isRecord(value.contents)
    || !Object.values(value.contents).every(isBookContent) || !Array.isArray(value.words) || !value.words.every(validWord)
    || !validStats(value.stats) || !validPreferences(value.preferences) || !validRecommendationState(value.recommendationState)
    || !Array.isArray(value.readingSignals) || !value.readingSignals.every(validSignal)) throw new Error('这不是有效的书语备份文件');
  const parsed = value as unknown as BackupPayload;
  const contents = parsed.contents;
  const bookIds = new Set(parsed.books.map((book) => book.id));
  const wordIds = new Set(parsed.words.map((word) => word.id));
  const contentIds = Object.keys(contents);
  const metadataMismatch = parsed.books.some((book) => {
    const content = contents[book.id];
    if (!content) return false;
    const totalWords = content.chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);
    const chapter = content.chapters[book.currentChapter];
    return book.chapterCount !== content.chapters.length
      || book.totalWords !== totalWords
      || book.currentChapter >= content.chapters.length
      || !chapter
      || (chapter.paragraphs.length === 0 ? book.currentParagraph !== 0 : book.currentParagraph >= chapter.paragraphs.length);
  });
  if (metadataMismatch) throw new Error('备份中的书籍元数据与正文不匹配');
  if (bookIds.size !== parsed.books.length || wordIds.size !== parsed.words.length || contentIds.length !== parsed.books.length
    || parsed.books.some((book) => contents[book.id]?.id !== book.id)
    || contentIds.some((id) => !bookIds.has(id))
    || parsed.words.some((word) => !bookIds.has(word.bookId))
    || parsed.readingSignals.some((signal) => !bookIds.has(signal.bookId))) {
    throw new Error('备份中的书籍与学习记录不匹配');
  }
  return parsed;
}
