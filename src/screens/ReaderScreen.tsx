import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  type LayoutChangeEvent,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { useDictionary } from '../context/DictionaryContext';
import type { RootStackParamList } from '../navigation/types';
import type { BookContent } from '../types';
import { colors, radii, typography } from '../theme';
import type { LookupResult } from '../services/translation';
import { sentenceAt, tokenizeParagraph } from '../utils/text';
import { progressAtPage, ReadingCoverage, resolveReadingPosition } from '../utils/reading';
import { ChapterTextMeasure } from '../components/ChapterTextMeasure';
import { InlineNotice } from '../components/InlineNotice';
import { speakEnglish, stopSpeech } from '../services/speech';
import {
  pageAtOffset,
  paginateMeasuredText,
  paragraphAtOffset,
  paragraphStarts,
  type ReaderPage,
  type MeasuredLine,
} from '../utils/pagination';

type Props = NativeStackScreenProps<RootStackParamList, 'Reader'>;

interface Selection {
  word: string;
  sentence: string;
  paragraphIndex: number;
}

interface ReaderPageTextProps {
  color: string;
  fontSize: number;
  lineHeight: number;
  page: ReaderPage;
  onSelect: (word: string, globalOffset: number) => void;
}

const textTokenCache = new Map<string, ReturnType<typeof tokenizeParagraph>>();
const paginationCache = new Map<string, ReaderPage[]>();
const PAGE_HORIZONTAL_PADDING = 24;
const PAGE_VERTICAL_PADDING = 18;
const FIRST_PAGE_HEADER_HEIGHT = 112;

function cachedTokens(text: string) {
  const cached = textTokenCache.get(text);
  if (cached) return cached;
  const tokens = tokenizeParagraph(text);
  textTokenCache.set(text, tokens);
  if (textTokenCache.size > 120) {
    const oldest = textTokenCache.keys().next().value as string | undefined;
    if (oldest) textTokenCache.delete(oldest);
  }
  return tokens;
}

const ReaderPageText = React.memo(function ReaderPageText({ color, fontSize, lineHeight, page, onSelect }: ReaderPageTextProps) {
  return (
    <Text style={[styles.pageText, { color, fontSize, lineHeight }]}>
      {cachedTokens(page.text).map((token, tokenIndex) => token.word ? (
        <Text
          key={`${token.start}_${tokenIndex}`}
          accessibilityRole="button"
          accessibilityLabel={`查词：${token.value}`}
          accessibilityHint="双击查看释义和原句"
          onPress={() => onSelect(token.value, page.start + token.start)}
          suppressHighlighting={false}
          style={styles.wordToken}
        >{token.value}</Text>
      ) : <Text key={`${token.start}_${tokenIndex}`}>{token.value}</Text>)}
    </Text>
  );
});

const readerThemes = {
  paper: { background: colors.canvas, text: colors.ink, muted: colors.inkMuted, chrome: 'rgba(244,241,234,0.94)' },
  white: { background: '#FFFFFF', text: '#171816', muted: '#777873', chrome: 'rgba(255,255,255,0.94)' },
  night: { background: colors.night, text: colors.nightText, muted: '#A4A59F', chrome: 'rgba(23,24,22,0.94)' },
};

export function ReaderScreen({ route, navigation }: Props) {
  // A new book or source jump starts a separate reading session, even when navigation reuses this route.
  return <ReaderSession key={`${route.params.bookId}:${route.params.chapterIndex ?? ''}:${route.params.paragraphIndex ?? ''}:${route.params.replay ? 'replay' : 'resume'}`} route={route} navigation={navigation} />;
}

