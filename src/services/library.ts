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
  books: '@shuyu/books',
  words: '@shuyu/words',
  stats: '@shuyu/stats',
  preferences: '@shuyu/preferences',
  recommendations: '@shuyu/recommendations',
  readingSignals: '@shuyu/reading-signals',
  sample: '@shuyu/sample-seeded',
};

const booksDirectory = Platform.OS === 'web' ? null : new Directory(Paths.document, 'shuyu-books');
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

const contentKey = (bookId: string) => `@shuyu/content/${bookId}`;

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
  author: '书语编辑部',
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
  const contentKeys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith('@shuyu/content/'));
  await AsyncStorage.multiRemove([...Object.values(KEYS), ...contentKeys]);
  if (booksDirectory?.exists) booksDirectory.delete();
}
