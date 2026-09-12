import type { BookContent } from '../types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isSafeBookId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

/** Validate disk and backup content before it reaches the reader's render path. */
export function isBookContent(value: unknown): value is BookContent {
  if (!isRecord(value) || !isSafeBookId(value.id) || typeof value.title !== 'string'
    || (value.author !== undefined && typeof value.author !== 'string')
    || !Array.isArray(value.chapters) || value.chapters.length === 0) return false;
  const chapterIds = new Set<string>();
  return value.chapters.every((chapter) => {
    if (!isRecord(chapter) || !isSafeBookId(chapter.id) || chapterIds.has(chapter.id)
      || typeof chapter.title !== 'string' || !Array.isArray(chapter.paragraphs)
      || !chapter.paragraphs.every((text) => typeof text === 'string')
      || typeof chapter.wordCount !== 'number' || !Number.isSafeInteger(chapter.wordCount) || chapter.wordCount < 0) return false;
    chapterIds.add(chapter.id);
    return true;
  });
}

export function parseBookContent(raw: string, expectedId: string): BookContent {
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new Error('本地书籍正文已损坏，请从原文件重新导入，或在设置中恢复备份。'); }
  if (isRecord(value) && Array.isArray(value.chapters) && value.chapters.length === 0) {
    throw new Error('这本书没有可阅读的章节，请从原文件重新导入。');
  }
  if (!isBookContent(value)) {
    throw new Error('本地书籍正文不完整，请从原文件重新导入，或在设置中恢复备份。');
  }
  if (value.id !== expectedId) {
    throw new Error('本地正文与这本书不匹配，请从原文件重新导入，或在设置中恢复备份。');
  }
  return value;
}