function ReaderSession({ route, navigation }: Props) {
  const { bookId, chapterIndex: requestedChapter, paragraphIndex: requestedParagraph, replay, returnTo } = route.params;
  const insets = useSafeAreaInsets();
  const { books, words, preferences, getBookContent, updateProgress, updatePreferences, addWord, addReadingMinutes, recordLookup } = useApp();
  const { lookup: lookupDictionary, translateContext, entryCount } = useDictionary();
  const book = books.find((item) => item.id === bookId);
  const bookExists = !!book;
  const [content, setContent] = useState<BookContent | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [chapterIndex, setChapterIndex] = useState(requestedChapter ?? book?.currentChapter ?? 0);
  const [currentParagraph, setCurrentParagraph] = useState(requestedParagraph ?? book?.currentParagraph ?? 0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [contextTranslation, setContextTranslation] = useState<string | undefined>();
  const [translationLoading, setTranslationLoading] = useState(false);
  const [translationFailed, setTranslationFailed] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState(() => ({
    fontSize: preferences.fontSize,
    lineHeight: preferences.lineHeight,
    theme: preferences.theme,
  }));
  const [chaptersVisible, setChaptersVisible] = useState(false);
  const [completionVisible, setCompletionVisible] = useState(false);
  const [tapHintVisible, setTapHintVisible] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [readerLayout, setReaderLayout] = useState({ width: 0, height: 0 });
  const [pageSet, setPageSet] = useState<{ key: string; pages: ReaderPage[] }>({ key: '', pages: [] });
  const [currentPage, setCurrentPage] = useState(0);
  const completionShown = useRef(false);
  const completionDismissed = useRef(false);
  const replayStarted = useRef(!replay);
  const readingCoverage = useRef(new ReadingCoverage());
  const hasVisiblePage = useRef(false);
  const lookupRequest = useRef(0);
  const addReadingMinutesRef = useRef(addReadingMinutes);
  const pageAnchorOffset = useRef<number | null>(null);
  const initialPosition = useRef({
    chapterIndex: requestedChapter ?? book?.currentChapter ?? 0,
    paragraphIndex: requestedParagraph ?? book?.currentParagraph ?? 0,
    offset: requestedChapter === undefined && requestedParagraph === undefined ? book?.currentOffset : undefined,
  });
  const sessionMinutesSaved = useRef(0);
  const sessionWordsSaved = useRef(0);
  const activeSessionStarted = useRef(Date.now());
  const activeSessionElapsed = useRef(0);
  const appIsActive = useRef(AppState.currentState === 'active');

  const theme = readerThemes[preferences.theme];
  const chapter = content?.chapters[chapterIndex];
  const chapterText = useMemo(() => chapter?.paragraphs.join('\n\n') ?? '', [chapter]);
  const chapterParagraphStarts = useMemo(() => paragraphStarts(chapter?.paragraphs ?? []), [chapter]);
  const pageBodyHeight = Math.max(80, readerLayout.height - PAGE_VERTICAL_PADDING * 2);
  const firstPageBodyHeight = Math.max(80, pageBodyHeight - FIRST_PAGE_HEADER_HEIGHT);
  const paginationKey = chapter && readerLayout.width > 0 && readerLayout.height > 0
    ? `${chapter.id}:${chapterText.length}:${Math.round(readerLayout.width)}:${Math.round(readerLayout.height)}:${preferences.fontSize}:${preferences.lineHeight}`
    : '';
  const pages = pageSet.key === paginationKey ? pageSet.pages : [];

  useEffect(() => {
    let active = true;
    setContent(null);
    setContentError(null);
    if (!bookExists) return;
    getBookContent(bookId).then((loaded) => {
      if (!active) return;
      const initial = initialPosition.current;
      const position = resolveReadingPosition(loaded.chapters, initial.chapterIndex, initial.paragraphIndex, initial.offset);
      pageAnchorOffset.current = position.offset;
      setChapterIndex(position.chapterIndex);
      setCurrentParagraph(position.paragraphIndex);
      setContent(loaded);
    }).catch((error) => {
      if (active) setContentError(error instanceof Error ? error.message : '本地正文暂时无法读取，请重试。若仍无法打开，可从原文件重新导入或在设置中恢复备份。');
    });
    return () => { active = false; };
  }, [bookId, bookExists, getBookContent, loadAttempt]);

  useEffect(() => {
    addReadingMinutesRef.current = addReadingMinutes;
  }, [addReadingMinutes]);

  useEffect(() => {
    AsyncStorage.getItem('@shuyu/reader-tap-hint-seen').then((value) => {
      if (!value) setTapHintVisible(true);
    }).catch(() => undefined);
  }, []);

  const flushReadingSession = useCallback(() => {
    if (!hasVisiblePage.current) return;
    const now = Date.now();
    const elapsedMilliseconds = activeSessionElapsed.current + (appIsActive.current ? now - activeSessionStarted.current : 0);
    const elapsedSeconds = elapsedMilliseconds / 1000;
    const totalMinutes = elapsedSeconds >= 45 ? Math.max(1, Math.round(elapsedSeconds / 60)) : 0;
    const totalWords = readingCoverage.current.totalWords;
    const minutes = Math.max(0, totalMinutes - sessionMinutesSaved.current);
    const words = Math.max(0, totalWords - sessionWordsSaved.current);
    if (minutes <= 0 && words <= 0) return;
    sessionMinutesSaved.current = totalMinutes;
    sessionWordsSaved.current = totalWords;
    void addReadingMinutesRef.current(bookId, minutes, words).catch(() => undefined);
  }, [bookId]);

  useEffect(() => {
    // Persist active reading periodically so today's stats stay current even when
    // the reader remains open for a long session.
    const timer = setInterval(flushReadingSession, 60_000);
    return () => clearInterval(timer);
  }, [flushReadingSession]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const active = nextState === 'active';
      if (!active && appIsActive.current) {
        activeSessionElapsed.current += Date.now() - activeSessionStarted.current;
        appIsActive.current = false;
        flushReadingSession();
      } else if (active && !appIsActive.current) {
        activeSessionStarted.current = Date.now();
        appIsActive.current = true;
      }
    });
    return () => {
      subscription.remove();
      flushReadingSession();
      void stopSpeech();
    };
  }, [flushReadingSession]);

  useEffect(() => {
    if (!paginationKey) return;
    const cached = paginationCache.get(paginationKey);
    if (!cached) {
      setPageSet({ key: '', pages: [] });
      return;
    }
    const anchor = pageAnchorOffset.current ?? chapterParagraphStarts[currentParagraph] ?? 0;
    setPageSet({ key: paginationKey, pages: cached });
    setCurrentPage(pageAtOffset(cached, anchor));
  }, [paginationKey]);

  const onReaderLayout = useCallback((event: LayoutChangeEvent) => {
    const width = Math.floor(event.nativeEvent.layout.width);
    const height = Math.floor(event.nativeEvent.layout.height);
    setReaderLayout((current) => current.width === width && current.height === height ? current : { width, height });
  }, []);

  const onChapterTextLayout = useCallback((measured: MeasuredLine[]) => {
    if (!paginationKey || pageSet.key === paginationKey) return;
    const nextPages = paginateMeasuredText(chapterText, measured, pageBodyHeight, firstPageBodyHeight);
    paginationCache.set(paginationKey, nextPages);
    if (paginationCache.size > 24) {
      const oldest = paginationCache.keys().next().value as string | undefined;
      if (oldest) paginationCache.delete(oldest);
    }
    const anchor = pageAnchorOffset.current ?? chapterParagraphStarts[currentParagraph] ?? 0;
    setPageSet({ key: paginationKey, pages: nextPages });
    setCurrentPage(pageAtOffset(nextPages, anchor));
  }, [chapterParagraphStarts, chapterText, currentParagraph, firstPageBodyHeight, pageBodyHeight, pageSet.key, paginationKey]);

  useEffect(() => {
    const page = pages[currentPage];
    if (!page || !chapter || !content) return;
    if (!hasVisiblePage.current) {
      activeSessionElapsed.current = 0;
      activeSessionStarted.current = Date.now();
      hasVisiblePage.current = true;
    }
    pageAnchorOffset.current = page.start;
    const firstParagraph = paragraphAtOffset(chapterParagraphStarts, page.start);
    readingCoverage.current.recordPage(chapter.id, page);
    setCurrentParagraph(firstParagraph);
    const completedBefore = content.chapters.slice(0, chapterIndex).reduce((sum, item) => sum + item.wordCount, 0);
    const totalWords = content.chapters.reduce((sum, item) => sum + item.wordCount, 0);
    const progress = progressAtPage(completedBefore, chapter.wordCount, totalWords, page.end, chapterText.length);
    if (replay && (chapterIndex > 0 || currentPage > 0)) replayStarted.current = true;
    void updateProgress(bookId, chapterIndex, firstParagraph, progress, page.start).catch(() => undefined);
  }, [bookId, chapter, chapterIndex, chapterParagraphStarts, chapterText.length, content, currentPage, pages, updateProgress]);

  useEffect(() => {
    const reachedEnd = !!content && !!chapter && pages.length > 0
      && chapterIndex === content.chapters.length - 1
      && currentPage === pages.length - 1;
    if (reachedEnd && replayStarted.current && !completionShown.current && !completionDismissed.current) {
      completionShown.current = true;
      setCompletionVisible(true);
    }
  }, [chapter, chapterIndex, content, currentPage, pages.length, replayStarted]);

  const requestSentenceTranslation = useCallback(async (sentence: string, request: number) => {
    setTranslationLoading(true);
    setTranslationFailed(false);
    try {
      const translated = await translateContext(sentence);
      if (request !== lookupRequest.current) return;
      setContextTranslation(translated);
      setTranslationFailed(!translated);
    } catch {
      if (request === lookupRequest.current) setTranslationFailed(true);
    } finally {
      if (request === lookupRequest.current) setTranslationLoading(false);
    }
  }, [translateContext]);

  const requestWordLookup = useCallback(async (word: string, request: number) => {
    if (request !== lookupRequest.current) return;
    setLookupLoading(true);
    setLookupFailed(false);
    try {
      const result = await lookupDictionary(word, preferences.onlineSentenceTranslation);
      if (request === lookupRequest.current) setLookup(result);
    } catch {
      if (request === lookupRequest.current) setLookupFailed(true);
    } finally {
      if (request === lookupRequest.current) setLookupLoading(false);
    }
  }, [lookupDictionary, preferences.onlineSentenceTranslation]);

  const selectWord = useCallback(async (word: string, globalOffset: number) => {
    if (tapHintVisible) {
      setTapHintVisible(false);
      void AsyncStorage.setItem('@shuyu/reader-tap-hint-seen', 'true').catch(() => undefined);
    }
    const sentence = sentenceAt(chapterText, globalOffset);
    const request = ++lookupRequest.current;
    setSelection({ word, sentence, paragraphIndex: paragraphAtOffset(chapterParagraphStarts, globalOffset) });
    setSaveFeedback('idle');
    setLookup(null);
    setContextTranslation(undefined);
    setTranslationFailed(false);
    setLookupLoading(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    void recordLookup(bookId).catch(() => undefined);
    await requestWordLookup(word, request);
  }, [bookId, chapterParagraphStarts, chapterText, recordLookup, requestWordLookup, tapHintVisible]);

  const closeSelection = () => {
    lookupRequest.current += 1;
    setSelection(null);
    setSaveFeedback('idle');
    setTranslationLoading(false);
    setTranslationFailed(false);
  };

  const speak = useCallback((text: string, kind: 'word' | 'paragraph') => {
    setSpeechError(null);
    void speakEnglish(text, kind, preferences.speechVoice).catch(() => setSpeechError('朗读暂时不可用，请检查设备音量或系统英语音色。'));
  }, [preferences.speechVoice]);

  const isSaved = useMemo(() => selection
    ? words.some((item) => item.word.toLowerCase() === selection.word.toLowerCase() && item.context === selection.sentence)
    : false, [selection, words]);

  const saveSelection = async () => {
    if (!selection || !lookup || !book || isSaved) return;
    const request = lookupRequest.current;
    setSaveFeedback('saving');
    try {
      await addWord({
        word: selection.word,
        phonetic: lookup.phonetic,
        meaning: lookup.meaning,
        context: selection.sentence,
        contextTranslation,
        bookId,
        bookTitle: book.title,
        chapterIndex,
        paragraphIndex: selection.paragraphIndex,
      });
      if (request === lookupRequest.current) setSaveFeedback('saved');
    } catch {
      if (request === lookupRequest.current) setSaveFeedback('error');
    }
  };

  const openReaderSettings = () => {
    setSettingsDraft({
      fontSize: preferences.fontSize,
      lineHeight: preferences.lineHeight,
      theme: preferences.theme,
    });
    setSettingsVisible(true);
  };

  const applyReaderSettings = () => {
    setSettingsVisible(false);
    const changed = settingsDraft.fontSize !== preferences.fontSize
      || settingsDraft.lineHeight !== preferences.lineHeight
      || settingsDraft.theme !== preferences.theme;
    if (!changed) return;
    pageAnchorOffset.current = pages[currentPage]?.start ?? chapterParagraphStarts[currentParagraph] ?? 0;
    void updatePreferences(settingsDraft).catch(() => undefined);
  };

  const changeDraftFont = (delta: number) => {
    setSettingsDraft((current) => ({
      ...current,
      fontSize: Math.max(16, Math.min(25, current.fontSize + delta)),
      lineHeight: Math.max(27, Math.min(42, current.lineHeight + delta)),
    }));
  };

  const jumpToChapter = useCallback((index: number, paragraph = 0) => {
    const targetChapter = content?.chapters[index];
    const safeParagraph = targetChapter
      ? Math.max(0, Math.min(targetChapter.paragraphs.length - 1, paragraph))
      : 0;
    pageAnchorOffset.current = targetChapter ? paragraphStarts(targetChapter.paragraphs)[safeParagraph] ?? 0 : 0;
    setChapterIndex(index);
    setCurrentParagraph(safeParagraph);
    setCurrentPage(0);
    setChaptersVisible(false);
    void updateProgress(bookId, index, safeParagraph, content && book ? content.chapters.slice(0, index).reduce((sum, item) => sum + item.wordCount, 0) / Math.max(1, book.totalWords) : 0).catch(() => undefined);
  }, [book, bookId, content, updateProgress]);

  const turnPage = useCallback((direction: -1 | 1) => {
    if (!pages.length && chapterText.trim()) return;
    if (tapHintVisible) {
      setTapHintVisible(false);
      void AsyncStorage.setItem('@shuyu/reader-tap-hint-seen', 'true').catch(() => undefined);
    }
    const next = currentPage + direction;
    if (next >= 0 && next < pages.length) {
      setCurrentPage(next);
      return;
    }
    if (direction > 0 && content && chapterIndex < content.chapters.length - 1) {
      jumpToChapter(chapterIndex + 1);
    } else if (direction < 0 && content && chapterIndex > 0) {
      const previous = content.chapters[chapterIndex - 1];
      jumpToChapter(chapterIndex - 1, Math.max(0, previous.paragraphs.length - 1));
    }
  }, [chapterIndex, chapterText, content, currentPage, jumpToChapter, pages.length, tapHintVisible]);

  const pagePanResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx <= -42) turnPage(1);
      else if (gesture.dx >= 42) turnPage(-1);
    },
  }), [turnPage]);

  const returnToLibrary = () => navigation.popTo('Main', { screen: 'Library' });
  const returnToSource = () => navigation.popTo('Main', { screen: returnTo === 'Vocabulary' ? 'Vocabulary' : 'Library' });
  const restartBook = () => {
    completionDismissed.current = true;
    setCompletionVisible(false);
    pageAnchorOffset.current = 0;
    setChapterIndex(0);
    setCurrentParagraph(0);
    setCurrentPage(0);
    if (content && book) void updateProgress(bookId, 0, 0, 0, 0).catch(() => undefined);
  };

  if (!book || contentError || !content || !chapter) {
    const error = !book
      ? returnTo === 'Vocabulary'
        ? '这本书已不在本地书架中。请返回生词本选择其他词，或重新导入原文件。'
        : '这本书已不在本地书架中。请返回书架选择其他书籍，或重新导入原文件。'
      : contentError;
    return (
      <View style={[styles.loading, { backgroundColor: theme.background, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <StatusBar style={preferences.theme === 'night' ? 'light' : 'dark'} />
        {error ? <Ionicons name="book-outline" size={36} color={theme.muted} /> : <ActivityIndicator color={colors.accent} />}
        <Text accessibilityRole="header" style={[styles.contentStateTitle, { color: theme.text }]}>{error ? '无法打开书籍' : '正在打开书页'}</Text>
        {book ? <Text numberOfLines={2} style={[styles.contentStateBook, { color: theme.muted }]}>{book.title}</Text> : null}
        {error ? <Text accessibilityRole="alert" style={[styles.contentStateBody, { color: theme.muted }]}>{error}</Text> : null}
        {error && book ? (
          <Pressable accessibilityRole="button" accessibilityLabel="重新打开书籍正文" onPress={() => { setContentError(null); setLoadAttempt((attempt) => attempt + 1); }} style={styles.contentRetry}>
            <Text style={styles.contentRetryText}>重新打开</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel={returnTo === 'Vocabulary' ? '返回生词本' : '返回书架'} onPress={returnToSource} style={styles.contentBack}><Text style={[styles.contentBackText, { color: theme.text }]}>{returnTo === 'Vocabulary' ? '返回生词本' : '返回书架'}</Text></Pressable>
      </View>
    );
  }

  const emptyChapter = !chapterText.trim();

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style={preferences.theme === 'night' ? 'light' : 'dark'} />
      <View style={[styles.topBar, { paddingTop: insets.top + 4, backgroundColor: theme.chrome }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={returnTo === 'Vocabulary' ? '返回生词本' : '返回上一页'} onPress={() => navigation.goBack()} style={styles.iconButton}><Ionicons name="chevron-back" size={24} color={theme.text} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="打开目录" onPress={() => setChaptersVisible(true)} style={styles.topTitleWrap}>
          <Text numberOfLines={1} style={[styles.topTitle, { color: theme.text }]}>{book.title}</Text>
          <Text numberOfLines={1} style={[styles.topChapter, { color: theme.muted }]}>{chapter.title}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="阅读排版" onPress={openReaderSettings} style={styles.iconButton}><Text style={[styles.aa, { color: theme.text }]}>Aa</Text></Pressable>
      </View>
      {speechError ? <InlineNotice message={speechError} onDismiss={() => setSpeechError(null)} /> : null}

      <View onLayout={onReaderLayout} style={styles.pageViewport} {...pagePanResponder.panHandlers}>
        {tapHintVisible && !emptyChapter && currentPage === 0 && !selection ? (
          <Pressable accessibilityRole="button" accessibilityLabel="关闭阅读操作提示" onPress={() => { setTapHintVisible(false); void AsyncStorage.setItem('@shuyu/reader-tap-hint-seen', 'true').catch(() => undefined); }} style={styles.tapHint}>
            <Ionicons name="hand-left-outline" size={16} color={colors.accent} />
            <Text style={styles.tapHintText}>点按单词查看释义，左右滑动翻页</Text>
            <Ionicons name="close" size={15} color={colors.inkMuted} />
          </Pressable>
        ) : null}
        {emptyChapter ? (
          <View style={styles.paginating}>
            <Text style={[styles.contentStateTitle, { color: theme.text }]}>本章没有正文</Text>
            <Text style={[styles.contentStateBody, { color: theme.muted }]}>可以从目录选择其他章节继续阅读。</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="选择其他章节" onPress={() => setChaptersVisible(true)} style={styles.contentRetry}><Text style={styles.contentRetryText}>选择章节</Text></Pressable>
          </View>
        ) : pages.length ? (
          <View style={styles.pageSurface}>
            {currentPage === 0 ? (
              <View style={styles.pageChapterHeader}>
                <Text style={[styles.chapterNumber, { color: colors.accent }]}>CHAPTER {chapterIndex + 1}</Text>
                <Text numberOfLines={2} style={[styles.pageChapterTitle, { color: theme.text }]}>{chapter.title}</Text>
                <View style={[styles.chapterRule, { backgroundColor: theme.muted }]} />
              </View>
            ) : null}
            <ReaderPageText
              color={theme.text}
              fontSize={preferences.fontSize}
              lineHeight={preferences.lineHeight}
              page={pages[currentPage] ?? pages[0]}
              onSelect={selectWord}
            />
            <Text style={[styles.pageNumber, { color: theme.muted }]}>{currentPage + 1} / {pages.length}</Text>
            {currentPage === pages.length - 1 ? <Text style={[styles.chapterEndLabel, { color: theme.muted }]}>本章末</Text> : null}
          </View>
        ) : (
          <View style={styles.paginating}><ActivityIndicator color={colors.accent} /><Text style={[styles.loadingText, { color: theme.muted }]}>正在按屏幕排版…</Text></View>
        )}

        {paginationKey && !emptyChapter && !pages.length ? (
          <ChapterTextMeasure
            key={paginationKey}
            onLines={onChapterTextLayout}
            width={Math.max(1, readerLayout.width - PAGE_HORIZONTAL_PADDING * 2)}
            left={PAGE_HORIZONTAL_PADDING}
            fontFamily={typography.serif}
            fontSize={preferences.fontSize}
            lineHeight={preferences.lineHeight}
            text={chapterText}
          />
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="上一页"
          accessibilityState={{ disabled: (!emptyChapter && !pages.length) || (currentPage === 0 && chapterIndex === 0) }}
          disabled={(!emptyChapter && !pages.length) || (currentPage === 0 && chapterIndex === 0)}
          onPress={() => turnPage(-1)}
          style={[styles.pageEdge, styles.pageEdgeLeft]}
        ><Ionicons name="chevron-back" size={17} color={theme.muted} /></Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={emptyChapter || currentPage === pages.length - 1 ? '下一章' : '下一页'}
          accessibilityState={{ disabled: (!emptyChapter && !pages.length) || ((emptyChapter || currentPage === pages.length - 1) && chapterIndex === content.chapters.length - 1) }}
          disabled={(!emptyChapter && !pages.length) || ((emptyChapter || currentPage === pages.length - 1) && chapterIndex === content.chapters.length - 1)}
          onPress={() => turnPage(1)}
          style={[styles.pageEdge, styles.pageEdgeRight]}
        ><Ionicons name="chevron-forward" size={17} color={theme.muted} /></Pressable>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(10, insets.bottom), backgroundColor: theme.chrome, borderTopColor: preferences.theme === 'night' ? 'rgba(255,255,255,0.08)' : colors.line }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="朗读当前页" accessibilityState={{ disabled: emptyChapter || !pages.length }} disabled={emptyChapter || !pages.length} onPress={() => speak(pages[currentPage]?.text || chapter.paragraphs[currentParagraph] || '', 'paragraph')} style={styles.audioButton}>
          <Ionicons name="volume-medium-outline" size={19} color={colors.accent} />
        </Pressable>
        <View style={styles.bottomProgress}>
          <View style={styles.bottomMeta}><Text style={[styles.bottomText, { color: theme.muted }]}>第 {chapterIndex + 1}/{content.chapters.length} 章 · {emptyChapter ? '无正文' : pages.length ? `${currentPage + 1}/${pages.length} 页` : '排版中'}</Text><Text style={[styles.bottomText, { color: theme.muted }]}>{Math.round(book.progress * 100)}%</Text></View>
          <View style={[styles.bottomTrack, { backgroundColor: preferences.theme === 'night' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]}><View style={[styles.bottomFill, { width: `${Math.max(2, book.progress * 100)}%` }]} /></View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="打开目录" onPress={() => setChaptersVisible(true)} style={styles.audioButton}><Ionicons name="list-outline" size={20} color={theme.text} /></Pressable>
      </View>

      <Modal visible={!!selection} transparent animationType="slide" onRequestClose={closeSelection}>
        <Pressable style={styles.sheetBackdrop} onPress={closeSelection} />
        <View accessibilityViewIsModal style={[styles.wordSheet, { paddingBottom: insets.bottom + 18 }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.wordHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.wordTitleRow}>
                <Text style={styles.wordTitle}>{selection?.word}</Text>
                {lookup?.phonetic ? <Text style={styles.phonetic}>{lookup.phonetic}</Text> : null}
                <Pressable accessibilityRole="button" accessibilityLabel={`朗读${selection?.word || '单词'}`} onPress={() => { if (selection) speak(selection.word, 'word'); }} style={styles.soundButton}><Ionicons name="volume-medium" size={19} color={colors.accent} /></Pressable>
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={saveFeedback === 'saving' ? '正在保存到生词本' : isSaved ? '已收藏到生词本' : saveFeedback === 'error' ? '生词本保存失败' : '收藏到生词本'} accessibilityState={{ disabled: !lookup || isSaved || saveFeedback === 'saving' }} disabled={!lookup || isSaved || saveFeedback === 'saving'} onPress={() => void saveSelection()} style={[styles.saveButton, isSaved && styles.savedButton]}>
              <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={19} color={isSaved ? '#fff' : colors.ink} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="关闭查词卡片" onPress={closeSelection} style={styles.sheetCloseButton}>
              <Ionicons name="close" size={20} color={colors.inkMuted} />
            </Pressable>
          </View>
          {saveFeedback !== 'idle' ? <Text accessibilityRole={saveFeedback === 'error' ? 'alert' : undefined} style={[styles.saveFeedback, saveFeedback === 'error' && styles.saveFeedbackError]}>{saveFeedback === 'saving' ? '正在加入生词本…' : saveFeedback === 'error' ? '已加入本次会话，但设备保存失败，请稍后重试保存。' : '已加入生词本'}</Text> : null}
          <ScrollView style={styles.lookupScroll} contentContainerStyle={styles.lookupContent} showsVerticalScrollIndicator>
            {lookupLoading ? <View style={styles.lookupLoading}><ActivityIndicator color={colors.accent} /><Text style={styles.lookupLoadingText}>{preferences.onlineSentenceTranslation ? '正在查找释义（本地未收录时可能联网）…' : '正在查找本地释义…'}</Text></View> : lookupFailed ? (
              <View style={styles.lookupLoading}>
                <Text style={styles.lookupLoadingText}>查词暂时不可用，请重试。</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="重新查询这个单词" onPress={() => selection && void requestWordLookup(selection.word, lookupRequest.current)} style={styles.translationRetry}>
                  <Ionicons name="refresh" size={16} color={colors.accent} />
                  <Text style={styles.translationRetryText}>重新查词</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.meaningLabel}>{lookup?.source === 'offline' ? '词典释义' : '参考释义'}</Text>
                <Text style={styles.meaning}>{lookup?.meaning}</Text>
                {lookup?.matchedWord ? <Text style={styles.lemmaNote}>原形 · {lookup.matchedWord}</Text> : null}
                <View style={styles.contextCard}>
                  <Text style={styles.contextText}>{selection?.sentence}</Text>
                  {contextTranslation ? <Text style={styles.contextTranslation}>{contextTranslation}</Text> : null}
                  {translationLoading ? <View style={styles.translationStatus}><ActivityIndicator size="small" color={colors.accent} /><Text style={styles.translationStatusText}>正在获取整句翻译</Text></View> : null}
                  {!translationLoading && !contextTranslation && preferences.onlineSentenceTranslation ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={translationFailed ? '重新获取整句翻译' : '获取整句翻译，可能联网'} onPress={() => selection && void requestSentenceTranslation(selection.sentence, lookupRequest.current)} style={styles.translationRetry}>
                      <Ionicons name={translationFailed ? 'refresh' : 'language-outline'} size={14} color={colors.accent} />
                      <Text style={styles.translationRetryText}>{translationFailed ? '翻译暂时不可用，点击重试' : '获取整句翻译（按需联网）'}</Text>
                    </Pressable>
                  ) : null}
                  {!translationLoading && !contextTranslation && !preferences.onlineSentenceTranslation ? <Text style={styles.translationStatusText}>整句在线翻译已关闭</Text> : null}
                </View>
                <Text style={styles.providerNote}>
                  {entryCount === 0
                    ? lookup?.source === 'network' ? 'Web 预览 · 在线补充释义' : 'Web 预览未加载完整离线词典 · 已显示基础兜底'
                    : lookup?.source === 'offline' ? 'ECDICT 本地词典 · 查词无需联网' : lookup?.source === 'network' ? '在线补充释义' : '核心词典暂未收录，已显示兜底结果'}
                </Text>
                {lookup?.networkError ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="重新获取在线单词释义" onPress={() => selection && void requestWordLookup(selection.word, lookupRequest.current)} style={styles.translationRetry}>
                    <Ionicons name="refresh" size={14} color={colors.accent} />
                    <Text style={styles.translationRetryText}>在线补充释义暂不可用，点击重试</Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={settingsVisible} transparent animationType="fade" onRequestClose={applyReaderSettings}>
        <Pressable style={styles.centerBackdrop} onPress={applyReaderSettings}>
          <Pressable accessibilityViewIsModal style={styles.settingsCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>阅读排版</Text>
            <View style={[styles.livePreview, { backgroundColor: readerThemes[settingsDraft.theme].background }]}>
              <Text style={[styles.livePreviewLabel, { color: readerThemes[settingsDraft.theme].muted }]}>当前段落预览</Text>
              <Text numberOfLines={3} style={[styles.livePreviewText, {
                color: readerThemes[settingsDraft.theme].text,
                fontSize: settingsDraft.fontSize,
                lineHeight: settingsDraft.lineHeight,
              }]}>{chapter.paragraphs[currentParagraph] || 'Stories let us travel without leaving the quiet of a room.'}</Text>
            </View>
            <View style={styles.fontActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="减小正文字号" accessibilityState={{ disabled: settingsDraft.fontSize <= 16 }} disabled={settingsDraft.fontSize <= 16} onPress={() => changeDraftFont(-1)} style={[styles.fontButton, settingsDraft.fontSize <= 16 && styles.fontButtonDisabled]}><Ionicons name="remove" size={20} color={colors.ink} /></Pressable>
              <Text style={styles.fontValue}>{settingsDraft.fontSize}px</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="增大正文字号" accessibilityState={{ disabled: settingsDraft.fontSize >= 25 }} disabled={settingsDraft.fontSize >= 25} onPress={() => changeDraftFont(1)} style={[styles.fontButton, settingsDraft.fontSize >= 25 && styles.fontButtonDisabled]}><Ionicons name="add" size={20} color={colors.ink} /></Pressable>
            </View>
            <View style={styles.themeRow}>
              {(['paper', 'white', 'night'] as const).map((item) => (
                <Pressable key={item} accessibilityRole="button" accessibilityLabel={item === 'paper' ? '纸张主题' : item === 'white' ? '明亮主题' : '夜间主题'} accessibilityState={{ selected: settingsDraft.theme === item }} onPress={() => setSettingsDraft((current) => ({ ...current, theme: item }))} style={[styles.themeChoice, { backgroundColor: readerThemes[item].background }, settingsDraft.theme === item && styles.themeSelected]}>
                  {settingsDraft.theme === item ? <Ionicons name="checkmark" size={17} color={readerThemes[item].text} /> : null}
                </Pressable>
              ))}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="应用阅读排版" onPress={applyReaderSettings} style={styles.settingsDone}><Text style={styles.settingsDoneText}>完成</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={chaptersVisible} transparent animationType="slide" onRequestClose={() => setChaptersVisible(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setChaptersVisible(false)} />
        <View accessibilityViewIsModal style={[styles.chapterSheet, { paddingBottom: insets.bottom + 14 }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.modalTitle}>目录</Text>
          <FlatList
            data={content.chapters}
            keyExtractor={(item) => item.id}
            style={{ maxHeight: 430 }}
            renderItem={({ item, index }) => (
              <Pressable accessibilityRole="button" accessibilityLabel={index === chapterIndex ? `第 ${index + 1} 章，当前章节` : `第 ${index + 1} 章，${item.title}`} accessibilityState={{ selected: index === chapterIndex }} onPress={() => jumpToChapter(index)} style={[styles.chapterRow, index === chapterIndex && styles.activeChapterRow]}>
                <Text style={[styles.chapterRowNumber, index === chapterIndex && { color: colors.accent }]}>{String(index + 1).padStart(2, '0')}</Text>
                <View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.chapterRowTitle}>{item.title}</Text><Text style={styles.chapterRowMeta}>{item.wordCount.toLocaleString()} 词</Text></View>
                {index === chapterIndex ? <Ionicons name="volume-low" size={18} color={colors.accent} /> : null}
              </Pressable>
            )}
          />
        </View>
      </Modal>

      <Modal visible={completionVisible} transparent animationType="fade" onRequestClose={() => setCompletionVisible(false)}>
        <Pressable style={styles.completionBackdrop} onPress={() => setCompletionVisible(false)}>
          <Pressable accessibilityViewIsModal style={styles.completionCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.completionIcon}><Ionicons name="checkmark" size={27} color="#fff" /></View>
            <Text accessibilityRole="header" style={styles.completionTitle}>这本书读完了</Text>
            <Text style={styles.completionBody}>{returnTo === 'Vocabulary' ? '你已经读到最后一页。可以返回生词本继续复习，或从头再读一遍。' : '你已经读到最后一页。可以回到书架选择下一本，或从头再读一遍。'}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={returnTo === 'Vocabulary' ? '返回生词本' : '返回书架'} onPress={returnToSource} style={styles.completionPrimary}><Text style={styles.completionPrimaryText}>{returnTo === 'Vocabulary' ? '返回生词本' : '返回书架'}</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="从头再读一遍" onPress={restartBook} style={styles.completionSecondary}><Text style={styles.completionSecondaryText}>从头再读一遍</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 28 },
  loadingText: { fontSize: 12 },
  contentStateTitle: { fontSize: 21, fontWeight: '700', textAlign: 'center' },
  contentStateBook: { fontSize: 13, textAlign: 'center', maxWidth: 340 },
  contentStateBody: { fontSize: 14, lineHeight: 23, textAlign: 'center', maxWidth: 340, paddingHorizontal: 12 },
  contentRetry: { minHeight: 46, paddingHorizontal: 28, paddingVertical: 12, borderRadius: radii.pill, backgroundColor: colors.accent, justifyContent: 'center', marginTop: 10 },
  contentRetryText: { color: '#fff', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  contentBack: { minHeight: 46, paddingHorizontal: 28, justifyContent: 'center' },
  contentBackText: { fontSize: 14, fontWeight: '600' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, zIndex: 5 },
  iconButton: { width: 44, height: 42, alignItems: 'center', justifyContent: 'center' },
  topTitleWrap: { flex: 1, alignItems: 'center' },
  topTitle: { fontSize: 12, fontWeight: '700', maxWidth: '90%' },
  topChapter: { fontSize: 9, marginTop: 2, maxWidth: '90%' },
  aa: { fontFamily: typography.serif, fontSize: 17, fontWeight: '700' },
  pageViewport: { flex: 1, position: 'relative', overflow: 'hidden' },
  pageSurface: { flex: 1, paddingHorizontal: PAGE_HORIZONTAL_PADDING, paddingVertical: PAGE_VERTICAL_PADDING, overflow: 'hidden' },
  paginating: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  tapHint: { position: 'absolute', zIndex: 4, top: 14, left: 24, right: 24, minHeight: 42, borderRadius: 14, paddingHorizontal: 13, backgroundColor: colors.accentSoft, flexDirection: 'row', alignItems: 'center', gap: 8 },
  tapHintText: { flex: 1, color: colors.ink, fontSize: 11, fontWeight: '700' },
  pageChapterHeader: { height: FIRST_PAGE_HEADER_HEIGHT, alignItems: 'center', justifyContent: 'center', paddingBottom: 14 },
  chapterNumber: { fontSize: 10, fontWeight: '800', letterSpacing: 1.8, marginBottom: 14 },
  pageChapterTitle: { fontFamily: typography.serif, fontSize: 25, lineHeight: 30, fontWeight: '700', textAlign: 'center', letterSpacing: -0.5 },
  chapterRule: { width: 24, height: 1, opacity: 0.45, marginTop: 14 },
  pageText: { fontFamily: typography.serif, letterSpacing: 0.12 },
  wordToken: { textDecorationLine: 'none' },
  pageNumber: { position: 'absolute', right: 24, bottom: 5, fontSize: 8, fontWeight: '600' },
  chapterEndLabel: { position: 'absolute', left: 24, bottom: 5, fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  pageEdge: { position: 'absolute', top: '43%', width: 28, height: 58, alignItems: 'center', justifyContent: 'center', opacity: 0.45 },
  pageEdgeLeft: { left: 0 },
  pageEdgeRight: { right: 0 },
  bottomBar: { paddingTop: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1 },
  audioButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  bottomProgress: { flex: 1 },
  bottomMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  bottomText: { fontSize: 9, fontWeight: '600' },
  bottomTrack: { height: 3, borderRadius: 3, overflow: 'hidden' },
  bottomFill: { height: 3, borderRadius: 3, backgroundColor: colors.accent },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(15,16,13,0.34)' },
  wordSheet: { backgroundColor: '#FCFAF6', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 22, paddingTop: 10, minHeight: 360, maxHeight: '84%' },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.15)', alignSelf: 'center', marginBottom: 20 },
  wordHeader: { flexDirection: 'row', alignItems: 'center' },
  wordTitleRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 9 },
  wordTitle: { color: colors.ink, fontFamily: typography.serif, fontSize: 32, fontWeight: '700', letterSpacing: -0.7 },
  phonetic: { color: colors.inkMuted, fontSize: 12 },
  soundButton: { width: 35, height: 35, borderRadius: 18, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  saveButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  saveFeedback: { color: colors.accent, fontSize: 10, fontWeight: '700', marginTop: 9 },
  saveFeedbackError: { color: '#A24B35' },
  sheetCloseButton: { width: 38, height: 38, borderRadius: 19, marginLeft: 7, alignItems: 'center', justifyContent: 'center' },
  savedButton: { backgroundColor: colors.accent },
  lookupScroll: { flexShrink: 1 },
  lookupContent: { paddingBottom: 12 },
  lookupLoading: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 12 },
  lookupLoadingText: { color: colors.inkMuted, fontSize: 11 },
  meaningLabel: { color: colors.accent, fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginTop: 24 },
  meaning: { color: colors.ink, fontSize: 17, lineHeight: 25, fontWeight: '700', marginTop: 8 },
  lemmaNote: { color: colors.accent, fontSize: 10, fontWeight: '700', marginTop: 7 },
  contextCard: { backgroundColor: colors.canvas, borderRadius: radii.medium, padding: 16, marginTop: 18 },
  contextText: { color: colors.ink, fontFamily: typography.serif, fontSize: 14, lineHeight: 21 },
  contextTranslation: { color: colors.inkMuted, fontSize: 12, lineHeight: 19, marginTop: 9 },
  translationStatus: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10 },
  translationStatusText: { color: colors.inkMuted, fontSize: 10, marginTop: 8 },
  translationRetry: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 11, paddingVertical: 5 },
  translationRetryText: { color: colors.accent, fontSize: 10, fontWeight: '700' },
  providerNote: { color: colors.inkMuted, fontSize: 9, marginTop: 12 },
  centerBackdrop: { flex: 1, backgroundColor: 'rgba(15,16,13,0.42)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  settingsCard: { width: '100%', maxWidth: 340, backgroundColor: colors.surfaceStrong, borderRadius: radii.large, padding: 22 },
  modalTitle: { color: colors.ink, fontFamily: typography.serif, fontSize: 23, fontWeight: '700' },
  livePreview: { minHeight: 148, borderRadius: radii.medium, paddingHorizontal: 18, paddingVertical: 16, marginTop: 20, overflow: 'hidden' },
  livePreviewLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  livePreviewText: { fontFamily: typography.serif, letterSpacing: 0.12 },
  fontActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  fontButton: { width: 46, height: 42, borderRadius: 16, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  fontButtonDisabled: { opacity: 0.42 },
  fontValue: { color: colors.inkMuted, fontSize: 11, fontWeight: '700' },
  themeRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  themeChoice: { flex: 1, height: 54, borderRadius: 17, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  themeSelected: { borderColor: colors.accent, borderWidth: 2 },
  settingsDone: { alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: radii.pill, backgroundColor: colors.ink, marginTop: 22 },
  settingsDoneText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  chapterSheet: { backgroundColor: colors.surfaceStrong, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingTop: 10 },
  completionBackdrop: { flex: 1, backgroundColor: 'rgba(15,16,13,0.48)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  completionCard: { width: '100%', maxWidth: 340, backgroundColor: colors.surfaceStrong, borderRadius: 28, padding: 26, alignItems: 'center' },
  completionIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  completionTitle: { color: colors.ink, fontFamily: typography.serif, fontSize: 25, fontWeight: '700' },
  completionBody: { color: colors.inkMuted, fontSize: 13, lineHeight: 21, textAlign: 'center', marginTop: 9 },
  completionPrimary: { width: '100%', minHeight: 46, borderRadius: radii.pill, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  completionPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  completionSecondary: { minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  completionSecondaryText: { color: colors.accent, fontSize: 12, fontWeight: '800' },
  chapterRow: { flexDirection: 'row', alignItems: 'center', minHeight: 68, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 14 },
  activeChapterRow: { backgroundColor: colors.accentSoft, borderRadius: radii.medium, borderBottomColor: 'transparent' },
  chapterRowNumber: { color: colors.inkMuted, fontFamily: typography.serif, fontSize: 13, fontWeight: '700' },
  chapterRowTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  chapterRowMeta: { color: colors.inkMuted, fontSize: 9, marginTop: 4 },
});
