import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import type { ParsedBook } from '../types';
import { cleanFileName, splitPlainText } from '../utils/text';
import { parseEpub } from './epub';
import { inspectKindleFile, parseKindle } from './mobi';
import { parsePdf } from './pdf';
import type { PdfImportOptions } from './pdfTypes';

const kindleMimeTypes = new Set([
  'application/x-mobipocket-ebook',
  'application/vnd.amazon.ebook',
  'application/x-mobi8-ebook',
  'application/vnd.amazon.mobi8-ebook',
  'application/x-kindle-ebook',
  'application/x-kf8',
  'application/azw3',
  'application/octet-stream',
]);

function safeDecodeFileName(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function pickAndParseBook(pdfOptions: PdfImportOptions & { isCancelled?: () => boolean }): Promise<ParsedBook | null> {
  const result = await DocumentPicker.getDocumentAsync({
    // Android file providers do not agree on AZW3/KF8 MIME types. Pick broadly
    // and validate the extension plus BOOKMOBI signature inside the app.
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled) return null;
  const asset = result.assets[0];
  const decodedUriName = safeDecodeFileName(asset.uri.split(/[\\/]/).pop() || '');
  const fileName = asset.name || decodedUriName || '未命名书籍';
  const fallbackTitle = cleanFileName(fileName);
  const extension = (fileName.split('.').pop() || '').toLowerCase();
  const webFile = Platform.OS === 'web' ? asset.file : undefined;
  const knownExtension = ['txt', 'epub', 'mobi', 'azw3', 'kf8', 'pdf'].includes(extension);
  pdfOptions.onImportStage?.('reading');

  if (asset.size && asset.size > 80 * 1024 * 1024) {
    throw new Error('文件超过 80 MB。为避免手机内存不足，请导入更小的书籍文件');
  }

  if (extension === 'txt' || (!knownExtension && asset.mimeType === 'text/plain')) {
    if (asset.size && asset.size > 25 * 1024 * 1024) {
      throw new Error('TXT 文件超过 25 MB。建议按卷拆分后再导入');
    }
    const text = webFile ? await webFile.text() : await new File(asset.uri).text();
    if (pdfOptions.isCancelled?.()) return null;
    if (!text.trim()) throw new Error('TXT 文件内容为空');
    if (text.includes('\uFFFD')) {
      throw new Error('TXT 编码无法识别，请将文件转换为 UTF-8 后重试');
    }
    pdfOptions.onImportStage?.('parsing');
    const chapters = splitPlainText(text, fallbackTitle);
    if (!chapters.length) throw new Error('没有从 TXT 中识别到可阅读内容');
    return { title: fallbackTitle, author: '本地导入', chapters, format: 'txt' };
  }

  if (extension === 'epub' || (!knownExtension && asset.mimeType === 'application/epub+zip')) {
    const data = webFile ? await webFile.arrayBuffer() : await new File(asset.uri).arrayBuffer();
    if (pdfOptions.isCancelled?.()) return null;
    pdfOptions.onImportStage?.('parsing');
    return parseEpub(data, fallbackTitle);
  }

  if (extension === 'azw3' || extension === 'kf8' || extension === 'mobi' || (!knownExtension && kindleMimeTypes.has(asset.mimeType || ''))) {
    const data = webFile ? await webFile.arrayBuffer() : await new File(asset.uri).arrayBuffer();
    if (pdfOptions.isCancelled?.()) return null;
    pdfOptions.onImportStage?.('parsing');
    const inspection = inspectKindleFile(data);
    if (!inspection.isKindle && !['mobi', 'azw3', 'kf8'].includes(extension)) {
      throw new Error('文件扩展名和内容均无法识别。请选择 TXT、EPUB、MOBI、AZW3、KF8 或 PDF 文件');
    }
    const format = extension === 'azw3' || extension === 'kf8'
      ? extension
      : inspection.likelyKf8 ? 'azw3' : 'mobi';
    return parseKindle(data, fallbackTitle, format);
  }

  if (extension === 'pdf' || (!knownExtension && asset.mimeType === 'application/pdf')) {
    if (pdfOptions.isCancelled?.()) return null;
    pdfOptions.onImportStage?.('parsing');
    return parsePdf(asset.uri, fallbackTitle, pdfOptions);
  }

  throw new Error('目前支持 TXT、EPUB、无 DRM 的 MOBI/AZW3/KF8，以及数字文本型或英文扫描版 PDF 文件');
}
