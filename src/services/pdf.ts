import type { ParsedBook } from '../types';
import type { PdfImportOptions } from './pdfTypes';

export async function parsePdf(
  _uri: string,
  _fallbackTitle: string,
  _options: PdfImportOptions,
): Promise<ParsedBook | null> {
  throw new Error('Web 预览与 Expo Go 暂不支持 PDF 文本提取和 OCR，请使用正式 Android 安装包');
}
