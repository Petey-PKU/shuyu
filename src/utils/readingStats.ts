import type { ReadingStats } from '../types';

const HISTORY_DAYS = 90;

export function recordReadingDay(
  history: ReadingStats['dailyHistory'],
  dateKey: string,
  minutes: number,
  words: number,
): ReadingStats['dailyHistory'] {
  const next = {
    ...(history ?? {}),
    [dateKey]: {
      minutes: (history?.[dateKey]?.minutes ?? 0) + Math.max(0, minutes),
      words: (history?.[dateKey]?.words ?? 0) + Math.max(0, words),
    },
  };
  const keys = Object.keys(next).sort();
  return Object.fromEntries(keys.slice(-HISTORY_DAYS).map((key) => [key, next[key]]));
}
