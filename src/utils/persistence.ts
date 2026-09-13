export interface PersistenceState {
  error: string | null;
  retrying: boolean;
}

type Write = () => Promise<void>;
interface PendingWrite {
  area: string;
  error: unknown;
  retry: Write;
}

export function formatPersistenceFailure(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : '';
  if (/no space|disk full|quota|storage.*full/i.test(message)) return '设备存储空间可能不足，请清理空间后重试';
  if (/database is locked|sqlite_busy|busy/i.test(message)) return '设备暂时繁忙，请稍后重试';
  if (/permission|access denied|not permitted/i.test(message)) return '设备暂时不允许写入，请检查存储权限后重试';
  if (message && /[\u4e00-\u9fff]/.test(message)) return message;
  return '设备暂时无法写入，请稍后重试';
}

/** Keep independent failures until each write succeeds. Retries read the latest app snapshot. */
export function createPersistenceTracker(onChange: (state: PersistenceState) => void) {
  const pending = new Map<string, PendingWrite>();
  const settled = new Map<string, number>();
  const active = new Set<Promise<void>>();
  let revision = 0;
  let generation = 0;
  let retryRun: Promise<void> | null = null;

  const publish = () => {
    const failures = [...pending.values()];
    const areas = [...new Set(failures.map((failure) => failure.area))];
    const detail = failures.length === 1 ? formatPersistenceFailure(failures[0].error) : '';
    onChange({
      error: areas.length ? `${areas.join('、')}尚未保存${detail ? `：${detail}` : ''}` : null,
      retrying: retryRun !== null,
    });
  };

  const persist = (key: string, area: string, write: Write, retry: Write): Promise<void> => {
    const attempt = ++revision;
    const epoch = generation;
    const finish = (failure?: PendingWrite) => {
      // A delayed completion must not erase a newer failure or revive a replaced library's retry.
      if (epoch !== generation || attempt < (settled.get(key) ?? 0)) return;
      settled.set(key, attempt);
      if (failure) pending.set(key, failure);
      else pending.delete(key);
      publish();
    };
    const task = (async () => {
      try {
        await write();
        finish();
      } catch (error) {
        finish({ area, error, retry });
        throw error;
      }
    })();
    active.add(task);
    return task.finally(() => { active.delete(task); });
  };

  const retryAll = (): Promise<void> => {
    if (retryRun) return retryRun;
    if (!pending.size) return Promise.resolve();
    const epoch = generation;
    const failures = [...pending.entries()];
    // Defer execution so the synchronous lock is installed before callbacks publish state.
    retryRun = Promise.resolve().then(async () => {
      for (const [key, failure] of failures) {
        if (epoch !== generation) break;
        if (pending.get(key) !== failure) continue;
        try {
          await persist(key, failure.area, failure.retry, failure.retry);
        } catch {
          // Keep this failure, update its reason, and still try the other pending writes.
        }
      }
    }).finally(() => {
      retryRun = null;
      publish();
    });
    publish();
    return retryRun;
  };

  return {
    persist,
    retryAll,
    // Call after blocking new mutations, before resetting or replacing the on-disk snapshot.
    waitForIdle: async () => {
      while (active.size || retryRun) {
        await Promise.allSettled([...active, ...(retryRun ? [retryRun] : [])]);
      }
    },
    clear: () => {
      generation += 1;
      pending.clear();
      settled.clear();
      publish();
    },
  };
}
