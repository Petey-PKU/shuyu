import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import type {
  Book,
  BookContent,
  ParsedBook,
  ReadingPreferences,
  ReadingSignal,
  ReadingStats,
  RecommendationState,
  SavedWord,
} from '../types';
import { bookAccents } from '../theme';

const KEYS = {
  books: '@shuzhongyu/books',
  words: '@shuzhongyu/words',
  stats: '@shuzhongyu/stats',
  preferences: '@shuzhongyu/preferences',
  recommendations: '@shuzhongyu/recommendations',
  readingSignals: '@shuzhongyu/reading-signals',
  sample: '@shuzhongyu/sample-seeded',
};

const LEGACY_KEYS = {
  books: '@luma/books',
  words: '@luma/words',
  stats: '@luma/stats',
  preferences: '@luma/preferences',
  recommendations: '@luma/recommendations',
  readingSignals: '@luma/reading-signals',
  sample: '@luma/sample-seeded',
};

const migrationKey = '@shuzhongyu/migrations/brand-v2';
const booksDirectory = Platform.OS === 'web' ? null : new Directory(Paths.document, 'shuzhongyu-books');
const legacyBooksDirectory = Platform.OS === 'web' ? null : new Directory(Paths.document, 'luma-books');
const defaultPreferences: ReadingPreferences = {
  fontSize: 19,
  lineHeight: 32,
  theme: 'paper',
  onlineSentenceTranslation: true,
};

const defaultRecommendationState: RecommendationState = {
  preferredGenres: [],
  savedBookIds: [],
  feedback: {},
};

function ensureBooksDirectory() {
  booksDirectory?.create({ intermediates: true, idempotent: true });
}

function contentFile(bookId: string) {
  if (!booksDirectory) throw new Error('Web 预览使用浏览器存储，不创建本地文件');
  ensureBooksDirectory();
  return new File(booksDirectory, `${bookId}.json`);
}

const contentKey = (bookId: string) => `@shuzhongyu/content/${bookId}`;

export async function migrateLegacyData() {
  if (await AsyncStorage.getItem(migrationKey)) return;

  const migrateBrandAuthor = (raw: string) => {
    try {
      const value = JSON.parse(raw);
      if (Array.isArray(value)) {
        return JSON.stringify(value.map((item) => item?.author === 'Luma Studio' ? { ...item, author: '书中语编辑部' } : item));
      }
      return JSON.stringify(value?.author === 'Luma Studio' ? { ...value, author: '书中语编辑部' } : value);
    } catch {
      return raw;
    }
  };

  const [currentValues, legacyValues] = await Promise.all([
    AsyncStorage.multiGet(Object.values(KEYS)),
    AsyncStorage.multiGet(Object.values(LEGACY_KEYS)),
  ]);
  const currentMap = new Map(currentValues);
  const legacyMap = new Map(legacyValues);
  const migratedValues = new Map<string, string>();

  for (const name of Object.keys(KEYS) as (keyof typeof KEYS)[]) {
    const currentKey = KEYS[name];
    const legacyValue = legacyMap.get(LEGACY_KEYS[name]);
    const currentValue = currentMap.get(currentKey);
    if (!currentValue && legacyValue) {
      migratedValues.set(currentKey, name === 'books' ? migrateBrandAuthor(legacyValue) : legacyValue);
    } else if (name === 'books' && currentValue) {
      const migratedBooks = migrateBrandAuthor(currentValue);
      if (migratedBooks !== currentValue) migratedValues.set(currentKey, migratedBooks);
    }
  }

  const allKeys = await AsyncStorage.getAllKeys();
  const legacyContentKeys = allKeys.filter((key) => key.startsWith('@luma/content/'));
  const currentContentKeys = allKeys.filter((key) => key.startsWith('@shuzhongyu/content/'));
  const currentContents = new Map(await AsyncStorage.multiGet(currentContentKeys));
  if (legacyContentKeys.length) {
    const legacyContents = await AsyncStorage.multiGet(legacyContentKeys);
    for (const [oldKey, value] of legacyContents) {
      if (!value) continue;
      const bookId = oldKey.slice('@luma/content/'.length);
      const newKey = contentKey(bookId);
      if (!currentContents.get(newKey)) migratedValues.set(newKey, migrateBrandAuthor(value));
    }
  }
  for (const [key, value] of currentContents) {
    if (!value) continue;
    const migratedContent = migrateBrandAuthor(value);
    if (migratedContent !== value) migratedValues.set(key, migratedContent);
  }

  if (legacyBooksDirectory?.exists && booksDirectory) {
    ensureBooksDirectory();
    for (const entry of legacyBooksDirectory.list()) {
      if (!(entry instanceof File)) continue;
      const destination = new File(booksDirectory, entry.name);
      if (!destination.exists) entry.copySync(destination);
      const content = await destination.json() as BookContent;
      if (content.author === 'Luma Studio') destination.write(JSON.stringify({ ...content, author: '书中语编辑部' }));
    }
  }

  if (migratedValues.size) await AsyncStorage.multiSet([...migratedValues]);
  await AsyncStorage.setItem(migrationKey, 'true');
}

export function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function loadBooks(): Promise<Book[]> {
  const raw = await AsyncStorage.getItem(KEYS.books);
  return raw ? JSON.parse(raw) : [];
}

export async function saveBooks(books: Book[]) {
  await AsyncStorage.setItem(KEYS.books, JSON.stringify(books));
}

export async function loadWords(): Promise<SavedWord[]> {
  const raw = await AsyncStorage.getItem(KEYS.words);
  return raw ? JSON.parse(raw) : [];
}

