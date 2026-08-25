import { extractTextWithInfo, isAvailable } from 'expo-pdf-text-extract';
import type { ParsedBook } from '../types';
import {
  cancelPdfOcr,
  isPdfOcrAvailable,
  recognizePdf,
} from '../../modules/shuyu-pdf-ocr';
import { parseExtractedPdfText, pdfNeedsOcr } from './pdfText';
import type { PdfImportOptions } from './pdfTypes';

function makeOcrJobId() {
  return `pdf-ocr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function parsePdf(
  uri: string,
  fallbackTitle: string,
  options: PdfImportOptions,
): Promise<ParsedBook | null> {
  if (!isAvailable()) throw new Error('当前安装包未包含 PDF 文本解析模块，请安装最新测试 APK');
  const result = await extractTextWithInfo(uri);
  if (!result.success) {
    if (result.passwordRequired) throw new Error('暂不支持需要密码的 PDF');
    throw new Error(result.errorCode === 'CORRUPT_PDF' ? 'PDF 文件损坏或格式不受支持' : result.error || '无法读取 PDF 正文');
  }
  if (!pdfNeedsOcr(result.text, result.pageCount)) {
    return parseExtractedPdfText(result.text, fallbackTitle);
  }

  if (!isPdfOcrAvailable()) {
    throw new Error('扫描版 PDF 的离线 OCR 当前仅支持 Android 正式安装包，请安装最新测试 APK');
  }

  const confirmed = await options.confirmOcr(result.pageCount);
  if (!confirmed) return null;

  const jobId = makeOcrJobId();
  let cancelRequested = false;
  options.onOcrProgress({ currentPage: 0, totalPages: result.pageCount, skippedPages: 0 });
  options.registerOcrCancel(() => {
    cancelRequested = true;
    cancelPdfOcr(jobId);
  });

  try {
    const ocr = await recognizePdf(uri, jobId, ({ currentPage, totalPages, skippedPages, cancelling }) => {
      options.onOcrProgress({ currentPage, totalPages, skippedPages, cancelling });
    });
    if (cancelRequested || ocr.cancelled) return null;
    if (pdfNeedsOcr(ocr.text, ocr.pageCount)) {
      throw new Error('OCR 没有识别到足够的英文正文；请确认扫描清晰、方向正确且主要内容为英文');
    }
    return parseExtractedPdfText(ocr.text, fallbackTitle);
  } finally {
    options.registerOcrCancel(null);
  }
}
