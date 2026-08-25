import {
  initKf8File,
  initMobiFile,
  type Kf8,
  type Kf8TocItem,
  type Mobi,
  type MobiMetadata,
  type MobiTocItem,
} from '@lingo-reader/mobi-parser';
import type { BookFormat, ParsedBook } from '../types';
import { countWords } from '../utils/text';
import { htmlToParagraphs } from './markup';

const MAX_EXTRACTED_CHARACTERS = 25_000_000;
type KindleFormat = Extract<BookFormat, 'mobi' | 'azw3' | 'kf8'>;
type KindleTocItem = MobiTocItem | Kf8TocItem;

export interface KindleFileInspection {
  isKindle: boolean;
  mobiVersion?: number;
  likelyKf8: boolean;
}

interface KindleTextParser {
  getMetadata(): MobiMetadata;
  getSpine(): { id: string; text?: string }[];
  getToc(): KindleTocItem[];
  loadChapter(id: string): { html: string } | undefined;
  resolveHref(href: string): { id: string; selector: string } | undefined;
  destroy(): void;
}

interface Kf8RawTextParser extends KindleTextParser {
  loadText?: (chapter: { id: string }) => string;
}

function formatLabel(format: KindleFormat) {
  return format === 'mobi' ? 'MOBI' : format.toUpperCase();
}

function asciiAt(data: ArrayBuffer, offset: number, length: number) {
  if (offset < 0 || offset + length > data.byteLength) return '';
  return String.fromCharCode(...new Uint8Array(data, offset, length));
}

export function inspectKindleFile(data: ArrayBuffer): KindleFileInspection {
  if (data.byteLength < 118) return { isKindle: false, likelyKf8: false };
  const view = new DataView(data);
  const recordCount = view.getUint16(76, false);
  if (recordCount < 1 || 78 + recordCount * 8 > data.byteLength) {
    return { isKindle: false, likelyKf8: false };
  }
  const firstRecordOffset = view.getUint32(78, false);
  const pdbSignature = `${asciiAt(data, 60, 4)}${asciiAt(data, 64, 4)}`;
  if (pdbSignature !== 'BOOKMOBI' || firstRecordOffset + 56 > data.byteLength) {
    return { isKindle: false, likelyKf8: false };
  }
  if (asciiAt(data, firstRecordOffset + 16, 4) !== 'MOBI') {
    return { isKindle: false, likelyKf8: false };
  }
  const mobiVersion = view.getUint32(firstRecordOffset + 36, false);
  return { isKindle: true, mobiVersion, likelyKf8: mobiVersion >= 8 };
}

export function assertDrmFreeKindleFile(data: ArrayBuffer, format: KindleFormat) {
  if (data.byteLength < 94) throw new Error(`${formatLabel(format)} 文件过小或已损坏`);
  const view = new DataView(data);
  const recordCount = view.getUint16(76, false);
  if (recordCount < 1) throw new Error(`${formatLabel(format)} 文件缺少内容记录`);
  const firstRecordOffset = view.getUint32(78, false);
  if (firstRecordOffset < 86 || firstRecordOffset + 16 > data.byteLength) {
    throw new Error(`${formatLabel(format)} 文件记录表已损坏`);
  }
  const encryptionType = view.getUint16(firstRecordOffset + 12, false);
  if (encryptionType !== 0) {
    throw new Error(`暂不支持带 DRM 或加密的 ${formatLabel(format)} 文件`);
  }
}

function installObjectUrlFallback() {
  const urlApi = globalThis.URL as unknown as {
    createObjectURL?: (value: unknown) => string;
  };
  if (!urlApi || typeof urlApi.createObjectURL === 'function') return () => undefined;

  try {
    let resourceId = 0;
    Object.defineProperty(urlApi, 'createObjectURL', {
      configurable: true,
      value: () => `about:blank#kindle-resource-${resourceId++}`,
    });
    return () => {
      try {
        delete urlApi.createObjectURL;
      } catch {
        // The fallback only exists for the duration of this local text extraction.
      }
    };
  } catch {
    return () => undefined;
  }
}

function collectTocTitles(parser: KindleTextParser, items: KindleTocItem[], titles: Map<string, string>) {
  for (const item of items) {
    let resolved: { id: string } | undefined;
    try {
      resolved = parser.resolveHref(item.href);
    } catch {
      resolved = undefined;
    }
    const label = item.label?.replace(/\s+/g, ' ').trim();
    if (resolved?.id && label && !titles.has(resolved.id)) titles.set(resolved.id, label);
    if (item.children?.length) collectTocTitles(parser, item.children, titles);
  }
}

