export type BookFormat = 'txt' | 'epub' | 'sample';

export type ReaderTheme = 'paper' | 'white' | 'night';

export interface Chapter {
  id: string;
  title: string;
  paragraphs: string[];
  wordCount: number;
}

export interface BookContent {
  id: string;
  title: string;
  author?: string;
  chapters: Chapter[];
}

export interface Book {
  id: string;
  title: string;
  author: string;
  format: BookFormat;
  createdAt: string;
  lastOpenedAt: string;
  currentChapter: number;
  currentParagraph: number;
  progress: number;
  totalWords: number;
  chapterCount: number;
  accent: string;
}

export interface SavedWord {
  id: string;
  word: string;
  phonetic?: string;
  meaning: string;
  context: string;
  contextTranslation?: string;
  bookId: string;
  bookTitle: string;
  createdAt: string;
  mastered: boolean;
  reviewCount: number;
}

export interface ReadingStats {
  minutes: number;
  words: number;
  streak: number;
  lastReadDate?: string;
}

export interface ReadingPreferences {
  fontSize: number;
  lineHeight: number;
  theme: ReaderTheme;
  onlineSentenceTranslation: boolean;
}

export interface ParsedBook {
  title: string;
  author: string;
  chapters: Omit<Chapter, 'id'>[];
  format: BookFormat;
}
