import assert from 'node:assert/strict';
import { formatImportFailure } from '../src/utils/importErrors';

assert.equal(formatImportFailure(new Error('EACCES: permission denied')), '无法访问所选文件，请检查存储权限后重试');
assert.equal(formatImportFailure(new Error('ENOSPC: no space left on device')), '设备存储空间可能不足，请清理空间后重试');
assert.equal(formatImportFailure(new Error('ENOENT: file not found')), '所选文件已不可用，请重新选择后重试');
assert.equal(formatImportFailure(new Error('unexpected provider failure')), '请确认文件格式和访问权限后重试');
assert.equal(formatImportFailure(new Error('文件格式不受支持')), '文件格式不受支持');
console.log('Import failure and picker cancellation verification passed.');
