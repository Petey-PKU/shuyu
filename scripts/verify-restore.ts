import assert from 'node:assert/strict';
import type { BackupPayload, BookContent } from '../src/types';
import { recoverInterruptedRestore, restoreBackupSnapshot, type RestoreStorage } from '../src/utils/backupRestore';
import { libraryKeys as keys } from '../src/utils/storageKeys';

const payload: BackupPayload = {
  app: 'shuyu', schemaVersion: 1, exportedAt: '2026-09-10T00:00:00Z',
  books: [{ id: 'book_1', title: 'Restored story', author: 'Reader', format: 'txt', createdAt: '2026-09-09T00:00:00Z', lastOpenedAt: '2026-09-09T00:00:00Z', currentChapter: 0, currentParagraph: 0, progress: 0, totalWords: 2, chapterCount: 1, accent: '#333' }],
  contents: { book_1: { id: 'book_1', title: 'Restored story', chapters: [{ id: 'chapter_1', title: 'Start', paragraphs: ['Restored words.'], wordCount: 2 }] } },
  words: [{ id: 'word_1', word: 'restored', meaning: '恢复', context: 'Restored words.', bookId: 'book_1', bookTitle: 'Restored story', createdAt: '2026-09-09T00:00:00Z', mastered: false, reviewCount: 0 }],
  stats: { minutes: 3, words: 4, todayMinutes: 3, todayWords: 4, streak: 1 },
  preferences: { fontSize: 19, lineHeight: 32, dailyGoalMinutes: 15, theme: 'paper', onlineSentenceTranslation: true },
  recommendationState: { preferredGenres: [], savedBookIds: ['catalog_1'], feedback: { catalog_1: 'right' } },
  readingSignals: [{ bookId: 'book_1', lookups: 1, wordsRead: 2, minutes: 1 }],
};
const originalBook = { ...payload.books[0], title: 'Original story' };
const originalContent: BookContent = { ...payload.contents.book_1, title: 'Original story', chapters: [{ id: 'old_chapter', title: 'Old', paragraphs: ['My original book remains untouched.'], wordCount: 5 }] };
const initialValues = new Map<string, string>([
  [keys.books, JSON.stringify([originalBook])], [keys.words, '[]'], [keys.sample, 'true'],
  [keys.stats, JSON.stringify({ ...payload.stats, minutes: 99 })],
]);

function memoryStorage() {
  const values = new Map(initialValues);
  const contents = new Map<string, BookContent>([['book_1', structuredClone(originalContent)]]);
  let nextId = 0;
  let hook = (_operation: string) => {};
  const trace: string[] = [];
  const before = (operation: string) => { trace.push(operation); hook(operation); };
  const storage: RestoreStorage = {
    getItem: async (key) => { before(`get:${key}`); return values.get(key) ?? null; },
    setItem: async (key, value) => { before(`set:${key}`); values.set(key, value); },
    removeItem: async (key) => { before(`remove:${key}`); values.delete(key); },
    contentExists: async (id) => { before(`exists:${id}`); return contents.has(id); },
    writeNewContent: async (id, content) => {
      before(`write:${id}`);
      assert.ok(!contents.has(id), 'Restore must never overwrite an existing content file');
      contents.set(id, structuredClone(content));
    },
    removeContent: async (id) => { before(`delete:${id}`); contents.delete(id); },
    makeBookId: () => `restored_${++nextId}`,
  };
  return { storage, values, contents, trace, setHook: (next: typeof hook) => { hook = next; } };
}

async function main() {
  const successful = memoryStorage();
  const restored = await restoreBackupSnapshot(payload, successful.storage);
  assert.notEqual(restored.books[0].id, originalBook.id);
  assert.equal(restored.words[0].bookId, restored.books[0].id);
  assert.equal(restored.readingSignals[0].bookId, restored.books[0].id);
  assert.deepEqual(restored.recommendationState, payload.recommendationState, 'Catalog IDs are not local book file IDs');
  assert.equal(successful.values.get(keys.books), JSON.stringify(restored.books));
  assert.equal(successful.values.has(keys.restoreJournal), false);
  assert.equal(successful.contents.has('book_1'), false);
  assert.deepEqual(successful.contents.get(restored.books[0].id)?.chapters[0].paragraphs, ['Restored words.']);
  assert.equal(payload.books[0].id, 'book_1', 'Restore must not mutate the caller backup');
  const commitStep = successful.trace.indexOf(`remove:${keys.restoreJournal}`);

  // Simulate a process stopping at each storage boundary, then reconstruct the startup adapter.
  for (let stopAt = 0; stopAt < successful.trace.length; stopAt++) {
    const test = memoryStorage();
    let poweredOff = false;
    test.setHook(() => {
      if (test.trace.length - 1 === stopAt) poweredOff = true;
      if (poweredOff) throw new Error('Simulated process stopped');
    });
    await restoreBackupSnapshot(payload, test.storage).catch(() => undefined);
    test.setHook(() => {});
    await recoverInterruptedRestore(test.storage);
    assert.equal(test.values.has(keys.restoreJournal), false, `Journal at boundary ${stopAt}`);
    if (stopAt <= commitStep) {
      assert.deepEqual(test.values, initialValues, `Old metadata must survive boundary ${stopAt}`);
      assert.deepEqual(test.contents.get('book_1'), originalContent, `Original body at boundary ${stopAt}`);
    } else {
      const books = JSON.parse(test.values.get(keys.books)!);
      assert.equal(books[0].title, 'Restored story');
      assert.ok(test.contents.has(books[0].id), 'Committed metadata always has its content');
    }
  }

  const failedWrite = memoryStorage();
  let failOnce = true;
  failedWrite.setHook((operation) => {
    if (failOnce && operation === `set:${keys.preferences}`) { failOnce = false; throw new Error('Disk full'); }
  });
  await assert.rejects(() => restoreBackupSnapshot(payload, failedWrite.storage), /已保留原书架/);
  assert.deepEqual(failedWrite.values, initialValues);
  assert.deepEqual(failedWrite.contents.get('book_1'), originalContent);
  assert.equal(failedWrite.contents.size, 1, 'Failed staging content is cleaned up');

  const collision = memoryStorage();
  collision.contents.set('restored_1', originalContent);
  const afterCollision = await restoreBackupSnapshot(payload, collision.storage);
  assert.equal(afterCollision.books[0].id, 'restored_2');
  assert.deepEqual(collision.contents.get('restored_1'), originalContent);

  const empty = memoryStorage();
  await restoreBackupSnapshot({ ...payload, books: [], contents: {}, words: [], readingSignals: [] }, empty.storage);
  assert.equal(empty.values.get(keys.books), '[]');
  assert.equal(empty.values.get(keys.sample), 'restored-backup', 'A deliberately empty backup must stay empty');

  console.log(`Backup restore passed: same-ID replacement, reference remapping, ${successful.trace.length} interruption boundaries, write failure, collision and empty backup.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
