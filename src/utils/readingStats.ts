import type { ReadingStats } from '../types';
import { isDateKey, localDateKey, shiftDateKey } from './calendar';

const HISTORY_DAYS = 90;
type DailyHistory = NonNullable<ReadingStats['dailyHistory']>;

function positiveAmount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/** Recover the one dated total older versions stored, without inventing earlier days. */
export function getReadingHistory(stats: ReadingStats): DailyHistory {
  const history = { ...stats.dailyHistory };
  if (isDateKey(stats.todayDate)) {
    const previous = history[stats.todayDate];
    history[stats.todayDate] = {
      minutes: Math.max(previous?.minutes ?? 0, stats.todayMinutes),
      words: Math.max(previous?.words ?? 0, stats.todayWords),
    };
  }
  return history;
}

export function recordReadingDay(
  history: ReadingStats['dailyHistory'],
  dateKey: string,
  minutes: number,
  words: number,
): DailyHistory {
  const cutoff = shiftDateKey(dateKey, -(HISTORY_DAYS - 1));
  const next = {
    ...(history ?? {}),
    [dateKey]: {
      minutes: (history?.[dateKey]?.minutes ?? 0) + positiveAmount(minutes),
      words: (history?.[dateKey]?.words ?? 0) + Math.floor(positiveAmount(words)),
    },
  };
  // Use calendar age rather than entry count. Keep future records if the clock moves back.
  return Object.fromEntries(Object.entries(next).filter(([key]) => isDateKey(key) && key >= cutoff));
}

export function accumulateReadingStats(current: ReadingStats, minutes: number, words: number, now = new Date()): ReadingStats {
  const addedMinutes = positiveAmount(minutes);
  const addedWords = Math.floor(positiveAmount(words));
  if (!addedMinutes && !addedWords) return current;
  const today = localDateKey(now);
  const history = recordReadingDay(getReadingHistory(current), today, addedMinutes, addedWords);
  const streak = current.lastReadDate === today ? current.streak
    : current.lastReadDate === shiftDateKey(today, -1) ? current.streak + 1 : 1;
  return {
    ...current,
    minutes: current.minutes + addedMinutes,
    words: current.words + addedWords,
    todayMinutes: history[today].minutes,
    todayWords: history[today].words,
    todayDate: today,
    streak,
    lastReadDate: today,
    dailyHistory: history,
  };
}

export function getRecentReadingDays(stats: ReadingStats, now = new Date()) {
  const history = getReadingHistory(stats);
  const today = localDateKey(now);
  return Array.from({ length: 7 }, (_, index) => {
    const key = shiftDateKey(today, index - 6);
    const entry = history[key];
    return {
      key,
      label: key === today ? '今天' : `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`,
      recorded: entry !== undefined,
      minutes: entry?.minutes ?? 0,
      words: entry?.words ?? 0,
    };
  });
}
