import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
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

type Props = NativeStackScreenProps<RootStackParamList, 'Reader'>;

interface Selection {
  word: string;
  sentence: string;
}

const readerThemes = {
  paper: { background: colors.canvas, text: colors.ink, muted: colors.inkMuted, chrome: 'rgba(244,241,234,0.94)' },
  white: { background: '#FFFFFF', text: '#171816', muted: '#777873', chrome: 'rgba(255,255,255,0.94)' },
  night: { background: colors.night, text: colors.nightText, muted: '#A4A59F', chrome: 'rgba(23,24,22,0.94)' },
};

export function ReaderScreen({ route, navigation }: Props) {
  const { bookId } = route.params;
  const insets = useSafeAreaInsets();
  const { books, words, preferences, getBookContent, updateProgress, updatePreferences, addWord, addReadingMinutes } = useApp();
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
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [chaptersVisible, setChaptersVisible] = useState(false);
  const sessionStarted = useRef(Date.now());
  const paragraphsSeen = useRef(new Set<number>());
  const lastSavedPosition = useRef('');
  const lookupRequest = useRef(0);
  const addReadingMinutesRef = useRef(addReadingMinutes);
  const averageChapterWordsRef = useRef(0);
  const flatList = useRef<FlatList<string>>(null);

  const theme = readerThemes[preferences.theme];
  const chapter = content?.chapters[chapterIndex];

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
        minutes,
        Math.round(paragraphsSeen.current.size * averageChapterWordsRef.current),
      );
      Speech.stop();
    };
  }, []);

  const savePosition = useCallback((paragraph: number) => {
    if (!content || !chapter || !book) return;
    const completedBefore = content.chapters.slice(0, chapterIndex).reduce((sum, item) => sum + item.wordCount, 0);
    const chapterShare = chapter.paragraphs.length ? paragraph / chapter.paragraphs.length : 0;
    const progress = Math.min(1, (completedBefore + chapter.wordCount * chapterShare) / Math.max(1, book.totalWords));
    updateProgress(bookId, chapterIndex, paragraph, progress);
  }, [book, bookId, chapter, chapterIndex, content, updateProgress]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<string>[] }) => {
    const visible = viewableItems.filter((item) => item.isViewable && item.index !== null);
    if (!visible.length) return;
    const index = visible[0].index ?? 0;
    visible.forEach((item) => item.index !== null && paragraphsSeen.current.add(item.index));
    setCurrentParagraph(index);
  }).current;

  useEffect(() => {
    const positionKey = `${chapterIndex}:${currentParagraph}`;
    if (lastSavedPosition.current === positionKey) return;
    lastSavedPosition.current = positionKey;
    const handle = setTimeout(() => savePosition(currentParagraph), 500);
    return () => clearTimeout(handle);
  }, [chapterIndex, currentParagraph, savePosition]);

  const selectWord = useCallback(async (word: string, paragraph: string, offset: number) => {
    const sentence = sentenceAt(paragraph, offset);
    const request = ++lookupRequest.current;
    setSelection({ word, sentence });
    setLookup(null);
    setContextTranslation(undefined);
    setLookupLoading(true);
    setTranslationLoading(preferences.onlineSentenceTranslation);
    try {
      const result = await lookupDictionary(word, preferences.onlineSentenceTranslation);
      if (request !== lookupRequest.current) return;
      setLookup(result);
      setLookupLoading(false);
      if (preferences.onlineSentenceTranslation) {
        const translated = await translateContext(sentence);
        if (request === lookupRequest.current) setContextTranslation(translated);
      }
    } finally {
      if (request === lookupRequest.current) {
        setLookupLoading(false);
        setTranslationLoading(false);
      }
    }
  }, [lookupDictionary, preferences.onlineSentenceTranslation, translateContext]);

  const closeSelection = () => {
    lookupRequest.current += 1;
    setSelection(null);
    setTranslationLoading(false);
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

  const jumpToChapter = (index: number) => {
    setChapterIndex(index);
    setCurrentParagraph(0);
    paragraphsSeen.current.clear();
    setChaptersVisible(false);
    setTimeout(() => flatList.current?.scrollToOffset({ offset: 0, animated: false }), 30);
    updateProgress(bookId, index, 0, content && book ? content.chapters.slice(0, index).reduce((sum, item) => sum + item.wordCount, 0) / Math.max(1, book.totalWords) : 0);
  };

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
        <Pressable accessibilityRole="button" accessibilityLabel="阅读排版" onPress={() => setSettingsVisible(true)} style={styles.iconButton}><Text style={[styles.aa, { color: theme.text }]}>Aa</Text></Pressable>
      </View>

      <FlatList
        ref={flatList}
        data={chapter.paragraphs}
        key={`${chapter.id}-${preferences.fontSize}-${preferences.lineHeight}`}
        keyExtractor={(_, index) => `${chapter.id}_${index}`}
        contentContainerStyle={[styles.readerContent, { paddingBottom: insets.bottom + 88 }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 55 }}
        ListHeaderComponent={
          <View style={styles.chapterHeader}>
            <Text style={[styles.chapterNumber, { color: colors.accent }]}>CHAPTER {chapterIndex + 1}</Text>
            <Text style={[styles.chapterTitle, { color: theme.text }]}>{chapter.title}</Text>
            <View style={[styles.chapterRule, { backgroundColor: theme.muted }]} />
          </View>
        }
        ListFooterComponent={
          <View style={styles.chapterEnd}>
            <View style={[styles.endMark, { borderColor: theme.muted }]} />
            <Text style={[styles.endText, { color: theme.muted }]}>{chapterIndex < content.chapters.length - 1 ? '本章读完了' : '全书读完了'}</Text>
            {chapterIndex < content.chapters.length - 1 ? (
              <Pressable onPress={() => jumpToChapter(chapterIndex + 1)} style={styles.nextButton}>
                <Text style={styles.nextText}>下一章</Text><Ionicons name="arrow-forward" size={16} color="#fff" />
              </Pressable>
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => (
          <Text style={[styles.paragraph, { color: theme.text, fontSize: preferences.fontSize, lineHeight: preferences.lineHeight }]}>
            {tokenizeParagraph(item).map((token, tokenIndex) => token.word ? (
              <Text
                key={`${index}_${tokenIndex}`}
                onPress={() => selectWord(token.value, item, token.start)}
                suppressHighlighting={false}
                style={styles.wordToken}
              >{token.value}</Text>
            ) : <Text key={`${index}_${tokenIndex}`}>{token.value}</Text>)}
          </Text>
        )}
      />

      <View style={[styles.bottomBar, { paddingBottom: Math.max(10, insets.bottom), backgroundColor: theme.chrome, borderTopColor: preferences.theme === 'night' ? 'rgba(255,255,255,0.08)' : colors.line }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="朗读当前段落" onPress={() => Speech.speak(chapter.paragraphs[currentParagraph] || '', { language: 'en-US', rate: 0.82 })} style={styles.audioButton}>
          <Ionicons name="volume-medium-outline" size={19} color={colors.accent} />
        </Pressable>
        <View style={styles.bottomProgress}>
          <View style={styles.bottomMeta}><Text style={[styles.bottomText, { color: theme.muted }]}>第 {chapterIndex + 1}/{content.chapters.length} 章</Text><Text style={[styles.bottomText, { color: theme.muted }]}>{Math.round(book.progress * 100)}%</Text></View>
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
                <Pressable onPress={() => selection && Speech.speak(selection.word, { language: 'en-US', rate: 0.82 })} style={styles.soundButton}><Ionicons name="volume-medium" size={19} color={colors.accent} /></Pressable>
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
                {!translationLoading && !contextTranslation && !preferences.onlineSentenceTranslation ? <Text style={styles.translationStatusText}>整句在线翻译已关闭</Text> : null}
              </View>
              <Text style={styles.providerNote}>
                {lookup?.source === 'offline' ? 'ECDICT 本地词典 · 查词无需联网' : lookup?.source === 'network' ? '在线补充释义' : '核心词典暂未收录，已显示兜底结果'}
              </Text>
            </>
          )}
        </View>
      </Modal>

      <Modal visible={settingsVisible} transparent animationType="fade" onRequestClose={() => setSettingsVisible(false)}>
        <Pressable style={styles.centerBackdrop} onPress={() => setSettingsVisible(false)}>
          <Pressable style={styles.settingsCard}>
            <Text style={styles.modalTitle}>阅读排版</Text>
            <View style={styles.fontPreview}><Text style={[styles.previewSmall, { opacity: preferences.fontSize === 16 ? 1 : 0.45 }]}>A</Text><View style={styles.sizeLine} /><Text style={[styles.previewLarge, { opacity: preferences.fontSize === 25 ? 1 : 0.75 }]}>A</Text></View>
            <View style={styles.fontActions}>
              <Pressable onPress={() => updatePreferences({ fontSize: Math.max(16, preferences.fontSize - 1), lineHeight: Math.max(27, preferences.lineHeight - 1) })} style={styles.fontButton}><Ionicons name="remove" size={20} color={colors.ink} /></Pressable>
              <Text style={styles.fontValue}>{preferences.fontSize}px</Text>
              <Pressable onPress={() => updatePreferences({ fontSize: Math.min(25, preferences.fontSize + 1), lineHeight: Math.min(42, preferences.lineHeight + 1) })} style={styles.fontButton}><Ionicons name="add" size={20} color={colors.ink} /></Pressable>
            </View>
            <View style={styles.themeRow}>
              {(['paper', 'white', 'night'] as const).map((item) => (
                <Pressable key={item} onPress={() => updatePreferences({ theme: item })} style={[styles.themeChoice, { backgroundColor: readerThemes[item].background }, preferences.theme === item && styles.themeSelected]}>
                  {preferences.theme === item ? <Ionicons name="checkmark" size={17} color={readerThemes[item].text} /> : null}
                </Pressable>
              ))}
            </View>
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
  readerContent: { paddingHorizontal: 24 },
  chapterHeader: { alignItems: 'center', paddingTop: 45, paddingBottom: 34 },
  chapterNumber: { fontSize: 10, fontWeight: '800', letterSpacing: 1.8, marginBottom: 14 },
  chapterTitle: { fontFamily: typography.serif, fontSize: 30, lineHeight: 36, fontWeight: '700', textAlign: 'center', letterSpacing: -0.7 },
  chapterRule: { width: 24, height: 1, opacity: 0.45, marginTop: 22 },
  paragraph: { fontFamily: typography.serif, marginBottom: 20, letterSpacing: 0.12 },
  wordToken: { textDecorationLine: 'none' },
  chapterEnd: { alignItems: 'center', paddingVertical: 52 },
  endMark: { width: 9, height: 9, borderWidth: 1, transform: [{ rotate: '45deg' }], marginBottom: 16, opacity: 0.55 },
  endText: { fontFamily: typography.serif, fontSize: 13, marginBottom: 18 },
  nextButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.ink, paddingHorizontal: 20, paddingVertical: 12, borderRadius: radii.pill },
  nextText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1 },
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
  providerNote: { color: colors.inkMuted, fontSize: 9, marginTop: 12 },
  centerBackdrop: { flex: 1, backgroundColor: 'rgba(15,16,13,0.42)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  settingsCard: { width: '100%', maxWidth: 340, backgroundColor: colors.surfaceStrong, borderRadius: radii.large, padding: 22 },
  modalTitle: { color: colors.ink, fontFamily: typography.serif, fontSize: 23, fontWeight: '700' },
  fontPreview: { flexDirection: 'row', alignItems: 'baseline', marginTop: 24 },
  previewSmall: { color: colors.ink, fontFamily: typography.serif, fontSize: 16 },
  previewLarge: { color: colors.ink, fontFamily: typography.serif, fontSize: 26 },
  sizeLine: { flex: 1, height: 1, marginHorizontal: 12, backgroundColor: colors.line },
  fontActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  fontButton: { width: 46, height: 42, borderRadius: 16, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  fontValue: { color: colors.inkMuted, fontSize: 11, fontWeight: '700' },
  themeRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  themeChoice: { flex: 1, height: 54, borderRadius: 17, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  themeSelected: { borderColor: colors.accent, borderWidth: 2 },
  chapterSheet: { backgroundColor: colors.surfaceStrong, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingTop: 10 },
  chapterRow: { flexDirection: 'row', alignItems: 'center', minHeight: 68, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 14 },
  activeChapterRow: { backgroundColor: colors.accentSoft, borderRadius: radii.medium, borderBottomColor: 'transparent' },
  chapterRowNumber: { color: colors.inkMuted, fontFamily: typography.serif, fontSize: 13, fontWeight: '700' },
  chapterRowTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  chapterRowMeta: { color: colors.inkMuted, fontSize: 9, marginTop: 4 },
});
