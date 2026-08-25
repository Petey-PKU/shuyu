import {
  NativeModule,
  requireOptionalNativeModule,
  type EventSubscription,
} from 'expo-modules-core';

export interface PdfOcrProgress {
  jobId: string;
  currentPage: number;
  totalPages: number;
  skippedPages: number;
  cancelling: boolean;
}

export interface PdfOcrResult {
  text: string;
  pageCount: number;
  processedPages: number;
  skippedPages: number;
  cancelled: boolean;
}

type PdfOcrEvents = {
  onPdfOcrProgress: (event: PdfOcrProgress) => void;
};

declare class PdfOcrNativeModule extends NativeModule<PdfOcrEvents> {
  isAvailable(): boolean;
  recognizePdf(filePath: string, jobId: string): Promise<PdfOcrResult>;
  cancel(jobId: string): boolean;
}

const PdfOcr = requireOptionalNativeModule<PdfOcrNativeModule>('ShuyuPdfOcr');

export function isPdfOcrAvailable() {
  try {
    return PdfOcr?.isAvailable() ?? false;
  } catch {
    return false;
  }
}

export async function recognizePdf(
  filePath: string,
  jobId: string,
  onProgress: (progress: PdfOcrProgress) => void,
) {
  if (!PdfOcr) throw new Error('当前安装包未包含扫描版 PDF OCR 模块');
  const subscription: EventSubscription = PdfOcr.addListener('onPdfOcrProgress', (event) => {
    if (event.jobId === jobId) onProgress(event);
  });
  try {
    return await PdfOcr.recognizePdf(filePath, jobId);
  } finally {
    subscription.remove();
  }
}

export function cancelPdfOcr(jobId: string) {
  return PdfOcr?.cancel(jobId) ?? false;
}
