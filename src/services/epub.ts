import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import { countWords } from '../utils/text';
import type { ParsedBook } from '../types';

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function dirname(path: string): string {
  const index = path.lastIndexOf('/');
  return index >= 0 ? path.slice(0, index + 1) : '';
}

function resolveRelative(baseFile: string, relativePath: string): string {
  const parts = `${dirname(baseFile)}${relativePath}`.split('/');
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
}

function decodeEntities(input: string): string {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
    hellip: '…', copy: '©', reg: '®', trade: '™',
  };
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)))
    .replace(/&([a-z]+);/gi, (full, name) => named[name.toLowerCase()] ?? full);
}

function htmlToParagraphs(source: string): { title?: string; paragraphs: string[] } {
  const withoutNoise = source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|h1|h2|h3|h4|li|blockquote)>/gi, '\n\n')
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ');

  const text = decodeEntities(withoutNoise)
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter((paragraph) => paragraph.length > 1);

  const heading = source.match(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/i)?.[1];
  return {
    title: heading ? decodeEntities(heading.replace(/<[^>]+>/g, ' ').trim()) : undefined,
    paragraphs,
  };
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const text = (value as Record<string, unknown>)['#text'];
    if (typeof text === 'string' || typeof text === 'number') return String(text);
  }
  return undefined;
}

export async function parseEpub(data: ArrayBuffer, fallbackTitle: string): Promise<ParsedBook> {
  const zip = await JSZip.loadAsync(data);
  if (zip.file('META-INF/encryption.xml')) {
    throw new Error('暂不支持加密或带 DRM 的 EPUB');
  }
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) throw new Error('EPUB 缺少 META-INF/container.xml');

  const container = xml.parse(await containerFile.async('string'));
  const rootfiles = asArray(container?.container?.rootfiles?.rootfile);
  const opfPath = rootfiles[0]?.['@_full-path'];
  if (!opfPath || typeof opfPath !== 'string') throw new Error('无法找到 EPUB 内容清单');

  const opfFile = zip.file(opfPath);
  if (!opfFile) throw new Error('EPUB 内容清单损坏');
  const opf = xml.parse(await opfFile.async('string'))?.package;
  if (!opf) throw new Error('无法解析 EPUB 内容清单');

  const manifestItems = asArray<Record<string, string>>(opf.manifest?.item);
  const manifest = new Map<string, Record<string, string>>();
  manifestItems.forEach((item) => {
    const id = item['@_id'];
    if (id) manifest.set(id, item);
  });

  const spineItems = asArray<Record<string, string>>(opf.spine?.itemref);
  const chapters = [];
  let extractedCharacters = 0;

  for (const [index, spine] of spineItems.entries()) {
    const item = manifest.get(spine['@_idref']);
    const href = item?.['@_href'];
    if (!href) continue;
    let decodedHref: string;
    try {
      decodedHref = decodeURIComponent(href.split('#')[0]);
    } catch {
      decodedHref = href.split('#')[0];
    }
    const chapterPath = resolveRelative(opfPath, decodedHref);
    const chapterFile = zip.file(chapterPath);
    if (!chapterFile) continue;
    const source = await chapterFile.async('string');
    extractedCharacters += source.length;
    if (extractedCharacters > 25_000_000) {
      throw new Error('EPUB 解压后的正文过大，请按卷拆分后再导入');
    }
    const parsed = htmlToParagraphs(source);
    const joined = parsed.paragraphs.join(' ');
    const wordCount = countWords(joined);
    if (wordCount < 3) continue;
    chapters.push({
      title: parsed.title || `第 ${index + 1} 章`,
      paragraphs: parsed.paragraphs,
      wordCount,
    });
  }

  if (!chapters.length) throw new Error('这本 EPUB 没有可读取的文字章节');

  const metadata = opf.metadata ?? {};
  const title = stringValue(metadata.title) || fallbackTitle;
  const author = stringValue(metadata.creator) || '未知作者';
  return { title, author, chapters, format: 'epub' };
}
