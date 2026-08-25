import type { ParsedBook } from '../types';
import { countWords, splitPlainText } from '../utils/text';

const MAX_PDF_CHARACTERS = 25_000_000;
const MAX_SECTION_WORDS = 5_000;

export class PdfNeedsOcrError extends Error {
  readonly code = 'PDF_NEEDS_OCR';

  constructor() {
    super('PDF 中没有足够的可复制英文文字，需要使用 OCR 识别扫描页面');
    this.name = 'PdfNeedsOcrError';
  }
}

function cleanExtractedText(text: string): string {
  return text
    .replace(/^\s*(?:page\s+)?\d+\s*$/gim, '')
    .replace(/([A-Za-z])-[ \t]*\r?\n[ \t]*([a-z])/g, '$1$2')
    .replace(/\f+/g, '\n\n')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000\u000b]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

export function pdfNeedsOcr(text: string, pageCount: number) {
  const minimumWords = Math.max(10, Math.min(50, Math.max(1, pageCount) * 2));
  return countWords(cleanExtractedText(text)) < minimumWords;
}

function splitOversizedSections(chapters: ParsedBook['chapters']): ParsedBook['chapters'] {
  const result: ParsedBook['chapters'] = [];
  for (const chapter of chapters) {
    if (chapter.wordCount <= MAX_SECTION_WORDS) {
      result.push(chapter);
      continue;
    }
    let paragraphs: string[] = [];
    let words = 0;
    let part = 1;
    const flush = () => {
      if (!paragraphs.length) return;
      result.push({
        title: part === 1 ? chapter.title : `${chapter.title}（续 ${part}）`,
        paragraphs,
        wordCount: words,
      });
      paragraphs = [];
      words = 0;
      part += 1;
    };
    for (const paragraph of chapter.paragraphs) {
      const paragraphWords = countWords(paragraph);
      if (paragraphs.length && words + paragraphWords > MAX_SECTION_WORDS) flush();
      paragraphs.push(paragraph);
      words += paragraphWords;
    }
    flush();
  }
  return result;
}

export function parseExtractedPdfText(text: string, fallbackTitle: string): ParsedBook {
  if (text.length > MAX_PDF_CHARACTERS) throw new Error('PDF 提取出的正文过大，请按卷拆分后再导入');
  const cleaned = cleanExtractedText(text);
  if (countWords(cleaned) < 10) {
    throw new PdfNeedsOcrError();
  }
  const chapters = splitOversizedSections(splitPlainText(cleaned, fallbackTitle));
  if (!chapters.length) throw new Error('没有从 PDF 中识别到可阅读正文');
  return { title: fallbackTitle, author: '本地导入', chapters, format: 'pdf' };
}
