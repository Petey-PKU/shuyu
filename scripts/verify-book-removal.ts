import assert from 'node:assert/strict';
import { persistBookRemoval } from '../src/utils/bookRemoval';
import { createPersistenceTracker } from '../src/utils/persistence';
import type { Book, ReadingSignal, SavedWord } from '../src/types';

const book = (id: string): Book => ({
  id, title: id, author: 'Reader', format: 'txt', createdAt: '2026-09-12',
  lastOpenedAt: '2026-09-12', currentChapter: 0, currentParagraph: 0,
  progress: 0, totalWords: 10, chapterCount: 1, accent: '#333',
});
const oldWord: SavedWord = { id: 'word', word: 'quiet', meaning: '安静的', context: 'A quiet room.',
  bookId: 'deleted', bookTitle: 'deleted', createdAt: '2026-09-12', mastered: false, reviewCount: 0 };
const oldSignal: ReadingSignal = { bookId: 'deleted', lookups: 1, wordsRead: 10, minutes: 2 };

async function main() {
  for (const failingArea of ['books', 'words', 'readingSignals', 'content'] as const) {
    let failureEnabled = true;
    const disk = { books: [book('deleted'), book('kept')], words: [oldWord], readingSignals: [oldSignal] };
    let snapshot: typeof disk = { books: [book('kept')], words: [], readingSignals: [] };
    const contents = new Set(['deleted', 'kept', 'new']);
    let cleanupCalls = 0;
    const storage = {
      saveBooks: async (value: Book[]) => {
        if (failureEnabled && failingArea === 'books') throw new Error('books failed');
        disk.books = value;
      },
      saveWords: async (value: SavedWord[]) => {
        if (failureEnabled && failingArea === 'words') throw new Error('words failed');
        disk.words = value;
      },
      saveReadingSignals: async (value: ReadingSignal[]) => {
        if (failureEnabled && failingArea === 'readingSignals') throw new Error('signals failed');
        disk.readingSignals = value;
      },
      deleteBookContent: async (id: string) => {
        cleanupCalls += 1;
        assert.ok(!disk.books.some((item) => item.id === id), 'The persisted shelf must no longer reference the source');
        assert.ok(!disk.words.some((item) => item.bookId === id), 'Saved words must no longer reference the source');
        assert.ok(!disk.readingSignals.some((item) => item.bookId === id), 'Reading records must no longer reference the source');
        if (failureEnabled && failingArea === 'content') throw new Error('cleanup failed');
        contents.delete(id);
      },
    };
    let error: string | null = null;
    const tracker = createPersistenceTracker((state) => { error = state.error; });
    const writeRemoval = () => persistBookRemoval('deleted', snapshot, storage);
    await assert.rejects(tracker.persist('delete-book:deleted', '书籍删除', writeRemoval, writeRemoval));
    assert.ok(contents.has('deleted'), `${failingArea} failure must retain the original source`);
    assert.equal(cleanupCalls, failingArea === 'content' ? 1 : 0);
    assert.ok(error, 'Failed removal must remain retryable');

    // A later import or saved word must survive retrying the earlier failed deletion.
    const newWord = { ...oldWord, id: 'new-word', bookId: 'new', bookTitle: 'new' };
    snapshot = { books: [book('new'), book('kept')], words: [newWord], readingSignals: [] };
    failureEnabled = false;
    await tracker.retryAll();
    assert.equal(error, null);
    assert.deepEqual(disk, snapshot, 'Retry persists the latest library and learning records');
    assert.ok(!contents.has('deleted'));
    assert.ok(contents.has('kept') && contents.has('new'), 'Removal never touches other books');
  }

  let releaseWords!: () => void;
  const wordsGate = new Promise<void>((resolve) => { releaseWords = resolve; });
  let completed = false;
  let removed = false;
  const pendingRemoval = persistBookRemoval('deleted', { books: [], words: [], readingSignals: [] }, {
    saveBooks: async () => { throw new Error('disk full'); },
    saveWords: () => wordsGate,
    saveReadingSignals: async () => undefined,
    deleteBookContent: async () => { removed = true; },
  }).catch(() => { completed = true; });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(completed, false, 'Replacement/reset must be able to drain every in-flight index write');
  releaseWords();
  await pendingRemoval;
  assert.equal(completed, true);
  assert.equal(removed, false);

  console.log('Book removal passed: metadata failure retains source, cleanup retries preserve newer data, and all writes settle before replacement.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