export async function saveWords(words: SavedWord[]) {
  await AsyncStorage.setItem(KEYS.words, JSON.stringify(words));
}

export async function loadStats(): Promise<ReadingStats> {
  const raw = await AsyncStorage.getItem(KEYS.stats);
  return raw ? JSON.parse(raw) : { minutes: 0, words: 0, streak: 0 };
}

export async function saveStats(stats: ReadingStats) {
  await AsyncStorage.setItem(KEYS.stats, JSON.stringify(stats));
}

export async function loadPreferences(): Promise<ReadingPreferences> {
  const raw = await AsyncStorage.getItem(KEYS.preferences);
  return raw ? { ...defaultPreferences, ...JSON.parse(raw) } : defaultPreferences;
}

export async function savePreferences(preferences: ReadingPreferences) {
  await AsyncStorage.setItem(KEYS.preferences, JSON.stringify(preferences));
}

export async function loadRecommendationState(): Promise<RecommendationState> {
  const raw = await AsyncStorage.getItem(KEYS.recommendations);
  return raw ? { ...defaultRecommendationState, ...JSON.parse(raw) } : defaultRecommendationState;
}

export async function saveRecommendationState(state: RecommendationState) {
  await AsyncStorage.setItem(KEYS.recommendations, JSON.stringify(state));
}

export async function loadReadingSignals(): Promise<ReadingSignal[]> {
  const raw = await AsyncStorage.getItem(KEYS.readingSignals);
  return raw ? JSON.parse(raw) : [];
}

export async function saveReadingSignals(signals: ReadingSignal[]) {
  await AsyncStorage.setItem(KEYS.readingSignals, JSON.stringify(signals));
}

export async function createBook(parsed: ParsedBook): Promise<{ book: Book; content: BookContent }> {
  const id = makeId('book');
  const content: BookContent = {
    id,
    title: parsed.title,
    author: parsed.author,
    chapters: parsed.chapters.map((chapter, index) => ({ ...chapter, id: `${id}_chapter_${index}` })),
  };
  const now = new Date().toISOString();
  const book: Book = {
    id,
    title: parsed.title,
    author: parsed.author || '未知作者',
    format: parsed.format,
    createdAt: now,
    lastOpenedAt: now,
    currentChapter: 0,
    currentParagraph: 0,
    progress: 0,
    totalWords: content.chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0),
    chapterCount: content.chapters.length,
    accent: bookAccents[Math.floor(Math.random() * bookAccents.length)],
  };
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(contentKey(id), JSON.stringify(content));
  } else {
    const file = contentFile(id);
    file.create({ intermediates: true, overwrite: true });
    file.write(JSON.stringify(content));
  }
  return { book, content };
}

export async function loadBookContent(bookId: string): Promise<BookContent> {
  if (Platform.OS === 'web') {
    const raw = await AsyncStorage.getItem(contentKey(bookId));
    if (!raw) throw new Error('本地书籍文件不存在，请重新导入');
    return JSON.parse(raw);
  }
  const file = contentFile(bookId);
  if (!file.exists) throw new Error('本地书籍文件不存在，请重新导入');
  return file.json();
}

export async function deleteBookContent(bookId: string) {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(contentKey(bookId));
    return;
  }
  const file = contentFile(bookId);
  if (file.exists) file.delete();
}

const sample: ParsedBook = {
  title: 'The Quiet Observatory',
  author: '书中语编辑部',
  format: 'sample',
  chapters: [
    {
      title: 'A Light in the Hills',
      wordCount: 156,
      paragraphs: [
        'At the edge of the northern hills stood a small observatory. Its white dome had not opened for many years, yet every evening a warm light appeared behind its narrow windows.',
        'Mara noticed the light on her walk home. The villagers told her that the building was empty, but she could not forget the quiet glow above the trees. One rainy night, she followed the old stone path and knocked on the blue door.',
        'An elderly astronomer welcomed her inside. Maps covered the walls, and a brass telescope pointed toward the dark sky. “I have been waiting for someone curious enough to climb the hill,” he said.',
        'Together they opened the dome. The clouds moved away, revealing a field of stars. Mara looked through the telescope and felt the world grow larger, calmer, and full of possibility.',
      ],
    },
    {
      title: 'The Map of Small Wonders',
      wordCount: 121,
      paragraphs: [
        'The astronomer gave Mara a notebook filled with unfinished drawings. Each page described a place where something ordinary became beautiful: a bridge at sunrise, a market after rain, a garden visited by fireflies.',
        '“The map is never complete,” he explained. “You finish it by paying attention.”',
        'During the following weeks, Mara began to notice details she had always missed. She heard the soft rhythm of bicycles on the morning road and saw how bakery windows turned golden before dawn.',
        'The observatory taught her about distant stars, but the notebook taught her something closer: wonder was not rare. It was waiting inside familiar days.',
      ],
    },
  ],
};

export async function ensureSampleBook(): Promise<Book | null> {
  const seeded = await AsyncStorage.getItem(KEYS.sample);
  if (seeded) return null;
  const { book } = await createBook(sample);
  await AsyncStorage.setItem(KEYS.sample, 'true');
  return book;
}

export async function clearAllLocalData() {
  const contentKeys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith('@shuzhongyu/content/') || key.startsWith('@luma/content/'));
  await AsyncStorage.multiRemove([...Object.values(KEYS), ...Object.values(LEGACY_KEYS), migrationKey, ...contentKeys]);
  if (booksDirectory?.exists) booksDirectory.delete();
  if (legacyBooksDirectory?.exists) legacyBooksDirectory.delete();
}
