/** Convert native/local content failures into short recovery guidance. */
export function formatContentReadFailure(error: unknown, fallback = '本地正文暂时无法读取，请重试。若仍无法打开，可从原文件重新导入或在设置中恢复备份。'): string {
  const message = error instanceof Error ? error.message.trim() : '';
  if (/not found|enoent|does not exist|missing/i.test(message)) return '本地书籍正文不存在，请从原文件重新导入，或在设置中恢复备份。';
  if (/permission|access denied|not permitted|eacces/i.test(message)) return '无法访问本地书籍正文，请检查设备存储权限后重试。';
  if (message && /[\u4e00-\u9fff]/.test(message)) return message;
  return fallback;
}
