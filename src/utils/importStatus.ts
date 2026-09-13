import type { ImportStatus } from '../types';
import type { PdfOcrProgress } from '../services/pdfTypes';

export function importStageDescription(stage: ImportStatus['stage'], cancelling = false) {
  if (cancelling) return '正在安全停止，已读取的内容不会加入书架。';
  if (stage === 'selecting') return '请选择文件；选择后会在设备上读取和解析。';
  if (stage === 'reading') return '正在读取文件，之后会提取章节。';
  if (stage === 'saving') return '正在安全保存正文，完成后会自动打开。';
  return '正在提取章节并整理排版。';
}

/** Keep the user's selected file visible while native OCR reports progress. */
export function mergeOcrImportStatus(
  current: ImportStatus | null,
  progress: PdfOcrProgress,
  fallbackStartedAt: number,
): ImportStatus {
  return {
    phase: 'ocr',
    fileName: current?.fileName,
    startedAt: current?.startedAt ?? fallbackStartedAt,
    currentPage: progress.currentPage,
    totalPages: progress.totalPages,
    skippedPages: progress.skippedPages,
    cancelling: Boolean(current?.cancelling || progress.cancelling),
  };
}
