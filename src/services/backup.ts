import { Directory, File } from 'expo-file-system';
import { Platform } from 'react-native';
import type { BackupPayload } from '../types';
import { parseBackupPayload } from '../utils/backup';

export async function writeBackupFile(payload: BackupPayload) {
  if (Platform.OS === 'web') throw new Error('Web 预览暂不支持选择本地备份目录，请使用正式 Android 安装包');
  let directory: Directory;
  try { directory = await Directory.pickDirectoryAsync(); }
  catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === 'ERR_PICKER_CANCELLED' || code === 'ERR_FILE_PICKING_CANCELLED') return null;
    throw error;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const suffix = Math.random().toString(36).slice(2, 8);
  const file = directory.createFile(`shuyu-backup-${stamp}-${suffix}.json`, 'application/json');
  try {
    file.write(JSON.stringify(payload));
    if (file.size > 140_000_000) throw new Error('备份超过本机恢复支持的大小，请减少书籍后重试');
  } catch (error) {
    try { if (file.exists) file.delete(); } catch { /* Keep the original write error. */ }
    throw error;
  }
  return file.name;
}

export async function pickBackupFile() {
  if (Platform.OS === 'web') throw new Error('Web 预览暂不支持恢复本地备份，请使用正式 Android 安装包');
  const picked = await (async () => {
    try {
      return await File.pickFileAsync({ mimeTypes: ['application/json', 'text/json'] });
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === 'ERR_PICKER_CANCELLED' || code === 'ERR_FILE_PICKING_CANCELLED') return null;
      throw error;
    }
  })();
  if (!picked) return null;
  if (picked.canceled || !picked.result) return null;
  if (picked.result.size > 140_000_000) throw new Error('备份文件过大，无法在本机安全读取');
  return parseBackupPayload(await picked.result.text());
}
