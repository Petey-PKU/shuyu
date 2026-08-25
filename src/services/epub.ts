import JSZip, { type JSZipObject } from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import { countWords } from '../utils/text';
import type { ParsedBook } from '../types';
import { decodeHtmlEntities, htmlToParagraphs } from './markup';

const MAX_EXTRACTED_CHARACTERS = 25_000_000;
const FONT_OBFUSCATION_ALGORITHMS = new Set([
  'http://www.idpf.org/2008/embedding',
  'http://ns.adobe.com/pdf/enc#RC',
]);

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
});

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function safeDecodeUri(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeArchivePath(path: string): string {
  const clean = safeDecodeUri(path.split(/[?#]/)[0])
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  const stack: string[] = [];
  for (const part of clean.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
}

function dirname(path: string): string {
  const index = path.lastIndexOf('/');
  return index >= 0 ? path.slice(0, index + 1) : '';
}

function resolveRelative(baseFile: string, relativePath: string): string {
  return normalizeArchivePath(`${dirname(baseFile)}${relativePath}`);
}

function buildZipIndex(zip: JSZip): Map<string, JSZipObject> {
  const index = new Map<string, JSZipObject>();
  Object.values(zip.files).forEach((file) => {
    if (file.dir) return;
    const raw = normalizeArchivePath(file.name).toLowerCase();
    const decoded = normalizeArchivePath(safeDecodeUri(file.name)).toLowerCase();
    index.set(raw, file);
    index.set(decoded, file);
  });
  return index;
}

function findZipFile(index: Map<string, JSZipObject>, path: string): JSZipObject | undefined {
  return index.get(normalizeArchivePath(path).toLowerCase());
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim() || undefined;
  if (value && typeof value === 'object') {
    const text = (value as Record<string, unknown>)['#text'];
    if (typeof text === 'string' || typeof text === 'number') return String(text).trim() || undefined;
  }
  return undefined;
}

function firstStringValue(value: unknown): string | undefined {
  for (const item of asArray(value)) {
    const text = stringValue(item);
    if (text) return text;
  }
  return undefined;
}

function cleanLabel(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function assertReadableEncryption(source: string) {
  const blocks = source.match(/<(?:\w+:)?EncryptedData\b[\s\S]*?<\/(?:\w+:)?EncryptedData>/gi);
  if (!blocks?.length) return;
  for (const block of blocks) {
    const algorithm = block.match(/<(?:\w+:)?EncryptionMethod\b[^>]*\bAlgorithm\s*=\s*["']([^"']+)["']/i)?.[1];
    const target = block.match(/<(?:\w+:)?CipherReference\b[^>]*\bURI\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
    const isFont = /\.(?:otf|ttf|woff2?)(?:[?#].*)?$/i.test(target);
    if (!algorithm || !FONT_OBFUSCATION_ALGORITHMS.has(algorithm) || !isFont) {
      throw new Error('暂不支持加密或带 DRM 的 EPUB');
    }
  }
}

function addTocTitle(titles: Map<string, string>, basePath: string, href: string, label: string) {
  const title = cleanLabel(label);
  if (!title) return;
  titles.set(resolveRelative(basePath, href).toLowerCase(), title);
}

function walkNcxPoints(value: unknown, ncxPath: string, titles: Map<string, string>) {
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  const navLabel = record.navLabel as Record<string, unknown> | undefined;
  const content = record.content as Record<string, unknown> | undefined;
  const label = firstStringValue(navLabel?.text);
  const href = stringValue(content?.['@_src']);
  if (label && href) addTocTitle(titles, ncxPath, href, label);
  asArray(record.navPoint).forEach((child) => walkNcxPoints(child, ncxPath, titles));
}

async function readTocTitles(
  opf: Record<string, any>,
  opfPath: string,
  manifestItems: Record<string, string>[],
  files: Map<string, JSZipObject>,
): Promise<Map<string, string>> {
  const titles = new Map<string, string>();
  const navItem = manifestItems.find((item) => item['@_properties']?.split(/\s+/).includes('nav'));
  if (navItem?.['@_href']) {
    const navPath = resolveRelative(opfPath, navItem['@_href']);
    const navFile = findZipFile(files, navPath);
    if (navFile) {
      const source = await navFile.async('string');
      const links = source.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi);
      for (const match of links) addTocTitle(titles, navPath, match[2], match[3]);
    }
  }

  const tocId = opf.spine?.['@_toc'];
  const ncxItem = manifestItems.find((item) => item['@_id'] === tocId)
    ?? manifestItems.find((item) => item['@_media-type'] === 'application/x-dtbncx+xml');
  if (ncxItem?.['@_href']) {
    const ncxPath = resolveRelative(opfPath, ncxItem['@_href']);
    const ncxFile = findZipFile(files, ncxPath);
    if (ncxFile) {
      const parsed = xml.parse(await ncxFile.async('string'))?.ncx?.navMap;
      asArray(parsed?.navPoint).forEach((point) => walkNcxPoints(point, ncxPath, titles));
    }
  }
  return titles;
}

export async function parseEpub(data: ArrayBuffer, fallbackTitle: string): Promise<ParsedBook> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new Error('EPUB 文件损坏或不是有效的 EPUB 文件');
  }
  const files = buildZipIndex(zip);
  const encryptionFile = findZipFile(files, 'META-INF/encryption.xml');
  if (encryptionFile) assertReadableEncryption(await encryptionFile.async('string'));

  const containerFile = findZipFile(files, 'META-INF/container.xml');
  if (!containerFile) throw new Error('EPUB 缺少 META-INF/container.xml');

  const container = xml.parse(await containerFile.async('string'));
  const rootfiles = asArray<Record<string, string>>(container?.container?.rootfiles?.rootfile);
  const rootfile = rootfiles.find((item) => item['@_media-type'] === 'application/oebps-package+xml') ?? rootfiles[0];
  const opfPath = rootfile?.['@_full-path'];
  if (!opfPath || typeof opfPath !== 'string') throw new Error('无法找到 EPUB 内容清单');

  const normalizedOpfPath = normalizeArchivePath(opfPath);
  const opfFile = findZipFile(files, normalizedOpfPath);
  if (!opfFile) throw new Error('EPUB 内容清单损坏');
  const opf = xml.parse(await opfFile.async('string'))?.package as Record<string, any> | undefined;
  if (!opf) throw new Error('无法解析 EPUB 内容清单');

  const manifestItems = asArray<Record<string, string>>(opf.manifest?.item);
  const manifest = new Map<string, Record<string, string>>();
  manifestItems.forEach((item) => {
    const id = item['@_id'];
    if (id) manifest.set(id, item);
  });
  const tocTitles = await readTocTitles(opf, normalizedOpfPath, manifestItems, files);
  const spineItems = asArray<Record<string, string>>(opf.spine?.itemref);
  const orderedItems = spineItems
    .map((spine) => manifest.get(spine['@_idref']))
    .filter((item): item is Record<string, string> => Boolean(item));
  const fallbackItems = manifestItems.filter((item) => /^(application\/xhtml\+xml|text\/html)$/i.test(item['@_media-type'] ?? ''));
  const candidates = [...orderedItems, ...fallbackItems];

  const chapters: ParsedBook['chapters'] = [];
  const seenPaths = new Set<string>();
  let extractedCharacters = 0;

  for (const item of candidates) {
    const href = item['@_href'];
    if (!href || item['@_properties']?.split(/\s+/).includes('nav')) continue;
    const chapterPath = resolveRelative(normalizedOpfPath, href);
    const pathKey = chapterPath.toLowerCase();
    if (seenPaths.has(pathKey)) continue;
    seenPaths.add(pathKey);
    const chapterFile = findZipFile(files, chapterPath);
    if (!chapterFile) continue;
    const source = await chapterFile.async('string');
    extractedCharacters += source.length;
    if (extractedCharacters > MAX_EXTRACTED_CHARACTERS) {
      throw new Error('EPUB 解压后的正文过大，请按卷拆分后再导入');
    }
    const parsed = htmlToParagraphs(source);
    const wordCount = countWords(parsed.paragraphs.join(' '));
    if (wordCount < 3) continue;
    chapters.push({
      title: tocTitles.get(pathKey) || parsed.title || `第 ${chapters.length + 1} 章`,
      paragraphs: parsed.paragraphs,
      wordCount,
    });
  }

  if (!chapters.length) throw new Error('这本 EPUB 没有可读取的文字章节');

  const metadata = opf.metadata ?? {};
  const title = firstStringValue(metadata.title) || fallbackTitle;
  const author = firstStringValue(metadata.creator) || '未知作者';
  return { title, author, chapters, format: 'epub' };
}