function loadChapterSource(
  parser: KindleTextParser,
  spineItem: { id: string; text?: string },
  format: KindleFormat,
) {
  if (spineItem.text?.trim()) return spineItem.text;

  if (format !== 'mobi') {
    const loadRawKf8Text = (parser as Kf8RawTextParser).loadText;
    if (typeof loadRawKf8Text === 'function') {
      try {
        // v0.4.6 exposes this method at runtime despite marking it private in its
        // declarations. Reading before resource replacement avoids malformed CSS/image
        // links breaking text-only imports, and those resources are discarded anyway.
        return loadRawKf8Text.call(parser, spineItem);
      } catch {
        // Fall back to the package's public chapter loader below.
      }
    }
  }

  try {
    return parser.loadChapter(spineItem.id)?.html ?? '';
  } catch {
    return '';
  }
}

async function parseKindleBook(
  data: ArrayBuffer,
  fallbackTitle: string,
  format: KindleFormat,
  initialize: (input: Uint8Array) => Promise<KindleTextParser>,
): Promise<ParsedBook> {
  let parser: KindleTextParser | undefined;
  const restoreObjectUrl = installObjectUrlFallback();
  try {
    assertDrmFreeKindleFile(data, format);
    parser = await initialize(new Uint8Array(data));
    const metadata = parser.getMetadata();
    const tocTitles = new Map<string, string>();
    collectTocTitles(parser, parser.getToc(), tocTitles);

    const chapters: ParsedBook['chapters'] = [];
    let extractedCharacters = 0;
    for (const spineItem of parser.getSpine()) {
      const source = loadChapterSource(parser, spineItem, format);
      if (!source.trim()) continue;
      extractedCharacters += source.length;
      if (extractedCharacters > MAX_EXTRACTED_CHARACTERS) {
        throw new Error(`${formatLabel(format)} 解压后的正文过大，请按卷拆分后再导入`);
      }
      const sections = source.split(/<mbp:pagebreak\b[^>]*\/?\s*>/gi).filter((section) => section.trim());
      for (const [sectionIndex, section] of sections.entries()) {
        const parsed = htmlToParagraphs(section);
        const wordCount = countWords(parsed.paragraphs.join(' '));
        if (wordCount < 3) continue;
        chapters.push({
          title: sectionIndex === 0
            ? tocTitles.get(spineItem.id) || parsed.title || '开始阅读'
            : parsed.title || tocTitles.get(spineItem.id) || `第 ${chapters.length + 1} 章`,
          paragraphs: parsed.paragraphs,
          wordCount,
        });
      }
    }

    if (!chapters.length) {
      throw new Error(`这本 ${formatLabel(format)} 没有可读取的文字章节；请确认文件无 DRM 且不是固定版式`);
    }
    return {
      title: metadata.title?.trim() || fallbackTitle,
      author: metadata.author?.filter(Boolean).join('、') || '未知作者',
      chapters,
      format,
    };
  } catch (error) {
    if (error instanceof Error && /DRM|加密|正文过大|没有可读取|文件过小|记录表|内容记录/.test(error.message)) {
      throw error;
    }
    throw new Error(`无法解析 ${formatLabel(format)} 文件：${error instanceof Error ? error.message : '文件可能损坏或格式不受支持'}。仅支持无 DRM 的可重排文字内容`);
  } finally {
    try {
      parser?.destroy();
    } catch {
      // Parsing text does not depend on disposable image resources.
    }
    restoreObjectUrl();
  }
}

export function parseMobi(data: ArrayBuffer, fallbackTitle: string): Promise<ParsedBook> {
  return parseKindleBook(data, fallbackTitle, 'mobi', (input) => initMobiFile(input) as Promise<Mobi>);
}

export function parseKf8(
  data: ArrayBuffer,
  fallbackTitle: string,
  format: Extract<KindleFormat, 'azw3' | 'kf8'>,
): Promise<ParsedBook> {
  return parseKindleBook(data, fallbackTitle, format, (input) => initKf8File(input) as Promise<Kf8>);
}

export async function parseKindle(
  data: ArrayBuffer,
  fallbackTitle: string,
  requestedFormat: KindleFormat,
): Promise<ParsedBook> {
  const inspection = inspectKindleFile(data);
  if (!inspection.isKindle) {
    throw new Error(`${formatLabel(requestedFormat)} 文件头无法识别；文件可能损坏、扩展名不正确，或实际为 KFX/AZW4 等不受支持格式`);
  }

  const attempts: Array<() => Promise<ParsedBook>> = requestedFormat === 'mobi' && !inspection.likelyKf8
    ? [() => parseMobi(data, fallbackTitle), () => parseKf8(data, fallbackTitle, 'kf8')]
    : [() => parseKf8(data, fallbackTitle, requestedFormat === 'mobi' ? 'kf8' : requestedFormat), () => parseMobi(data, fallbackTitle)];
  const errors: string[] = [];
  for (const attempt of attempts) {
    try {
      const parsed = await attempt();
      return { ...parsed, format: requestedFormat };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/DRM|加密/.test(message)) throw error;
      errors.push(message);
    }
  }
  throw new Error(`无法解析 ${formatLabel(requestedFormat)} 文件。已尝试 KF8 与兼容 MOBI 内容：${errors.join('；')}`);
}
