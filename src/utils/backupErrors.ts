export function formatBackupOperationError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message.trim() : '';
  if (/no space|disk full|quota|storage.*full/i.test(message)) return '设备存储空间可能不足，请清理空间后重试';
  if (/permission|access denied|not permitted|eacces/i.test(message)) return '设备暂时不允许访问文件，请检查存储权限后重试';
  if (/not found|enoent|does not exist|cannot open/i.test(message)) return '备份文件或目录已不可用，请重新选择后重试';
  if (message && /[\u4e00-\u9fff]/.test(message)) return message;
  return fallback;
}
