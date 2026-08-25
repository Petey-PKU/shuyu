export interface PdfOcrProgress {
  currentPage: number;
  totalPages: number;
  skippedPages: number;
  cancelling?: boolean;
}

export interface PdfImportOptions {
  confirmOcr: (pageCount: number) => Promise<boolean>;
  onOcrProgress: (progress: PdfOcrProgress) => void;
  registerOcrCancel: (cancel: (() => void) | null) => void;
}
