import assert from 'node:assert/strict';
import { formatImportFailure } from '../src/utils/importErrors';
import { importStageDescription, mergeOcrImportStatus } from '../src/utils/importStatus';

assert.equal(formatImportFailure(new Error('EACCES: permission denied')), '无法访问所选文件，请检查存储权限后重试');
assert.equal(formatImportFailure(new Error('ENOSPC: no space left on device')), '设备存储空间可能不足，请清理空间后重试');
assert.equal(formatImportFailure(new Error('ENOENT: file not found')), '所选文件已不可用，请重新选择后重试');
assert.equal(formatImportFailure(new Error('unexpected provider failure')), '请确认文件格式和访问权限后重试');
assert.equal(formatImportFailure(new Error('文件格式不受支持')), '文件格式不受支持');
const ocrStatus = mergeOcrImportStatus(
  { phase: 'parsing', stage: 'parsing', fileName: '扫描版-第一章.pdf', startedAt: 1200 },
  { currentPage: 3, totalPages: 18, skippedPages: 1 },
  9000,
);
assert.deepEqual(ocrStatus, {
  phase: 'ocr', fileName: '扫描版-第一章.pdf', startedAt: 1200,
  currentPage: 3, totalPages: 18, skippedPages: 1, cancelling: false,
}, 'OCR progress keeps the selected filename and original elapsed-time baseline');
const cancellingStatus = mergeOcrImportStatus(ocrStatus, {
  currentPage: 4, totalPages: 18, skippedPages: 1, cancelling: true,
}, 9000);
assert.equal(cancellingStatus.cancelling, true, 'Cancellation stays visible during OCR progress updates');
assert.equal(importStageDescription('reading'), '正在读取文件，之后会提取章节。');
assert.equal(importStageDescription('parsing'), '正在提取章节并整理排版。');
assert.equal(importStageDescription('saving'), '正在安全保存正文，完成后会自动打开。');
assert.equal(importStageDescription('parsing', true), '正在安全停止，已读取的内容不会加入书架。');
console.log('Import failure and picker cancellation verification passed.');
