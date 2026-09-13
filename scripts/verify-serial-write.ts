import assert from 'node:assert/strict';
import { createSerialWriteQueue } from '../src/utils/serialWrite';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function main() {
  const queue = createSerialWriteQueue();
  const first = deferred<void>();
  const order: string[] = [];
  const firstWrite = queue.enqueue(async () => { order.push('first-start'); await first.promise; order.push('first-end'); });
  const secondWrite = queue.enqueue(async () => { order.push('second'); });
  await Promise.resolve();
  assert.deepEqual(order, ['first-start'], 'The second snapshot waits for the first write');
  first.resolve();
  await Promise.all([firstWrite, secondWrite]);
  assert.deepEqual(order, ['first-start', 'first-end', 'second'], 'Writes finish in enqueue order');

  const failed = queue.enqueue(async () => { throw new Error('disk full'); });
  await assert.rejects(failed);
  const afterFailure = queue.enqueue(async () => { order.push('after-failure'); });
  await afterFailure;
  assert.equal(order.at(-1), 'after-failure', 'A failed write does not permanently block later snapshots');
  await queue.waitForIdle();
  console.log('Serial writes passed: snapshots stay ordered and recover after a failed write.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
