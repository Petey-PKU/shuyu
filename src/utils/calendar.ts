/** A date in the user's local calendar, independent of the UTC time of day. */
export function localDateKey(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function utcCalendarDate(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

export function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && utcCalendarDate(value).toISOString().slice(0, 10) === value;
}

/** Shift calendar days, including across daylight-saving transitions. */
export function shiftDateKey(key: string, days: number): string {
  if (!isDateKey(key) || !Number.isInteger(days)) throw new RangeError('Invalid calendar date or day offset');
  const date = utcCalendarDate(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
