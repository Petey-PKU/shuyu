/** Serialize local writes so a slower older snapshot cannot finish after a newer one. */
export function createSerialWriteQueue() {
  let tail: Promise<void> = Promise.resolve();

  const enqueue = <T>(write: () => Promise<T>): Promise<T> => {
    const run = tail.then(write, write);
    tail = run.then(() => undefined, () => undefined);
    return run;
  };

  return {
    enqueue,
    waitForIdle: () => tail,
  };
}
