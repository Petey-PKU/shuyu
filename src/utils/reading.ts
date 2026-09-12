import type { Chapter } from '../types';
import { paragraphAtOffset, paragraphStarts, type ReaderPage } from './pagination';
import { tokenizeParagraph } from './text';

/** Resolve old paragraph-only positions and newer character positions safely. */
export function resolveReadingPosition(chapters: Chapter[], chapterIndex = 0, paragraphIndex = 0, offset?: number) {
  if (!chapters.length) throw new Error('书籍没有可阅读的章节，请重新导入');
  const safeChapter = Number.isFinite(chapterIndex) ? Math.max(0, Math.min(chapters.length - 1, Math.trunc(chapterIndex))) : 0;
  const paragraphs = chapters[safeChapter].paragraphs;
  const starts = paragraphStarts(paragraphs);
  const safeParagraph = safeParagraphIndex(paragraphs.length, paragraphIndex);
  const lastOffset = Math.max(0, paragraphs.join('\n\n').length - 1);
  const safeOffset = offset !== undefined && Number.isFinite(offset)
    ? Math.max(0, Math.min(lastOffset, Math.trunc(offset)))
    : starts[safeParagraph] ?? 0;
  return { chapterIndex: safeChapter, paragraphIndex: paragraphAtOffset(starts, safeOffset), offset: safeOffset };
}

/** Keep persisted reader positions valid even when a chapter has no paragraphs. */
export function safeParagraphIndex(paragraphCount: number, paragraphIndex = 0) {
  if (paragraphCount <= 0) return 0;
  return Number.isFinite(paragraphIndex)
    ? Math.max(0, Math.min(paragraphCount - 1, Math.trunc(paragraphIndex)))
    : 0;
}

/** Progress reflects the text the reader has actually reached, including the final page. */
export function progressAtPage(completedWords: number, chapterWords: number, totalWords: number, pageEnd: number, chapterLength: number) {
  const share = chapterLength <= 0 || pageEnd >= chapterLength ? 1 : Math.max(0, pageEnd / chapterLength);
  return Math.min(1, Math.max(0, (completedWords + chapterWords * share) / Math.max(1, totalWords)));
}

/** Count displayed words once per session, including across chapters and reflow. */
export class ReadingCoverage {
  private seen = new Map<string, Set<number>>();
  totalWords = 0;

  recordPage(chapterId: string, page: ReaderPage) {
    let offsets = this.seen.get(chapterId);
    if (!offsets) {
      offsets = new Set<number>();
      this.seen.set(chapterId, offsets);
    }
    for (const token of tokenizeParagraph(page.text)) {
      if (!token.word) continue;
      const offset = page.start + token.start;
      if (offsets.has(offset)) continue;
      offsets.add(offset);
      this.totalWords += 1;
    }
  }
}
