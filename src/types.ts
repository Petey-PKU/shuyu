export type BookFormat = 'txt' | 'epub' | 'mobi' | 'azw3' | 'kf8' | 'pdf' | 'sample';

export type ReaderTheme = 'paper' | 'white' | 'night';

export interface ImportStatus {
  phase: 'parsing' | 'ocr';
  currentPage?: number;
  totalPages?: number;
  skippedPages?: number;
  cancelling?: boolean;
}

export type LanguageLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type BookGenre =
  | 'adventure'
  | 'biography'
  | 'classic'
  | 'contemporary'
  | 'crime'
  | 'fantasy'
  | 'history'
  | 'humor'
  | 'mystery'
  | 'nonfiction'
  | 'romance'
  | 'science'
  | 'society';

export type BookLength = 'short' | 'medium' | 'long';

export type DifficultyFeedback = 'easy' | 'right' | 'hard';

export interface RecommendedBook {
  id: string;
  title: string;
  author: string;
  level: LanguageLevel;
  difficulty: number;
  genres: BookGenre[];
  length: BookLength;
  edition: string;
  summary: string;
  fitReason: string;
  accent: string;
}

export interface ReadingLevelProfile {
  level: LanguageLevel;
  score: number;
  confidence: 'low' | 'medium' | 'high';
  assessedAt: string;
  source: 'assessment' | 'manual';
}

export interface RecommendationState {
  profile?: ReadingLevelProfile;
  preferredGenres: BookGenre[];
  savedBookIds: string[];
  feedback: Record<string, DifficultyFeedback>;
}

export interface ReadingSignal {
  bookId: string;
  lookups: number;
  wordsRead: number;
  minutes: number;
}

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
  speechVoice?: string;
}

export interface ParsedBook {
  title: string;
  author: string;
  chapters: Omit<Chapter, 'id'>[];
  format: BookFormat;
}
