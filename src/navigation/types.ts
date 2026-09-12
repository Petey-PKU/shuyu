import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Today: undefined;
  Discover: undefined;
  Library: undefined;
  Vocabulary: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList>;
  Reader: { bookId: string; chapterIndex?: number; paragraphIndex?: number; replay?: boolean };
  LevelAssessment: undefined;
  RecommendedBook: { bookId: string };
  Review: undefined;
};
