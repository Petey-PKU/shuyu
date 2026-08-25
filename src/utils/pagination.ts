export interface MeasuredLine {
  text: string;
  y: number;
  height: number;
}

export interface ReaderPage {
  start: number;
  end: number;
  text: string;
}

interface LocatedLine extends MeasuredLine {
  start: number;
  end: number;
}

function locateLines(source: string, lines: MeasuredLine[]): LocatedLine[] {
  let cursor = 0;
  return lines.map((line) => {
    const text = line.text.replace(/[\r\n]+$/u, '');
    let start = cursor;
    if (text) {
      const exact = source.indexOf(text, cursor);
      if (exact >= 0) start = exact;
      else {
        while (start < source.length && /\s/u.test(source[start])) start += 1;
      }
    }
    const end = Math.min(source.length, start + text.length);
    cursor = Math.max(cursor, end);
    return { ...line, text, start, end };
  });
}

/**
 * Converts React Native's real Text layout result into fixed-height reader pages.
 * Page boundaries always fall on a rendered line boundary, never in a word.
 */
export function paginateMeasuredText(
  source: string,
  lines: MeasuredLine[],
  pageHeight: number,
  firstPageHeight: number,
): ReaderPage[] {
  if (!source.trim()) return [{ start: 0, end: source.length, text: source }];
  if (!lines.length || pageHeight <= 0 || firstPageHeight <= 0) {
    return [{ start: 0, end: source.length, text: source }];
  }

  const located = locateLines(source, lines);
  const pages: ReaderPage[] = [];
  let lineIndex = 0;

  while (lineIndex < located.length) {
    const firstLineIndex = lineIndex;
    const firstLine = located[firstLineIndex];
    const heightLimit = pages.length === 0 ? firstPageHeight : pageHeight;
    const pageTop = firstLine.y;
    lineIndex += 1;

    while (lineIndex < located.length) {
      const candidate = located[lineIndex];
      if (candidate.y + candidate.height - pageTop > heightLimit + 0.5) break;
      lineIndex += 1;
    }

    let start = firstLine.start;
    const nextStart = lineIndex < located.length ? located[lineIndex].start : source.length;
    let end = Math.max(start, nextStart);
    while (start < end && /[ \t\r\n]/u.test(source[start])) start += 1;
    while (end > start && /[ \t]/u.test(source[end - 1])) end -= 1;
    if (end > start) pages.push({ start, end, text: source.slice(start, end) });
  }

  return pages.length ? pages : [{ start: 0, end: source.length, text: source }];
}

export function paragraphStarts(paragraphs: string[]): number[] {
  const starts: number[] = [];
  let offset = 0;
  paragraphs.forEach((paragraph, index) => {
    starts.push(offset);
    offset += paragraph.length + (index < paragraphs.length - 1 ? 2 : 0);
  });
  return starts;
}

export function paragraphAtOffset(starts: number[], offset: number): number {
  if (!starts.length) return 0;
  let low = 0;
  let high = starts.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (starts[middle] <= offset) low = middle + 1;
    else high = middle - 1;
  }
  return Math.max(0, Math.min(starts.length - 1, high));
}

export function pageAtOffset(pages: ReaderPage[], offset: number): number {
  const index = pages.findIndex((page) => offset >= page.start && offset < page.end);
  if (index >= 0) return index;
  return Math.max(0, pages.length - 1);
}
