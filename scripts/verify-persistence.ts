import assert from 'node:assert/strict';
import { createPersistenceTracker, formatPersistenceFailure, type PersistenceState } from '../src/utils/persistence';

const fail = async () => { throw new Error('disk full'); };
const succeed = async () => undefined;
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture() {
  let state: PersistenceState = { error: null, retrying: false };
  const tracker = createPersistenceTracker((next) => { state = next; });
  return { tracker, state: () => state };
}

async function main() {
  const { tracker, state } = fixture();
  const saved: string[] = [];
  let failWords = true;
  await assert.rejects(tracker.persist('books', '书架', fail, async () => { saved.push('books'); }));
  await assert.rejects(tracker.persist('words', '生词', fail, async () => {
    if (failWords) throw new Error('still full');
    saved.push('words');
  }));
  await assert.rejects(tracker.persist('preferences', '阅读设置', fail, async () => { saved.push('preferences'); }));
  assert.match(state().error ?? '', /书架、生词、阅读设置/, 'Show every affected area');
  await tracker.retryAll();
  assert.deepEqual(saved, ['books', 'preferences'], 'One retry failure must not prevent other areas from saving');
  assert.equal(state().error, '生词尚未保存：设备暂时无法写入，请稍后重试', 'Keep and update only the remaining failure');
  failWords = false;
  await tracker.retryAll();
  assert.deepEqual(saved, ['books', 'preferences', 'words']);
  assert.equal(state().error, null);
  assert.equal(state().retrying, false);

  // Distinct book cleanups share a display label but must retain both callbacks.
  const removed: string[] = [];
  for (const id of ['one', 'two']) {
    await assert.rejects(tracker.persist(`delete-book:${id}`, '书籍删除', fail, async () => { removed.push(id); }));
  }
  await tracker.retryAll();
  assert.deepEqual(removed, ['one', 'two']);

  let currentValue = 'old value';
  let storedValue = '';
  let retryCalls = 0;
  const saveGate = deferred();
  await assert.rejects(tracker.persist('words', '生词', fail, async () => {
    retryCalls += 1;
    storedValue = currentValue;
    await saveGate.promise;
  }));
  currentValue = 'latest in-memory value';
  const firstRetry = tracker.retryAll();
  assert.equal(tracker.retryAll(), firstRetry, 'Rapid repeated clicks join the same retry');
  assert.equal(state().retrying, true);
  await Promise.resolve();
  assert.equal(retryCalls, 1);
  assert.equal(storedValue, currentValue, 'Retry saves the latest snapshot');
  await assert.rejects(tracker.persist('books', '书架', fail, succeed));
  saveGate.resolve();
  await firstRetry;
  assert.equal(state().error, '书架尚未保存：设备存储空间可能不足，请清理空间后重试', 'A failure arriving during retry must remain visible');
  await tracker.retryAll();

  // A newer failure for the same key must survive an older retry finishing successfully.
  const oldRetry = deferred();
  await assert.rejects(tracker.persist('words', '生词', fail, () => oldRetry.promise));
  const retrying = tracker.retryAll();
  await Promise.resolve();
  await assert.rejects(tracker.persist('words', '生词', async () => { throw new Error('new failure'); }, succeed));
  oldRetry.resolve();
  await retrying;
  assert.equal(state().error, '生词尚未保存：设备暂时无法写入，请稍后重试');
  await tracker.retryAll();
  assert.equal(state().error, null);

  const oldWrite = deferred();
  const failedOldWrite = assert.rejects(tracker.persist('books', '书架', () => oldWrite.promise, fail));
  await tracker.persist('books', '阅读进度', succeed, succeed);
  oldWrite.reject(new Error('late failure'));
  await failedOldWrite;
  assert.equal(state().error, null, 'A late older failure cannot revive a task already saved by a newer write');

  const superseded = fixture();
  const supersededGate = deferred();
  await assert.rejects(superseded.tracker.persist('books', '书架', fail, () => supersededGate.promise));
  let obsoleteCleanupCalls = 0;
  await assert.rejects(superseded.tracker.persist('delete-book:old', '书籍删除', fail, async () => { obsoleteCleanupCalls += 1; }));
  const obsoleteRetry = superseded.tracker.retryAll();
  await Promise.resolve();
  superseded.tracker.clear();
  let idle = false;
  const drained = superseded.tracker.waitForIdle().then(() => { idle = true; });
  await Promise.resolve();
  assert.equal(idle, false, 'Replacing a library must wait for the active write');
  supersededGate.reject(new Error('old library failure'));
  await obsoleteRetry;
  await drained;
  assert.equal(idle, true);
  assert.equal(obsoleteCleanupCalls, 0, 'Invalidated retries cannot act on a replacement library');
  assert.equal(superseded.state().error, null);
  assert.equal(superseded.state().retrying, false);

  assert.equal(formatPersistenceFailure(new Error('SQLITE_BUSY: database is locked')), '设备暂时繁忙，请稍后重试');
  assert.equal(formatPersistenceFailure(new Error('permission denied')), '设备暂时不允许写入，请检查存储权限后重试');
  assert.equal(formatPersistenceFailure(new Error('业务数据校验失败')), '业务数据校验失败');

  console.log('Persistence retries passed: independent failures, partial success, fresh snapshots, rapid clicks, racing writes and library replacement.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
