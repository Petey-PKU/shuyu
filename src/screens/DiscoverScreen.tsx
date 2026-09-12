import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageHeader } from '../components/PageHeader';
import { RecommendedBookCover } from '../components/RecommendedBookCover';
import { useApp } from '../context/AppContext';
import { assessmentQuestions } from '../data/assessment';
import { recommendedBookById, recommendedBooks } from '../data/recommendedBooks';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import type { LanguageLevel, RecommendedBook } from '../types';
import {
  effectiveReadingScore,
  genreLabels,
  genreOptions,
  hasRecommendationReadingSignal,
  levelLabels,
  levelOrder,
  rankRecommendedBooks,
  recommendationMatchLabel,
} from '../services/recommendation';
import { colors, radii, typography } from '../theme';

type Props = CompositeScreenProps<BottomTabScreenProps<MainTabParamList, 'Discover'>, NativeStackScreenProps<RootStackParamList>>;

const assessmentDraftKey = '@shuyu/assessment-draft';

function BookTile({ book, saved, targetScore, onPress, onSave, saveDisabled }: {
  book: RecommendedBook;
  saved: boolean;
  targetScore: number;
  onPress: () => void;
  onSave: () => void;
  saveDisabled: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`查看推荐《${book.title}》`} onPress={onPress} style={({ pressed }) => [styles.bookTile, pressed && styles.pressed]}>
      <View>
        <RecommendedBookCover book={book} width={132} />
        <Pressable accessibilityRole="button" accessibilityLabel={saveDisabled ? '正在更新想读状态' : saved ? '移出想读' : '加入想读'} accessibilityState={{ selected: saved, disabled: saveDisabled }} disabled={saveDisabled} onPress={(event) => { event.stopPropagation(); onSave(); }} style={[styles.saveButton, saved && styles.savedButton, saveDisabled && styles.saveDisabled]}>
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={16} color={saved ? '#fff' : colors.ink} />
        </Pressable>
      </View>
      <Text numberOfLines={2} style={styles.bookTitle}>{book.title}</Text>
      <Text numberOfLines={1} style={styles.bookAuthor}>{book.author}</Text>
      <Text style={[styles.match, { color: book.accent }]}>{recommendationMatchLabel(book, targetScore)}</Text>
    </Pressable>
  );
}

