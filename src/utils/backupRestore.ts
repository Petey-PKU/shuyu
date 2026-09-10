import type { BackupPayload, Book, BookContent } from '../types';
import { libraryKeys as keys } from './storageKeys';
import { isSafeBookId, validateBackupPayload } from './backup';

const metadataKeys = [keys.books, keys.words, keys.stats, keys.preferences, keys.recommendations, keys.readingSignals, keys.sample];
type StorageEntry = [string, string | null];

export interface RestoreStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  contentExists: (id: string) => Promise<boolean>;
  writeNewContent: (id: string, content: BookContent) => Promise<void>;
  removeContent: (id: string) => Promise<void>;
  makeBookId: () => string;
}

interface RestoreJournal {
  version: 1;
  previous: StorageEntry[];
  stagedIds: string[];
}

function parseJournal(raw: string): RestoreJournal {
  const value = JSON.parse(raw) as Partial<RestoreJournal>;
  if (!value || value.version !== 1 || !Array.isArray(value.previous) || !Array.isArray(value.stagedIds)
    || value.previous.length !== metadataKeys.length
    || value.previous.some((entry, index) => !Array.isArray(entry) || entry.length !== 2
      || entry[0] !== metadataKeys[index] || (entry[1] !== null && typeof entry[1] !== 'string'))
    || !value.stagedIds.every(isSafeBookId) || new Set(value.stagedIds).size !== value.stagedIds.length) {
    throw new Error('恢复日志无法读取，原有正文仍保留在设备中');
  }
  const previousBooks = JSON.parse(value.previous[0][1] ?? '[]') as Book[];
  if (!Array.isArray(previousBooks) || previousBooks.some((book) => value.stagedIds!.includes(book.id))) {
    throw new Error('恢复日志与原书架不匹配');
  }
  return value as RestoreJournal;
}

/** Run before loading the app. The journal remains until every old metadata key is restored. */
export async function recoverInterruptedRestore(storage: RestoreStorage): Promise<void> {
  const raw = await storage.getItem(keys.restoreJournal);
  if (!raw) return;
  const journal = parseJournal(raw);
  for (const [key, value] of journal.previous) {
    if (value === null) await storage.removeItem(key);
    else await storage.setItem(key, value);
  }
  await storage.removeItem(keys.restoreJournal);
  // Cleanup failure must not hide the recovered library. Staged files are never referenced by it.
  await Promise.allSettled(journal.stagedIds.map((id) => storage.removeContent(id)));
}

/** Restore with new file IDs: no existing book content is ever opened for writing. */
export async function restoreBackupSnapshot(payload: BackupPayload, storage: RestoreStorage): Promise<BackupPayload> {
  validateBackupPayload(payload);
  await recoverInterruptedRestore(storage);
  const previous: StorageEntry[] = [];
  for (const key of metadataKeys) previous.push([key, await storage.getItem(key)]);
  const oldBooks = JSON.parse(previous[0][1] ?? '[]') as Book[];
  if (!Array.isArray(oldBooks) || oldBooks.some((book) => !book || !isSafeBookId(book.id))) {
    throw new Error('原书架索引无法读取，恢复尚未开始');
  }
  const usedIds = new Set([...oldBooks, ...payload.books].map((book) => book.id));
  const ids = new Map<string, string>();
  for (const book of payload.books) {
    let freshId: string | undefined;
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = storage.makeBookId();
      if (isSafeBookId(candidate) && !usedIds.has(candidate) && !(await storage.contentExists(candidate))) {
        freshId = candidate;
        break;
      }
    }
    if (!freshId) throw new Error('暂时无法创建恢复副本，请重试');
    usedIds.add(freshId);
    ids.set(book.id, freshId);
  }
  const books = payload.books.map((book) => ({ ...book, id: ids.get(book.id)! }));
  const contents = Object.fromEntries(payload.books.map((book) => {
    const id = ids.get(book.id)!;
    return [id, { ...payload.contents[book.id], id,
      chapters: payload.contents[book.id].chapters.map((chapter, index) => ({ ...chapter, id: `${id}_chapter_${index}` })),
    }];
  }));
  const restored: BackupPayload = { ...payload, books, contents,
    words: payload.words.map((word) => ({ ...word, bookId: ids.get(word.bookId)! })),
    readingSignals: payload.readingSignals.map((signal) => ({ ...signal, bookId: ids.get(signal.bookId)! })),
  };
  const next: [string, string][] = [
    [keys.books, JSON.stringify(restored.books)], [keys.words, JSON.stringify(restored.words)],
    [keys.stats, JSON.stringify(restored.stats)], [keys.preferences, JSON.stringify(restored.preferences)],
    [keys.recommendations, JSON.stringify(restored.recommendationState)],
    [keys.readingSignals, JSON.stringify(restored.readingSignals)], [keys.sample, 'restored-backup'],
  ];
  const journal: RestoreJournal = { version: 1, previous, stagedIds: books.map((book) => book.id) };
  // Persist the rollback plan before any content or metadata is changed.
  await storage.setItem(keys.restoreJournal, JSON.stringify(journal));
  let metadataWritten = false;
  try {
    for (const book of books) await storage.writeNewContent(book.id, contents[book.id]);
    for (const [key, value] of next) await storage.setItem(key, value);
    metadataWritten = true;
    // Removing the journal is the commit point. Until then startup restores the old library.
    await storage.removeItem(keys.restoreJournal);
  } catch {
    // A removal may have succeeded before its acknowledgement failed.
    if (!(metadataWritten && await storage.getItem(keys.restoreJournal) === null)) {
      try { await recoverInterruptedRestore(storage); }
      catch { throw new Error('恢复中断，原有正文仍保留。请重新读取本地数据以完成恢复。'); }
      throw new Error('恢复未完成，已保留原书架与学习记录。请检查可用空间后重试。');
    }
  }
  await Promise.allSettled(oldBooks.map((book) => storage.removeContent(book.id)));
  return restored;
}
