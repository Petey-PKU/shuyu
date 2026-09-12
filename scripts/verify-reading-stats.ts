import assert from 'node:assert/strict';
import type { ReadingStats } from '../src/types';
import { isDateKey, localDateKey, shiftDateKey } from '../src/utils/calendar';
import { accumulateReadingStats, getReadingHistory, getRecentReadingDays, recordReadingDay } from '../src/utils/readingStats';

const legacy: ReadingStats = {
  minutes: 25, words: 250, todayMinutes: 5, todayWords: 50,
  todayDate: '2026-09-10', lastReadDate: '2026-09-10', streak: 3,
};
const original = structuredClone(legacy);
const upgraded = accumulateReadingStats(legacy, 2, 10, new Date(2026, 8, 11, 8));
assert.deepEqual(upgraded.dailyHistory, {
  '2026-09-10': { minutes: 5, words: 50 }, '2026-09-11': { minutes: 2, words: 10 },
}, 'Upgrading on the next day must recover the legacy total at its original date');
assert.equal(upgraded.minutes, 27, 'Migration does not add the old total a second time');
assert.equal(upgraded.words, 260);
assert.equal(upgraded.todayMinutes, 2);
assert.equal(upgraded.todayWords, 10);
assert.equal(upgraded.streak, 4);
assert.deepEqual(legacy, original, 'Calculation must not mutate the persisted snapshot');

const again = accumulateReadingStats(upgraded, 3, 20, new Date(2026, 8, 11, 9));
assert.equal(again.minutes, 30);
assert.equal(again.todayMinutes, 5);
assert.equal(again.streak, 4, 'More reading today does not add another streak day');
assert.deepEqual(again.dailyHistory?.['2026-09-11'], { minutes: 5, words: 30 });
assert.deepEqual(upgraded.dailyHistory?.['2026-09-11'], { minutes: 2, words: 10 });
assert.equal(accumulateReadingStats(again, 1, 1, new Date(2026, 8, 13)).streak, 1, 'A missed day starts a new streak');

const migrationHistories: ReadingStats['dailyHistory'][] = [undefined, {}, { '2026-09-10': { minutes: 2, words: 20 } }];
for (const dailyHistory of migrationHistories) {
  const sameDay = accumulateReadingStats({ ...legacy, dailyHistory }, 2, 10, new Date(2026, 8, 10, 14));
  assert.deepEqual(sameDay.dailyHistory?.['2026-09-10'], { minutes: 7, words: 60 }, 'Empty or partial history must not lose legacy totals');
}
assert.deepEqual(getReadingHistory({ ...legacy, dailyHistory: { '2026-09-10': { minutes: 6, words: 60 } } })['2026-09-10'], { minutes: 6, words: 60 }, 'Do not replace a more complete history entry with stale legacy totals');
assert.deepEqual(getReadingHistory({ ...legacy, todayDate: '2026-02-30' }), {}, 'An invalid old date must not invent a history entry or crash startup');
assert.deepEqual(getReadingHistory({ ...legacy, todayDate: undefined }), {}, 'Undated legacy totals cannot be assigned to an arbitrary day');

const sparseHistory = {
  '2020-01-01': { minutes: 9, words: 90 },
  '2026-08-03': { minutes: 3, words: 30 }, // 91st day, excluded
  '2026-08-04': { minutes: 4, words: 40 }, // 90th day, included
  '2026-11-01': { minutes: 1, words: 10 },
  '2026-11-02': { minutes: 2, words: 20 }, // device clock moved back
};
const sparseBefore = structuredClone(sparseHistory);
const trimmed = recordReadingDay(sparseHistory, '2026-11-01', 2, 3);
assert.deepEqual(Object.keys(trimmed).sort(), ['2026-08-04', '2026-11-01', '2026-11-02'], 'Retention measures calendar days, even when reading records are sparse');
assert.deepEqual(trimmed['2026-11-01'], { minutes: 3, words: 13 });
assert.deepEqual(sparseHistory, sparseBefore);
const oldHistory = Object.fromEntries(Array.from({ length: 91 }, (_, index) => [shiftDateKey('2026-01-01', index), { minutes: 1, words: 1 }]));
assert.deepEqual(recordReadingDay(oldHistory, '2026-11-01', 2, 3), { '2026-11-01': { minutes: 2, words: 3 } }, 'A long absence clears expired entries rather than keeping the last 90 entries');
const retainedTotals = accumulateReadingStats({ ...legacy, dailyHistory: sparseHistory }, 1, 2, new Date(2026, 10, 1));
assert.equal(retainedTotals.minutes, 26, 'Clearing old daily detail does not reduce lifetime totals');

for (const [minutes, words] of [[0, 0], [-1, -5], [NaN, Infinity]]) {
  assert.equal(accumulateReadingStats(legacy, minutes, words), legacy, 'Empty/invalid increments must not change totals or streak');
}
const validPart = accumulateReadingStats(legacy, NaN, 3.8, new Date(2026, 8, 10));
assert.equal(validPart.minutes, 25);
assert.equal(validPart.words, 253, 'Word counts stay whole and valid increments survive an invalid minute delta');

for (const date of ['2024-02-29', '2000-02-29', '2026-01-01', '0099-01-01']) assert.ok(isDateKey(date), date);
for (const date of ['2026-02-29', '1900-02-29', '2026-04-31', '2026-00-10', '2026-13-01', '2026-1-01', '2026-01-00', null]) assert.equal(isDateKey(date), false, String(date));
assert.equal(shiftDateKey('2024-03-01', -1), '2024-02-29');
assert.equal(shiftDateKey('2026-01-01', -1), '2025-12-31');
assert.throws(() => shiftDateKey('2026-02-30', -1), RangeError);

// Run in America/New_York as well as Asia/Shanghai: these straddle the 23h and 25h days.
for (const [now, yesterday, today] of [
  [new Date(2026, 2, 9, 0, 30), '2026-03-08', '2026-03-09'],
  [new Date(2026, 10, 1, 23, 30), '2026-10-31', '2026-11-01'],
] as const) {
  assert.equal(localDateKey(now), today);
  const next = accumulateReadingStats({ ...legacy, todayDate: yesterday, lastReadDate: yesterday }, 1, 1, now);
  assert.equal(next.streak, 4, 'Calendar-consecutive reading keeps the streak across daylight-saving changes');
  const days = getRecentReadingDays(next, now);
  assert.equal(days[5].key, yesterday);
  assert.equal(days[6].key, today);
  assert.equal(new Set(days.map((day) => day.key)).size, 7, 'Every calendar day appears exactly once');
}

const days = getRecentReadingDays({ ...legacy, todayDate: '2025-12-31', dailyHistory: { '2026-01-01': { minutes: 0, words: 3 }, '2026-01-03': { minutes: 99, words: 99 } } }, new Date(2026, 0, 2));
assert.deepEqual(days.map((day) => day.key), ['2025-12-27', '2025-12-28', '2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02']);
assert.equal(days[4].minutes, 5, 'Trend recovers a dated legacy total before the next reading session');
assert.equal(days[5].recorded, true, 'Recorded zero minutes differ from no record');
assert.equal(days[5].minutes, 0);
assert.equal(days[6].recorded, false);
assert.equal(days.reduce((sum, day) => sum + day.minutes, 0), 5, 'Future entries and missing dates do not inflate the displayed sum');

console.log(`Reading statistics migration, retention, calendar and trend verification passed (${Intl.DateTimeFormat().resolvedOptions().timeZone}).`);
