import type { ImportStatus } from '../types';
import type { PdfOcrProgress } from '../services/pdfTypes';

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
