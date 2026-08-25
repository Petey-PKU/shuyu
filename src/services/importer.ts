import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import type { ParsedBook } from '../types';
import { cleanFileName, splitPlainText } from '../utils/text';
import { parseEpub } from './epub';
import { parseKf8, parseMobi } from './mobi';
import { parsePdf } from './pdf';
import type { PdfImportOptions } from './pdfTypes';

const supportedMimeTypes = [
  'text/plain',
  'application/epub+zip',
  'application/x-mobipocket-ebook',
  'application/vnd.amazon.ebook',
  'application/x-mobi8-ebook',
  'application/vnd.amazon.mobi8-ebook',
  'application/pdf',
  'application/octet-stream',
];

export async function pickAndParseBook(pdfOptions: PdfImportOptions): Promise<ParsedBook | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: supportedMimeTypes,
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled) return null;
  const asset = result.assets[0];
  const fallbackTitle = cleanFileName(asset.name || '未命名书籍');
  const extension = (asset.name.split('.').pop() || '').toLowerCase();
  const webFile = Platform.OS === 'web' ? asset.file : undefined;

  if (asset.size && asset.size > 80 * 1024 * 1024) {
    throw new Error('文件超过 80 MB。为避免手机内存不足，请导入更小的书籍文件');
  }

  if (extension === 'txt' || asset.mimeType === 'text/plain') {
    if (asset.size && asset.size > 25 * 1024 * 1024) {
      throw new Error('TXT 文件超过 25 MB。建议按卷拆分后再导入');
    }
    const text = webFile ? await webFile.text() : await new File(asset.uri).text();
    if (!text.trim()) throw new Error('TXT 文件内容为空');
    if (text.includes('\uFFFD')) {
      throw new Error('TXT 编码无法识别，请将文件转换为 UTF-8 后重试');
    }
    const chapters = splitPlainText(text, fallbackTitle);
    if (!chapters.length) throw new Error('没有从 TXT 中识别到可阅读内容');
    return { title: fallbackTitle, author: '本地导入', chapters, format: 'txt' };
  }

  if (extension === 'epub' || asset.mimeType === 'application/epub+zip') {
    const data = webFile ? await webFile.arrayBuffer() : await new File(asset.uri).arrayBuffer();
    return parseEpub(data, fallbackTitle);
  }

  if (extension === 'azw3' || extension === 'kf8') {
    const data = webFile ? await webFile.arrayBuffer() : await new File(asset.uri).arrayBuffer();
    return parseKf8(data, fallbackTitle, extension);
  }

  if (extension === 'mobi' || asset.mimeType === 'application/x-mobipocket-ebook') {
    const data = webFile ? await webFile.arrayBuffer() : await new File(asset.uri).arrayBuffer();
    return parseMobi(data, fallbackTitle);
  }

  if (extension === 'pdf' || asset.mimeType === 'application/pdf') {
    return parsePdf(asset.uri, fallbackTitle, pdfOptions);
  }

  throw new Error('目前支持 TXT、EPUB、无 DRM 的 MOBI/AZW3/KF8，以及数字文本型或英文扫描版 PDF 文件');
}
