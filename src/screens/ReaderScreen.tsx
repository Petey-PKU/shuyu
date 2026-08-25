import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  type LayoutChangeEvent,
  Modal,
  type NativeSyntheticEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  type TextLayoutEventData,
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
import { speakEnglish, stopSpeech } from '../services/speech';
import {
  pageAtOffset,
  paginateMeasuredText,
  paragraphAtOffset,
  paragraphStarts,
  type ReaderPage,
} from '../utils/pagination';

type Props = NativeStackScreenProps<RootStackParamList, 'Reader'>;

interface Selection {
  word: string;
  sentence: string;
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
  const { bookId } = route.params;
  const insets = useSafeAreaInsets();
  const { books, words, preferences, getBookContent, updateProgress, updatePreferences, addWord, addReadingMinutes, recordLookup } = useApp();
  const { lookup: lookupDictionary, translateContext } = useDictionary();
  const book = books.find((item) => item.id === bookId);
  const [content, setContent] = useState<BookContent | null>(null);
  const [chapterIndex, setChapterIndex] = useState(book?.currentChapter ?? 0);
  const [currentParagraph, setCurrentParagraph] = useState(book?.currentParagraph ?? 0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
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
  const [readerLayout, setReaderLayout] = useState({ width: 0, height: 0 });
  const [pageSet, setPageSet] = useState<{ key: string; pages: ReaderPage[] }>({ key: '', pages: [] });
  const [currentPage, setCurrentPage] = useState(0);
  const sessionStarted = useRef(Date.now());
  const paragraphsSeen = useRef(new Set<number>());
  const lastSavedPosition = useRef('');
  const lookupRequest = useRef(0);
  const addReadingMinutesRef = useRef(addReadingMinutes);
  const averageChapterWordsRef = useRef(0);
  const pageAnchorOffset = useRef<number | null>(null);

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
    getBookContent(bookId).then(setContent).catch((error) => Alert.alert('无法打开书籍', error.message, [{ text: '返回', onPress: () => navigation.goBack() }]));
  }, [bookId, getBookContent, navigation]);

  useEffect(() => {
    addReadingMinutesRef.current = addReadingMinutes;
  }, [addReadingMinutes]);

  useEffect(() => {
    averageChapterWordsRef.current = chapter?.paragraphs.length
      ? chapter.wordCount / chapter.paragraphs.length
      : 0;
  }, [chapter]);

  useEffect(() => {
    return () => {
      const elapsedSeconds = (Date.now() - sessionStarted.current) / 1000;
      const minutes = elapsedSeconds >= 45 ? Math.max(1, Math.round(elapsedSeconds / 60)) : 0;
      addReadingMinutesRef.current(
        bookId,
        minutes,
        Math.round(paragraphsSeen.current.size * averageChapterWordsRef.current),
      );
      void stopSpeech();
    };
  }, []);

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

  const onChapterTextLayout = useCallback((event: NativeSyntheticEvent<TextLayoutEventData>) => {
    if (!paginationKey || pageSet.key === paginationKey) return;
    const measured = event.nativeEvent.lines.map((line) => ({ text: line.text, y: line.y, height: line.height }));
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

  const savePosition = useCallback((paragraph: number) => {
    if (!content || !chapter || !book) return;
    const completedBefore = content.chapters.slice(0, chapterIndex).reduce((sum, item) => sum + item.wordCount, 0);
    const chapterShare = chapter.paragraphs.length ? paragraph / chapter.paragraphs.length : 0;
    const progress = Math.min(1, (completedBefore + chapter.wordCount * chapterShare) / Math.max(1, book.totalWords));
    updateProgress(bookId, chapterIndex, paragraph, progress);
  }, [book, bookId, chapter, chapterIndex, content, updateProgress]);

  useEffect(() => {
    const page = pages[currentPage];
    if (!page) return;
    pageAnchorOffset.current = page.start;
    const firstParagraph = paragraphAtOffset(chapterParagraphStarts, page.start);
    const lastParagraph = paragraphAtOffset(chapterParagraphStarts, Math.max(page.start, page.end - 1));
    for (let index = firstParagraph; index <= lastParagraph; index += 1) paragraphsSeen.current.add(index);
    setCurrentParagraph(firstParagraph);
  }, [chapterParagraphStarts, currentPage, pages]);

  useEffect(() => {
    const positionKey = `${chapterIndex}:${currentParagraph}`;
    if (lastSavedPosition.current === positionKey) return;
    lastSavedPosition.current = positionKey;
    const handle = setTimeout(() => savePosition(currentParagraph), 500);
    return () => clearTimeout(handle);
  }, [chapterIndex, currentParagraph, savePosition]);

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

  const selectWord = useCallback(async (word: string, globalOffset: number) => {
    const sentence = sentenceAt(chapterText, globalOffset);
    const request = ++lookupRequest.current;
    setSelection({ word, sentence });
    setLookup(null);
    setContextTranslation(undefined);
    setTranslationFailed(false);
    setLookupLoading(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    void recordLookup(bookId);
    const lookupTask = (async () => {
      try {
        const result = await lookupDictionary(word, preferences.onlineSentenceTranslation);
        if (request === lookupRequest.current) setLookup(result);
      } finally {
        if (request === lookupRequest.current) setLookupLoading(false);
      }
    })();
    const translationTask = preferences.onlineSentenceTranslation
      ? requestSentenceTranslation(sentence, request)
      : Promise.resolve();
    await Promise.allSettled([lookupTask, translationTask]);
  }, [bookId, chapterText, lookupDictionary, preferences.onlineSentenceTranslation, recordLookup, requestSentenceTranslation]);

  const closeSelection = () => {
    lookupRequest.current += 1;
    setSelection(null);
    setTranslationLoading(false);
    setTranslationFailed(false);
  };

  const isSaved = useMemo(() => selection
    ? words.some((item) => item.word.toLowerCase() === selection.word.toLowerCase() && item.context === selection.sentence)
    : false, [selection, words]);

  const saveSelection = async () => {
    if (!selection || !lookup || !book || isSaved) return;
    await addWord({
      word: selection.word,
      phonetic: lookup.phonetic,
      meaning: lookup.meaning,
      context: selection.sentence,
      contextTranslation,
      bookId,
      bookTitle: book.title,
    });
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
    void updatePreferences(settingsDraft);
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
    paragraphsSeen.current.clear();
    setChaptersVisible(false);
    updateProgress(bookId, index, safeParagraph, content && book ? content.chapters.slice(0, index).reduce((sum, item) => sum + item.wordCount, 0) / Math.max(1, book.totalWords) : 0);
  }, [book, bookId, content, updateProgress]);

  const turnPage = useCallback((direction: -1 | 1) => {
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
  }, [chapterIndex, content, currentPage, jumpToChapter, pages.length]);

  const pagePanResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx <= -42) turnPage(1);
      else if (gesture.dx >= 42) turnPage(-1);
    },
  }), [turnPage]);

  if (!book || !content || !chapter) {
    return <View style={[styles.loading, { backgroundColor: theme.background }]}><ActivityIndicator color={colors.accent} /><Text style={[styles.loadingText, { color: theme.muted }]}>正在打开书页</Text></View>;
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style={preferences.theme === 'night' ? 'light' : 'dark'} />
      <View style={[styles.topBar, { paddingTop: insets.top + 4, backgroundColor: theme.chrome }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="返回书架" onPress={() => navigation.goBack()} style={styles.iconButton}><Ionicons name="chevron-back" size={24} color={theme.text} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="打开目录" onPress={() => setChaptersVisible(true)} style={styles.topTitleWrap}>
          <Text numberOfLines={1} style={[styles.topTitle, { color: theme.text }]}>{book.title}</Text>
          <Text numberOfLines={1} style={[styles.topChapter, { color: theme.muted }]}>{chapter.title}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="阅读排版" onPress={openReaderSettings} style={styles.iconButton}><Text style={[styles.aa, { color: theme.text }]}>Aa</Text></Pressable>
      </View>

      <View onLayout={onReaderLayout} style={styles.pageViewport} {...pagePanResponder.panHandlers}>
        {pages.length ? (
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

        {paginationKey && !pages.length ? (
          <Text
            key={paginationKey}
            onTextLayout={onChapterTextLayout}
            style={[styles.measureText, {
              width: Math.max(1, readerLayout.width - PAGE_HORIZONTAL_PADDING * 2),
              color: theme.text,
              fontSize: preferences.fontSize,
              lineHeight: preferences.lineHeight,
            }]}
          >{chapterText}</Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="上一页"
          disabled={currentPage === 0 && chapterIndex === 0}
          onPress={() => turnPage(-1)}
          style={[styles.pageEdge, styles.pageEdgeLeft]}
        ><Ionicons name="chevron-back" size={17} color={theme.muted} /></Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={currentPage === pages.length - 1 ? '下一章' : '下一页'}
          disabled={!pages.length || (currentPage === pages.length - 1 && chapterIndex === content.chapters.length - 1)}
          onPress={() => turnPage(1)}
          style={[styles.pageEdge, styles.pageEdgeRight]}
        ><Ionicons name="chevron-forward" size={17} color={theme.muted} /></Pressable>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(10, insets.bottom), backgroundColor: theme.chrome, borderTopColor: preferences.theme === 'night' ? 'rgba(255,255,255,0.08)' : colors.line }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="朗读当前页" onPress={() => void speakEnglish(pages[currentPage]?.text || chapter.paragraphs[currentParagraph] || '', 'paragraph', preferences.speechVoice)} style={styles.audioButton}>
          <Ionicons name="volume-medium-outline" size={19} color={colors.accent} />
        </Pressable>
        <View style={styles.bottomProgress}>
          <View style={styles.bottomMeta}><Text style={[styles.bottomText, { color: theme.muted }]}>第 {chapterIndex + 1}/{content.chapters.length} 章 · {pages.length ? `${currentPage + 1}/${pages.length} 页` : '排版中'}</Text><Text style={[styles.bottomText, { color: theme.muted }]}>{Math.round(book.progress * 100)}%</Text></View>
          <View style={[styles.bottomTrack, { backgroundColor: preferences.theme === 'night' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]}><View style={[styles.bottomFill, { width: `${Math.max(2, book.progress * 100)}%` }]} /></View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="打开目录" onPress={() => setChaptersVisible(true)} style={styles.audioButton}><Ionicons name="list-outline" size={20} color={theme.text} /></Pressable>
      </View>

      <Modal visible={!!selection} transparent animationType="slide" onRequestClose={closeSelection}>
        <Pressable style={styles.sheetBackdrop} onPress={closeSelection} />
        <View style={[styles.wordSheet, { paddingBottom: insets.bottom + 18 }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.wordHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.wordTitleRow}>
                <Text style={styles.wordTitle}>{selection?.word}</Text>
                {lookup?.phonetic ? <Text style={styles.phonetic}>{lookup.phonetic}</Text> : null}
                <Pressable onPress={() => selection && void speakEnglish(selection.word, 'word', preferences.speechVoice)} style={styles.soundButton}><Ionicons name="volume-medium" size={19} color={colors.accent} /></Pressable>
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={isSaved ? '已收藏到生词本' : '收藏到生词本'} disabled={!lookup || isSaved} onPress={saveSelection} style={[styles.saveButton, isSaved && styles.savedButton]}>
              <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={19} color={isSaved ? '#fff' : colors.ink} />
            </Pressable>
          </View>
          {lookupLoading ? <View style={styles.lookupLoading}><ActivityIndicator color={colors.accent} /><Text style={styles.lookupLoadingText}>理解语境中…</Text></View> : (
            <>
              <Text style={styles.meaningLabel}>在此处的意思</Text>
              <Text style={styles.meaning}>{lookup?.meaning}</Text>
              {lookup?.matchedWord ? <Text style={styles.lemmaNote}>原形 · {lookup.matchedWord}</Text> : null}
              <View style={styles.contextCard}>
                <Text style={styles.contextText}>{selection?.sentence}</Text>
                {contextTranslation ? <Text style={styles.contextTranslation}>{contextTranslation}</Text> : null}
                {translationLoading ? <View style={styles.translationStatus}><ActivityIndicator size="small" color={colors.accent} /><Text style={styles.translationStatusText}>正在获取整句翻译</Text></View> : null}
                {translationFailed && selection ? (
                  <Pressable onPress={() => void requestSentenceTranslation(selection.sentence, lookupRequest.current)} style={styles.translationRetry}>
                    <Ionicons name="refresh" size={14} color={colors.accent} />
                    <Text style={styles.translationRetryText}>翻译暂时不可用，点击重试</Text>
                  </Pressable>
                ) : null}
                {!translationLoading && !contextTranslation && !preferences.onlineSentenceTranslation ? <Text style={styles.translationStatusText}>整句在线翻译已关闭</Text> : null}
              </View>
              <Text style={styles.providerNote}>
                {lookup?.source === 'offline' ? 'ECDICT 本地词典 · 查词无需联网' : lookup?.source === 'network' ? '在线补充释义' : '核心词典暂未收录，已显示兜底结果'}
              </Text>
            </>
          )}
        </View>
      </Modal>

      <Modal visible={settingsVisible} transparent animationType="fade" onRequestClose={applyReaderSettings}>
        <Pressable style={styles.centerBackdrop} onPress={applyReaderSettings}>
          <Pressable style={styles.settingsCard} onPress={(event) => event.stopPropagation()}>
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
              <Pressable onPress={() => changeDraftFont(-1)} style={styles.fontButton}><Ionicons name="remove" size={20} color={colors.ink} /></Pressable>
              <Text style={styles.fontValue}>{settingsDraft.fontSize}px</Text>
              <Pressable onPress={() => changeDraftFont(1)} style={styles.fontButton}><Ionicons name="add" size={20} color={colors.ink} /></Pressable>
            </View>
            <View style={styles.themeRow}>
              {(['paper', 'white', 'night'] as const).map((item) => (
                <Pressable key={item} onPress={() => setSettingsDraft((current) => ({ ...current, theme: item }))} style={[styles.themeChoice, { backgroundColor: readerThemes[item].background }, settingsDraft.theme === item && styles.themeSelected]}>
                  {settingsDraft.theme === item ? <Ionicons name="checkmark" size={17} color={readerThemes[item].text} /> : null}
                </Pressable>
              ))}
            </View>
            <Pressable onPress={applyReaderSettings} style={styles.settingsDone}><Text style={styles.settingsDoneText}>完成</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={chaptersVisible} transparent animationType="slide" onRequestClose={() => setChaptersVisible(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setChaptersVisible(false)} />
        <View style={[styles.chapterSheet, { paddingBottom: insets.bottom + 14 }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.modalTitle}>目录</Text>
          <FlatList
            data={content.chapters}
            keyExtractor={(item) => item.id}
            style={{ maxHeight: 430 }}
            renderItem={({ item, index }) => (
              <Pressable onPress={() => jumpToChapter(index)} style={[styles.chapterRow, index === chapterIndex && styles.activeChapterRow]}>
                <Text style={[styles.chapterRowNumber, index === chapterIndex && { color: colors.accent }]}>{String(index + 1).padStart(2, '0')}</Text>
                <View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.chapterRowTitle}>{item.title}</Text><Text style={styles.chapterRowMeta}>{item.wordCount.toLocaleString()} 词</Text></View>
                {index === chapterIndex ? <Ionicons name="volume-low" size={18} color={colors.accent} /> : null}
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 12 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, zIndex: 5 },
  iconButton: { width: 44, height: 42, alignItems: 'center', justifyContent: 'center' },
  topTitleWrap: { flex: 1, alignItems: 'center' },
  topTitle: { fontSize: 12, fontWeight: '700', maxWidth: '90%' },
  topChapter: { fontSize: 9, marginTop: 2, maxWidth: '90%' },
  aa: { fontFamily: typography.serif, fontSize: 17, fontWeight: '700' },
  pageViewport: { flex: 1, position: 'relative', overflow: 'hidden' },
  pageSurface: { flex: 1, paddingHorizontal: PAGE_HORIZONTAL_PADDING, paddingVertical: PAGE_VERTICAL_PADDING, overflow: 'hidden' },
  paginating: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  measureText: { position: 'absolute', left: PAGE_HORIZONTAL_PADDING, top: 0, opacity: 0, fontFamily: typography.serif, letterSpacing: 0.12 },
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
  wordSheet: { backgroundColor: '#FCFAF6', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 22, paddingTop: 10, minHeight: 360 },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.15)', alignSelf: 'center', marginBottom: 20 },
  wordHeader: { flexDirection: 'row', alignItems: 'center' },
  wordTitleRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 9 },
  wordTitle: { color: colors.ink, fontFamily: typography.serif, fontSize: 32, fontWeight: '700', letterSpacing: -0.7 },
  phonetic: { color: colors.inkMuted, fontSize: 12 },
  soundButton: { width: 35, height: 35, borderRadius: 18, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  saveButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  savedButton: { backgroundColor: colors.accent },
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
  fontValue: { color: colors.inkMuted, fontSize: 11, fontWeight: '700' },
  themeRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  themeChoice: { flex: 1, height: 54, borderRadius: 17, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  themeSelected: { borderColor: colors.accent, borderWidth: 2 },
  settingsDone: { alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: radii.pill, backgroundColor: colors.ink, marginTop: 22 },
  settingsDoneText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  chapterSheet: { backgroundColor: colors.surfaceStrong, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingTop: 10 },
  chapterRow: { flexDirection: 'row', alignItems: 'center', minHeight: 68, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 14 },
  activeChapterRow: { backgroundColor: colors.accentSoft, borderRadius: radii.medium, borderBottomColor: 'transparent' },
  chapterRowNumber: { color: colors.inkMuted, fontFamily: typography.serif, fontSize: 13, fontWeight: '700' },
  chapterRowTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  chapterRowMeta: { color: colors.inkMuted, fontSize: 9, marginTop: 4 },
});
