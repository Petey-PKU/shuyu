import assert from 'node:assert/strict';
import type { Book, BookContent, ReadingPreferences, ReadingSignal, ReadingStats, RecommendationState, SavedWord } from '../src/types';
import { createBackupPayload, parseBackupPayload } from '../src/utils/backup';
import { formatBackupOperationError } from '../src/utils/backupErrors';

const book: Book = { id: 'book_1', title: 'A Story', author: 'Reader', format: 'txt', createdAt: '2026-09-09T00:00:00Z', lastOpenedAt: '2026-09-09T00:00:00Z', currentChapter: 0, currentParagraph: 0, progress: 0, totalWords: 2, chapterCount: 1, accent: '#333' };
const content: BookContent = { id: book.id, title: book.title, chapters: [{ id: 'chapter_1', title: 'Start', paragraphs: ['One two.'], wordCount: 2 }] };
const word: SavedWord = { id: 'word_1', word: 'one', meaning: '一', context: 'One two.', bookId: book.id, bookTitle: book.title, createdAt: '2026-09-09T00:00:00Z', mastered: false, reviewCount: 0 };
const stats: ReadingStats = { minutes: 1, words: 2, todayMinutes: 1, todayWords: 2, streak: 1 };
const preferences: ReadingPreferences = { fontSize: 19, lineHeight: 32, dailyGoalMinutes: 15, theme: 'paper', onlineSentenceTranslation: true };
const recommendationState: RecommendationState = { preferredGenres: [], savedBookIds: [], feedback: {} };
const readingSignals: ReadingSignal[] = [{ bookId: book.id, lookups: 1, wordsRead: 2, minutes: 1 }];

const payload = createBackupPayload({ books: [book], contents: { [book.id]: content }, words: [word], stats, preferences, recommendationState, readingSignals }, '2026-09-09T12:00:00Z');
const parsed = parseBackupPayload(JSON.stringify(payload));
assert.deepEqual(parsed, payload, 'A written backup should round-trip without changing learning data');
const datedStats: ReadingStats = { ...stats, todayDate: '2026-09-09', lastReadDate: '2026-09-09', dailyHistory: { '2024-02-29': { minutes: 0.5, words: 5 }, '2026-09-09': { minutes: 1, words: 2 } } };
const historyBackup = createBackupPayload({ ...payload, stats: datedStats });
assert.deepEqual(parseBackupPayload(JSON.stringify(historyBackup)).stats, datedStats, 'Daily history, including fractional minutes and leap dates, survives export/import');
assert.equal(parseBackupPayload(JSON.stringify({ ...payload, preferences: { ...preferences, readingStatsEnabled: false } })).preferences.readingStatsEnabled, false, 'The reading-stat opt-out survives backup round-trip');
for (const dailyHistory of [null, [], { '2026-02-29': { minutes: 1, words: 2 } }, { '2026-09-09': { minutes: -1, words: 2 } }, { '2026-09-09': { minutes: 1, words: 0.5 } }, { '2026-09-09': null }, { '2026-09-09': { minutes: null, words: 2 } }]) {
  assert.throws(() => parseBackupPayload(JSON.stringify({ ...payload, stats: { ...stats, dailyHistory } })), /有效的书语备份/, 'Reject malformed daily records before restoring');
}
assert.throws(() => createBackupPayload({ books: [book], contents: {}, words: [], stats, preferences, recommendationState, readingSignals }), /正文无法读取/);
assert.throws(() => parseBackupPayload(JSON.stringify({ ...payload, exportedAt: 'invalid' })), /有效的书语备份/);
assert.throws(() => parseBackupPayload(JSON.stringify({ ...payload, contents: { other: content } })), /书籍与学习记录不匹配/);
assert.throws(() => parseBackupPayload(JSON.stringify({ ...payload, books: [{ ...book, chapterCount: 2 }] })), /书籍元数据与正文不匹配/);
assert.throws(() => parseBackupPayload(JSON.stringify({ ...payload, books: [{ ...book, totalWords: 3 }] })), /书籍元数据与正文不匹配/);
assert.throws(() => parseBackupPayload(JSON.stringify({ ...payload, books: [{ ...book, currentParagraph: 2 }] })), /书籍元数据与正文不匹配/);
assert.throws(() => parseBackupPayload(JSON.stringify({ ...payload, words: [{ ...word, bookId: 'missing' }] })), /书籍与学习记录不匹配/);
assert.throws(() => parseBackupPayload(JSON.stringify({ ...payload, books: [{ ...book, id: '../escape' }], contents: { '../escape': { ...content, id: '../escape' } }, words: [{ ...word, bookId: '../escape' }], readingSignals: [{ ...readingSignals[0], bookId: '../escape' }] })), /有效的书语备份/);
assert.throws(() => parseBackupPayload(JSON.stringify({ ...payload, books: [{ ...book, progress: 2 }] })), /有效的书语备份/);
assert.throws(() => parseBackupPayload(JSON.stringify({ ...payload, preferences: { ...preferences, fontSize: 100 } })), /有效的书语备份/);
assert.throws(() => parseBackupPayload(JSON.stringify({ ...payload, readingSignals: [{ ...readingSignals[0], bookId: 'missing' }] })), /书籍与学习记录不匹配/);
assert.throws(() => parseBackupPayload(JSON.stringify({ ...payload, contents: { [book.id]: content, orphan: { ...content, id: 'orphan' } } })), /书籍与学习记录不匹配/);
assert.throws(() => parseBackupPayload(JSON.stringify({ ...payload, books: [book, book] })), /书籍与学习记录不匹配/);
assert.throws(() => parseBackupPayload(JSON.stringify({ ...payload, words: [word, word] })), /书籍与学习记录不匹配/);
assert.throws(() => parseBackupPayload(JSON.stringify({ ...payload, recommendationState: { ...recommendationState, profile: { level: 'unknown' } } })), /有效的书语备份/);
assert.throws(() => parseBackupPayload(JSON.stringify({ ...payload, preferences: { ...preferences, speechVoice: {} } })), /有效的书语备份/);
assert.throws(() => parseBackupPayload(JSON.stringify({ ...payload, stats: { ...stats, dailyHistory: { '2026-02-30': { minutes: 1, words: 2 } } } })), /有效的书语备份/);
assert.equal(formatBackupOperationError(new Error('EACCES: permission denied'), 'fallback'), '设备暂时不允许访问文件，请检查存储权限后重试');
assert.equal(formatBackupOperationError(new Error('ENOENT: file not found'), 'fallback'), '备份文件或目录已不可用，请重新选择后重试');
assert.equal(formatBackupOperationError(new Error('disk full'), 'fallback'), '设备存储空间可能不足，请清理空间后重试');
assert.equal(formatBackupOperationError(new Error('unexpected provider error'), 'fallback'), 'fallback');
const withDeletedBookSignal = createBackupPayload({ ...payload, readingSignals: [...readingSignals, { bookId: 'deleted_book', lookups: 3, wordsRead: 8, minutes: 2 }] });
assert.deepEqual(withDeletedBookSignal.readingSignals, readingSignals, 'Legacy deleted-book signals must not make a newly exported backup unrestorable');
assert.deepEqual(parseBackupPayload(JSON.stringify({ ...payload, stats: { ...stats, minutes: 1.5 }, readingSignals: [{ ...readingSignals[0], minutes: 0.5 }] })).stats.minutes, 1.5);
console.log('Backup payload validation and round-trip verification passed.');
