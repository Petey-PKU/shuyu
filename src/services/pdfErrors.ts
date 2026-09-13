/** Convert native PDF failures into short, actionable user-facing messages. */
export function formatPdfExtractionError(errorCode?: string): string {
  switch (errorCode) {
    case 'PASSWORD_REQUIRED':
    case 'INCORRECT_PASSWORD':
      return '暂不支持需要密码的 PDF';
    case 'FILE_NOT_FOUND':
    case 'PDF_LOAD_ERROR':
      return '无法读取 PDF 文件，文件可能已移动或访问权限已失效。请重新选择后重试';
    case 'CORRUPT_PDF':
      return 'PDF 文件损坏或格式不受支持';
    default:
      return '无法读取 PDF 正文。请确认文件仍可访问且未被其他应用占用，然后重试';
  }
}
