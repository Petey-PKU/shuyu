import type { SavedWord } from '../types';

export function deferReview(word: SavedWord, now = Date.now()): SavedWord {
  return {
    ...word,
    reviewCount: word.reviewCount + 1,
    lastReviewedAt: new Date(now).toISOString(),
    nextReviewAt: new Date(now + 10 * 60_000).toISOString(),
  };
}

export function nextReviewTime(words: SavedWord[]) {
  const next = words.reduce((earliest, word) => {
    const time = Date.parse(word.nextReviewAt ?? '');
    return !word.mastered && Number.isFinite(time) ? Math.min(earliest, time) : earliest;
  }, Infinity);
  return Number.isFinite(next) ? new Date(next).toISOString() : undefined;
}

export function isWordDue(nextReviewAt?: string, now = Date.now()) {
  if (!nextReviewAt) return true;
  const timestamp = Date.parse(nextReviewAt);
  return !Number.isFinite(timestamp) || timestamp <= now;
}

export function reviewDelayLabel(nextReviewAt?: string, now = Date.now()) {
  if (!nextReviewAt) return '现在可复习';
  const remaining = Date.parse(nextReviewAt) - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return '现在可复习';
  const minutes = Math.ceil(remaining / 60_000);
  if (minutes < 60) return `${minutes} 分钟后再来`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours} 小时后再来`;
  return `${Math.ceil(hours / 24)} 天后再来`;
}

/** Escape user/backup-provided text before placing it inside a regular expression. */
export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