export function DiscoverScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const {
    books,
    recommendationState,
    readingSignals,
    togglePreferredGenre,
    toggleSavedRecommendedBook,
  } = useApp();
  const [browseLevel, setBrowseLevel] = useState<LanguageLevel>(recommendationState.profile?.level ?? 'B1');
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [savingBookId, setSavingBookId] = useState<string | null>(null);
  const [assessmentDraftExists, setAssessmentDraftExists] = useState(false);
  const savingBookRef = useRef<string | null>(null);

  const refreshAssessmentDraft = useCallback(() => {
    void AsyncStorage.getItem(assessmentDraftKey).then((raw) => {
      try {
        const parsed = raw ? JSON.parse(raw) as Record<string, unknown> : null;
        const hasValidAnswer = !!parsed && assessmentQuestions.some((question) => {
          const value = parsed[question.id];
          return Number.isInteger(value) && Number(value) >= 0 && Number(value) < question.options.length;
        });
        setAssessmentDraftExists(hasValidAnswer);
      } catch {
        setAssessmentDraftExists(false);
      }
    }).catch(() => {
      setAssessmentDraftExists(false);
    });
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', refreshAssessmentDraft);
    refreshAssessmentDraft();
    return unsubscribe;
  }, [navigation, refreshAssessmentDraft]);

  useEffect(() => {
    if (recommendationState.profile) setBrowseLevel(recommendationState.profile.level);
  }, [recommendationState.profile]);

  const targetScore = effectiveReadingScore(recommendationState, readingSignals, books);
  const validSavedBookIds = useMemo(
    () => new Set(recommendationState.savedBookIds.filter((bookId) => recommendedBookById.has(bookId))),
    [recommendationState.savedBookIds],
  );
  const savedBookCount = validSavedBookIds.size;
  const ranked = useMemo(
    () => rankRecommendedBooks(recommendationState, readingSignals, books),
    [books, readingSignals, recommendationState],
  );
  const personal = (showSavedOnly ? ranked.filter((book) => validSavedBookIds.has(book.id)) : ranked).slice(0, 8);
  const levelBooks = recommendedBooks.filter((book) => book.level === browseLevel);
  const filteredLevelBooks = recommendationState.preferredGenres.length
    ? levelBooks.filter((book) => book.genres.some((genre) => recommendationState.preferredGenres.includes(genre)))
    : levelBooks;
  const shelf = filteredLevelBooks.length ? filteredLevelBooks : levelBooks;
  const handleToggleSaved = async (bookId: string) => {
    if (savingBookRef.current) return;
    savingBookRef.current = bookId;
    setSavingBookId(bookId);
    try {
      await toggleSavedRecommendedBook(bookId);
    } catch {
      // The app shell exposes the persistence retry banner while keeping the
      // optimistic recommendation state usable.
    } finally {
      savingBookRef.current = null;
      setSavingBookId(null);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + 18 }]} showsVerticalScrollIndicator={false}>
      <PageHeader
        eyebrow="DISCOVER · 72 本精选"
        title="为你选书"
        right={recommendationState.profile ? (
          <Pressable accessibilityRole="button" accessibilityLabel="重新测试阅读等级" onPress={() => navigation.navigate('LevelAssessment')} style={styles.levelBadge}>
            <Text style={styles.levelBadgeValue}>{recommendationState.profile.level}</Text>
            <Text style={styles.levelBadgeText}>重测</Text>
          </Pressable>
        ) : undefined}
      />

      {!recommendationState.profile ? (
        <View style={styles.assessmentHero}>
          <View style={styles.assessmentIcon}><Ionicons name="sparkles" size={23} color={colors.accent} /></View>
          <Text style={styles.assessmentEyebrow}>先找到舒适起点</Text>
          <Text style={styles.assessmentTitle}>不知道该从哪一本开始？</Text>
          <Text style={styles.assessmentBody}>{assessmentDraftExists ? '你有一份未完成的本地测试草稿，接着完成即可；答案不会上传。' : '完成约 5–8 分钟的本地测试，获得 A1–C2 阅读等级。当前先展示 B1 示例推荐。'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={assessmentDraftExists ? '继续水平测试' : '开始水平测试'} onPress={() => navigation.navigate('LevelAssessment')} style={styles.assessmentButton}><Text style={styles.assessmentButtonText}>{assessmentDraftExists ? '继续水平测试' : '开始水平测试'}</Text><Ionicons name="arrow-forward" size={16} color="#fff" /></Pressable>
        </View>
      ) : (
        <View style={styles.profileCard}>
          <View style={styles.profileLevel}><Text style={styles.profileLevelText}>{recommendationState.profile.level}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileTitle}>{levelLabels[recommendationState.profile.level]}</Text>
            <Text style={styles.profileBody}>适配分 {targetScore} · 推荐已结合测试结果{hasRecommendationReadingSignal(readingSignals, books) ? '和近期阅读' : ''}</Text>
          </View>
          <Ionicons name="checkmark-circle" size={21} color={colors.sage} />
        </View>
      )}

      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>阅读兴趣</Text><Text style={styles.sectionCaption}>可多选</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {genreOptions.map((genre) => {
          const selected = recommendationState.preferredGenres.includes(genre);
          return <Pressable key={genre} accessibilityRole="button" accessibilityLabel={`${selected ? '取消' : '选择'}兴趣：${genreLabels[genre]}`} accessibilityState={{ selected }} onPress={() => { void togglePreferredGenre(genre).catch(() => undefined); }} style={[styles.genreChip, selected && styles.genreChipSelected]}><Text style={[styles.genreChipText, selected && styles.genreChipTextSelected]}>{genreLabels[genre]}</Text></Pressable>;
        })}
      </ScrollView>

      <View style={styles.sectionHeader}>
        <View><Text style={styles.sectionTitle}>{recommendationState.profile ? '正适合你的书' : '从这里开始看看'}</Text><Text style={styles.sectionSub}>难度、兴趣与近期阅读共同排序</Text></View>
        {showSavedOnly || savedBookCount ? (
          <Pressable accessibilityRole="button" accessibilityLabel={showSavedOnly ? '查看全部推荐' : '只看想读'} accessibilityState={{ selected: showSavedOnly }} onPress={() => setShowSavedOnly((value) => !value)} style={[styles.savedCount, showSavedOnly && styles.savedCountSelected]}>
            <Ionicons name="bookmark" size={12} color={showSavedOnly ? '#fff' : colors.accent} /><Text style={[styles.savedCountText, showSavedOnly && styles.savedCountTextSelected]}>{showSavedOnly ? '全部' : `${savedBookCount} 想读`}</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bookRow}>
        {personal.map((book) => (
          <BookTile
            key={book.id}
            book={book}
            saved={validSavedBookIds.has(book.id)}
            targetScore={targetScore}
            onPress={() => navigation.navigate('RecommendedBook', { bookId: book.id })}
            onSave={() => { void handleToggleSaved(book.id); }}
            saveDisabled={savingBookId === book.id}
          />
        ))}
        {!personal.length ? <View style={styles.savedEmpty}><Ionicons name="bookmark-outline" size={19} color={colors.inkMuted} /><Text style={styles.savedEmptyText}>{showSavedOnly ? '还没有想读的书，点“全部”继续浏览' : '还没有想读的书'}</Text></View> : null}
      </ScrollView>

      <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>按等级浏览</Text><Text style={styles.sectionSub}>分级改写版与原版会明确标注</Text></View></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.levelRow}>
        {levelOrder.map((level) => <Pressable key={level} accessibilityRole="button" accessibilityLabel={`浏览${level}级别：${levelLabels[level]}`} accessibilityState={{ selected: browseLevel === level }} onPress={() => setBrowseLevel(level)} style={[styles.levelChip, browseLevel === level && styles.levelChipSelected]}><Text style={[styles.levelChipMain, browseLevel === level && styles.levelChipMainSelected]}>{level}</Text><Text style={[styles.levelChipSub, browseLevel === level && styles.levelChipSubSelected]}>{levelLabels[level]}</Text></Pressable>)}
      </ScrollView>

      <View style={styles.catalogList}>
        {shelf.map((book) => {
          const saved = validSavedBookIds.has(book.id);
          return (
            <Pressable key={book.id} accessibilityRole="button" accessibilityLabel={`查看推荐《${book.title}》`} onPress={() => navigation.navigate('RecommendedBook', { bookId: book.id })} style={({ pressed }) => [styles.catalogRow, pressed && styles.pressed]}>
              <RecommendedBookCover book={book} width={72} />
              <View style={styles.catalogCopy}>
                <View style={styles.catalogTitleRow}><Text numberOfLines={2} style={styles.catalogTitle}>{book.title}</Text><Pressable accessibilityRole="button" accessibilityLabel={savingBookId === book.id ? '正在更新想读状态' : saved ? '移出想读' : '加入想读'} accessibilityState={{ selected: saved, disabled: savingBookId === book.id }} disabled={savingBookId === book.id} onPress={(event) => { event.stopPropagation(); void handleToggleSaved(book.id); }} style={savingBookId === book.id && styles.saveDisabled} hitSlop={10}><Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={18} color={saved ? colors.accent : colors.inkMuted} /></Pressable></View>
                <Text numberOfLines={1} style={styles.catalogMeta}>{book.author} · 难度 {book.difficulty}</Text>
                <Text numberOfLines={1} style={styles.catalogEdition}>{book.edition}</Text>
                <Text numberOfLines={2} style={styles.catalogReason}>{book.fitReason}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.boundaryNote}><Ionicons name="library-outline" size={20} color={colors.sage} /><View style={{ flex: 1 }}><Text style={styles.boundaryTitle}>这里是选书指南，不是书城</Text><Text style={styles.boundaryBody}>{Platform.OS === 'web' ? '书语不提供图书获取入口。你可以自行取得有权使用的 TXT、EPUB、无 DRM 的 MOBI/AZW3/KF8，再导入本地书架；PDF 与 OCR 请使用正式 Android 安装包。' : '书语不提供图书获取入口。你可以自行取得有权使用的 TXT、EPUB、无 DRM 的 MOBI/AZW3/KF8，以及数字文本型或英文扫描版 PDF，再导入本地书架。'}</Text></View></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 20, paddingBottom: 130 },
  levelBadge: { minWidth: 58, height: 48, borderRadius: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  levelBadgeValue: { color: colors.accent, fontFamily: typography.serif, fontSize: 18, fontWeight: '700', lineHeight: 20 },
  levelBadgeText: { color: 'rgba(255,255,255,0.56)', fontSize: 7, fontWeight: '700' },
  assessmentHero: { marginTop: 24, backgroundColor: colors.ink, borderRadius: 28, padding: 22 },
  assessmentIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: 'rgba(255,112,67,0.14)', alignItems: 'center', justifyContent: 'center' },
  assessmentEyebrow: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginTop: 20 },
  assessmentTitle: { color: '#fff', fontFamily: typography.serif, fontSize: 25, lineHeight: 31, fontWeight: '700', marginTop: 7 },
  assessmentBody: { color: 'rgba(255,255,255,0.62)', fontSize: 11, lineHeight: 18, marginTop: 10 },
  assessmentButton: { height: 48, marginTop: 19, borderRadius: 16, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  assessmentButtonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  profileCard: { marginTop: 24, padding: 17, borderRadius: radii.large, backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 13 },
  profileLevel: { width: 48, height: 48, borderRadius: 17, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  profileLevelText: { color: colors.accent, fontFamily: typography.serif, fontSize: 20, fontWeight: '700' },
  profileTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  profileBody: { color: colors.inkMuted, fontSize: 9, lineHeight: 14, marginTop: 4 },
  sectionHeader: { marginTop: 30, marginBottom: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.ink, fontFamily: typography.serif, fontSize: 21, fontWeight: '700', letterSpacing: -0.4 },
  sectionCaption: { color: colors.inkMuted, fontSize: 10 },
  sectionSub: { color: colors.inkMuted, fontSize: 9, marginTop: 4 },
  chipRow: { gap: 8, paddingRight: 8 },
  genreChip: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.62)', borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  genreChipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  genreChipText: { color: colors.inkMuted, fontSize: 11, fontWeight: '700' },
  genreChipTextSelected: { color: '#fff' },
  bookRow: { gap: 14, paddingRight: 10, paddingBottom: 6 },
  bookTile: { width: 132 },
  pressed: { opacity: 0.76 },
  saveButton: { position: 'absolute', right: 8, bottom: 8, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  savedButton: { backgroundColor: colors.accent },
  saveDisabled: { opacity: 0.48 },
  bookTitle: { color: colors.ink, fontSize: 12, lineHeight: 16, fontWeight: '800', marginTop: 9 },
  bookAuthor: { color: colors.inkMuted, fontSize: 9, marginTop: 4 },
  match: { fontSize: 9, fontWeight: '800', marginTop: 6 },
  savedCount: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accentSoft, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 6 },
  savedCountText: { color: colors.accent, fontSize: 10, fontWeight: '900' },
  savedCountSelected: { backgroundColor: colors.accent },
  savedCountTextSelected: { color: '#fff' },
  savedEmpty: { height: 190, width: 220, borderRadius: radii.large, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center', gap: 8 },
  savedEmptyText: { color: colors.inkMuted, fontSize: 11, fontWeight: '700' },
  levelRow: { gap: 9, paddingRight: 8 },
  levelChip: { minWidth: 82, height: 57, paddingHorizontal: 13, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.62)', borderWidth: 1, borderColor: colors.line, justifyContent: 'center' },
  levelChipSelected: { backgroundColor: colors.accentSoft, borderColor: 'rgba(255,112,67,0.36)' },
  levelChipMain: { color: colors.ink, fontFamily: typography.serif, fontSize: 17, fontWeight: '700' },
  levelChipMainSelected: { color: colors.accent },
  levelChipSub: { color: colors.inkMuted, fontSize: 8, marginTop: 2 },
  levelChipSubSelected: { color: '#B84F2E' },
  catalogList: { gap: 12, marginTop: 16 },
  catalogRow: { minHeight: 118, padding: 12, borderRadius: radii.large, backgroundColor: 'rgba(255,255,255,0.68)', borderWidth: 1, borderColor: colors.line, flexDirection: 'row', gap: 14 },
  catalogCopy: { flex: 1, justifyContent: 'center' },
  catalogTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  catalogTitle: { flex: 1, color: colors.ink, fontFamily: typography.serif, fontSize: 16, lineHeight: 20, fontWeight: '700' },
  catalogMeta: { color: colors.inkMuted, fontSize: 9, marginTop: 5 },
  catalogEdition: { color: colors.accent, fontSize: 8, fontWeight: '800', marginTop: 5 },
  catalogReason: { color: colors.inkMuted, fontSize: 9, lineHeight: 14, marginTop: 6 },
  boundaryNote: { marginTop: 26, padding: 18, borderRadius: radii.medium, backgroundColor: colors.sageSoft, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  boundaryTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  boundaryBody: { color: colors.inkMuted, fontSize: 10, lineHeight: 16, marginTop: 4 },
});
