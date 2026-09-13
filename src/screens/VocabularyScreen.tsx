import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { PageHeader } from '../components/PageHeader';
import { InlineNotice } from '../components/InlineNotice';
import { colors, radii, typography } from '../theme';
import { speakEnglish } from '../services/speech';
import { isWordDue, nextReviewTime, reviewDelayLabel } from '../utils/review';

type Props = CompositeScreenProps<BottomTabScreenProps<MainTabParamList, 'Vocabulary'>, NativeStackScreenProps<RootStackParamList>>;

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sourceLocation(chapterIndex?: number, paragraphIndex?: number) {
  if (chapterIndex === undefined || paragraphIndex === undefined) return '';
  return `第 ${chapterIndex + 1} 章 · 第 ${paragraphIndex + 1} 段`;
}

export function VocabularyScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { words, preferences, toggleMastered, removeWord, retryPersistence } = useApp();
  const [tab, setTab] = useState<'learning' | 'mastered'>('learning');
  const [query, setQuery] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [removeTarget, setRemoveTarget] = useState<{ id: string; word: string } | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [speechRetryWord, setSpeechRetryWord] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [retryingSave, setRetryingSave] = useState(false);
  const [updatingWordId, setUpdatingWordId] = useState<string | null>(null);
  const [removingWordId, setRemovingWordId] = useState<string | null>(null);
  const updatingWordRef = useRef<string | null>(null);
  const speechRequest = useRef(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  const filtered = useMemo(() => {
    const visible = words.filter((word) => tab === 'mastered' ? word.mastered : !word.mastered);
    return visible.sort((a, b) => {
      if (tab === 'learning') {
        const aDue = isWordDue(a.nextReviewAt, now);
        const bDue = isWordDue(b.nextReviewAt, now);
        if (aDue !== bDue) return aDue ? -1 : 1;
        const aNext = Date.parse(a.nextReviewAt ?? '');
        const bNext = Date.parse(b.nextReviewAt ?? '');
        if (Number.isFinite(aNext) && Number.isFinite(bNext) && aNext !== bNext) return aNext - bNext;
      }
      const aDate = Date.parse(a.lastReviewedAt ?? a.createdAt);
      const bDate = Date.parse(b.lastReviewedAt ?? b.createdAt);
      return (Number.isFinite(bDate) ? bDate : 0) - (Number.isFinite(aDate) ? aDate : 0);
    });
  }, [now, tab, words]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleWords = useMemo(() => {
    if (!normalizedQuery) return filtered;
    return filtered.filter((word) => [word.word, word.meaning, word.context, word.bookTitle]
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery)));
  }, [filtered, normalizedQuery]);
  const learningCount = words.filter((word) => !word.mastered).length;
  const masteredCount = words.length - learningCount;
  const active = words.filter((word) => !word.mastered && isWordDue(word.nextReviewAt, now)).length;
  const today = localDateKey(new Date());
  const reviewedToday = words.filter((word) => word.lastReviewedAt && localDateKey(new Date(word.lastReviewedAt)) === today).length;
  const nextReviewAt = nextReviewTime(words);
  const reviewTitle = active ? `${active} 个词等待重逢` : learningCount ? '先休息一下' : words.length ? '收藏词都已掌握' : '从第一个生词开始';
  const reviewMeta = active
    ? `从原句开始回忆`
    : nextReviewAt
      ? `下次复习：${reviewDelayLabel(nextReviewAt, now)}`
      : reviewedToday
        ? `今天已复习 ${reviewedToday} 个`
        : words.length
          ? '从原句开始回忆'
          : '阅读中收藏后会出现在这里';
  const emptyTitle = normalizedQuery ? '没有匹配的词' : tab === 'mastered' ? '还没有掌握词' : '这里还很安静';
  const emptyBody = normalizedQuery ? '试试单词、释义、原句或书名。' : tab === 'mastered' ? '在复习中点“记住了”，掌握的词会出现在这里。' : '阅读时点击单词并收藏，它会带着原句来到这里。';
  const speakWord = (word: string) => {
    const request = ++speechRequest.current;
    setSpeechError(null);
    setSpeechRetryWord(null);
    void speakEnglish(word, 'word', preferences.speechVoice)
      .then((provider) => { if (request === speechRequest.current && provider === 'system-fallback') setSpeechError('内置离线音色暂不可用，当前使用系统英语音色；可在设置中切换或稍后重试。'); })
      .catch(() => {
        if (request !== speechRequest.current) return;
        setSpeechError('朗读暂时不可用，请检查设备音量或系统英语音色。');
        setSpeechRetryWord(word);
      });
  };
  const confirmRemove = (id: string, word: string) => {
    setRemoveError(null);
    setRemoveTarget({ id, word });
  };
  const handleToggleMastered = async (wordId: string) => {
    if (updatingWordRef.current) return;
    updatingWordRef.current = wordId;
    setUpdatingWordId(wordId);
    try {
      await toggleMastered(wordId);
      setSaveError(null);
    } catch {
      setSaveError('状态已更新到当前会话，但设备尚未保存。');
    } finally {
      updatingWordRef.current = null;
      setUpdatingWordId(null);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget || removingWordId) return;
    const target = removeTarget;
    setRemovingWordId(target.id);
    setRemoveError(null);
    try {
      await removeWord(target.id);
      setSaveError(null);
      setRemoveTarget(null);
    } catch {
      const message = '生词已从当前列表移除，但设备尚未保存。';
      setSaveError(message);
      setRemoveError(message);
    } finally {
      setRemovingWordId(null);
    }
  };

  const retrySave = async () => {
    if (retryingSave) return;
    setRetryingSave(true);
    try {
      if (await retryPersistence()) setSaveError(null);
    } finally {
      setRetryingSave(false);
    }
  };

  return (
      <View style={[styles.screen, { paddingTop: insets.top + 18 }]}>
      <View style={styles.header}><PageHeader eyebrow={`${words.length} 个收藏词`} title="语境生词" /></View>
      {speechError ? <InlineNotice message={speechError} actionLabel={speechRetryWord ? '重试朗读' : undefined} onAction={speechRetryWord ? () => speakWord(speechRetryWord) : undefined} onDismiss={() => { setSpeechError(null); setSpeechRetryWord(null); }} /> : null}
      {saveError ? <InlineNotice message={saveError} actionLabel={retryingSave ? '保存中…' : '重试保存'} onAction={() => void retrySave()} onDismiss={() => setSaveError(null)} /> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={active ? `开始复习，${active} 个到期词` : reviewTitle} accessibilityState={{ disabled: !active }} disabled={!active} onPress={() => navigation.navigate('Review', { returnTo: 'Vocabulary' })} style={({ pressed }) => [styles.reviewCard, !active && { opacity: 0.62 }, pressed && { transform: [{ scale: 0.99 }] }]}>
        <View style={styles.reviewIcon}><Ionicons name="layers-outline" size={25} color={colors.accent} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.reviewEyebrow}>今日复习</Text>
          <Text style={styles.reviewTitle}>{reviewTitle}</Text>
          <Text style={styles.reviewMeta}>{reviewMeta}</Text>
        </View>
        {active ? <View style={styles.reviewGo}><Ionicons name="arrow-forward" size={18} color={colors.surfaceStrong} /></View> : null}
      </Pressable>
      {words.length ? <View style={styles.searchBox}><Ionicons name="search-outline" size={17} color={colors.inkMuted} /><TextInput accessibilityLabel="搜索生词" placeholder="搜索单词、释义、原句或书名" placeholderTextColor={colors.inkMuted} value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={styles.searchInput} /><Pressable accessibilityRole="button" accessibilityLabel="清除生词搜索" accessibilityState={{ disabled: !query }} disabled={!query} onPress={() => setQuery('')} style={[styles.searchClear, !query && styles.searchClearDisabled]}><Ionicons name="close-circle" size={17} color={colors.inkMuted} /></Pressable></View> : null}
      <View style={styles.tabs}>
        <Pressable accessibilityRole="tab" accessibilityLabel={`学习中，${learningCount} 个`} accessibilityState={{ selected: tab === 'learning' }} onPress={() => setTab('learning')} style={[styles.tab, tab === 'learning' && styles.activeTab]}><Text style={[styles.tabText, tab === 'learning' && styles.activeTabText]}>学习中 {learningCount}</Text></Pressable>
        <Pressable accessibilityRole="tab" accessibilityLabel={`已掌握，${masteredCount} 个`} accessibilityState={{ selected: tab === 'mastered' }} onPress={() => setTab('mastered')} style={[styles.tab, tab === 'mastered' && styles.activeTab]}><Text style={[styles.tabText, tab === 'mastered' && styles.activeTabText]}>已掌握 {masteredCount}</Text></Pressable>
      </View>
      <FlatList
        data={visibleWords}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name={normalizedQuery ? 'search-outline' : 'bookmark-outline'} size={34} color={colors.inkMuted} /><Text style={styles.emptyTitle}>{emptyTitle}</Text><Text style={styles.emptyBody}>{emptyBody}</Text>{tab === 'learning' && !normalizedQuery ? <Pressable accessibilityRole="button" accessibilityLabel="去今天开始阅读" onPress={() => navigation.navigate('Today')} style={styles.emptyButton}><Text style={styles.emptyButtonText}>{words.length ? '继续阅读' : '去读一本书'}</Text><Ionicons name="arrow-forward" size={15} color="#fff" /></Pressable> : null}</View>}
        renderItem={({ item }) => (
          <View style={styles.wordRow}>
            <View style={styles.wordMain}>
              <View style={styles.wordTitleRow}>
                <Text style={styles.word}>{item.word}</Text>
                {item.phonetic ? <Text style={styles.phonetic}>{item.phonetic}</Text> : null}
                <Pressable accessibilityRole="button" accessibilityLabel={`朗读${item.word}`} onPress={() => speakWord(item.word)}><Ionicons name="volume-medium-outline" size={19} color={colors.accent} /></Pressable>
              </View>
              <Text style={styles.meaning}>{item.meaning}</Text>
              <Text numberOfLines={2} style={styles.context}>{item.context}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`回到${item.bookTitle}${sourceLocation(item.chapterIndex, item.paragraphIndex) ? `，${sourceLocation(item.chapterIndex, item.paragraphIndex)}` : ''}中${item.word}所在原文`} onPress={() => navigation.navigate('Reader', { bookId: item.bookId, chapterIndex: item.chapterIndex, paragraphIndex: item.paragraphIndex, returnTo: 'Vocabulary' })} style={styles.sourceButton}>
                <Text style={styles.source}>{item.bookTitle}{sourceLocation(item.chapterIndex, item.paragraphIndex) ? ` · ${sourceLocation(item.chapterIndex, item.paragraphIndex)}` : ''} · {item.reviewCount ? `已复习 ${item.reviewCount} 次` : '待首次复习'}{!item.mastered && item.nextReviewAt && !isWordDue(item.nextReviewAt, now) ? ` · ${reviewDelayLabel(item.nextReviewAt, now)}` : ''}</Text>
                <Ionicons name="arrow-forward" size={12} color={colors.accent} />
              </Pressable>
            </View>
            <View style={styles.wordActions}>
              <Pressable accessibilityRole="button" accessibilityLabel={`移除${item.word}`} onPress={() => confirmRemove(item.id, item.word)} style={styles.removeButton}>
                <Ionicons name="trash-outline" size={16} color={colors.inkMuted} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={updatingWordId === item.id ? `正在更新${item.word}` : item.mastered ? `标记${item.word}为学习中` : `标记${item.word}为已掌握`} accessibilityState={{ checked: item.mastered, disabled: updatingWordId === item.id }} disabled={updatingWordId === item.id} onPress={() => void handleToggleMastered(item.id)} style={[styles.check, item.mastered && styles.checked, updatingWordId === item.id && styles.actionDisabled]}>
                <Ionicons name={item.mastered ? 'checkmark' : 'checkmark-outline'} size={17} color={item.mastered ? '#fff' : colors.inkMuted} />
              </Pressable>
            </View>
          </View>
        )}
      />
      <Modal visible={!!removeTarget} transparent animationType="fade" onRequestClose={() => { if (!removingWordId) { setRemoveTarget(null); setRemoveError(null); } }}>
        <Pressable style={styles.modalBackdrop} onPress={() => { if (!removingWordId) { setRemoveTarget(null); setRemoveError(null); } }}>
          <Pressable accessibilityViewIsModal style={styles.confirmCard} onPress={(event) => event.stopPropagation()}>
            <Text accessibilityRole="header" style={styles.confirmTitle}>移除这个词？</Text>
            <Text style={styles.confirmBody}>“{removeTarget?.word}”会从生词本中删除，但不会影响原书内容。</Text>
            {removeError ? <Text accessibilityRole="alert" style={styles.removeWarning}>{removeError}</Text> : null}
            <Pressable accessibilityRole="button" accessibilityLabel={removingWordId ? '正在移除生词' : removeError ? '重试移除生词' : '确认移除生词'} accessibilityState={{ disabled: !!removingWordId }} disabled={!!removingWordId} onPress={() => void handleRemove()} style={[styles.confirmDanger, removingWordId && styles.actionDisabled]}><Text style={styles.confirmDangerText}>{removingWordId ? '移除中…' : removeError ? '重试移除' : '移除'}</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="取消移除生词" accessibilityState={{ disabled: !!removingWordId }} disabled={!!removingWordId} onPress={() => { setRemoveTarget(null); setRemoveError(null); }} style={[styles.confirmCancel, removingWordId && styles.actionDisabled]}><Text style={styles.confirmCancelText}>取消</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: { paddingHorizontal: 20 },
  reviewCard: { marginHorizontal: 20, marginTop: 22, backgroundColor: colors.ink, borderRadius: radii.large, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  reviewIcon: { width: 48, height: 48, borderRadius: 17, backgroundColor: 'rgba(255,112,67,0.16)', alignItems: 'center', justifyContent: 'center' },
  reviewEyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 5 },
  reviewTitle: { color: colors.surfaceStrong, fontFamily: typography.serif, fontSize: 18, fontWeight: '700' },
  reviewMeta: { color: 'rgba(255,255,255,0.58)', fontSize: 10, marginTop: 5 },
  reviewGo: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  searchBox: { marginHorizontal: 20, marginTop: 16, minHeight: 46, borderRadius: radii.medium, paddingHorizontal: 13, backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, color: colors.ink, fontSize: 12, paddingVertical: 10 },
  searchClear: { padding: 5 },
  searchClearDisabled: { opacity: 0.28 },
  tabs: { marginHorizontal: 20, marginTop: 22, padding: 4, backgroundColor: 'rgba(0,0,0,0.055)', borderRadius: radii.pill, flexDirection: 'row' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radii.pill },
  activeTab: { backgroundColor: colors.surfaceStrong },
  tabText: { color: colors.inkMuted, fontSize: 12, fontWeight: '700' },
  activeTabText: { color: colors.ink },
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 130 },
  separator: { height: 1, backgroundColor: colors.line },
  wordRow: { paddingVertical: 19, flexDirection: 'row', gap: 12 },
  wordMain: { flex: 1 },
  wordTitleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  word: { color: colors.ink, fontFamily: typography.serif, fontSize: 23, fontWeight: '700', letterSpacing: -0.3 },
  phonetic: { color: colors.inkMuted, fontSize: 11 },
  meaning: { color: colors.ink, fontSize: 13, lineHeight: 19, fontWeight: '600', marginTop: 5 },
  context: { color: colors.inkMuted, fontFamily: typography.serif, fontSize: 12, lineHeight: 18, marginTop: 8 },
  source: { color: colors.accent, fontSize: 9, fontWeight: '700' },
  sourceButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, maxWidth: '100%' },
  check: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  wordActions: { alignItems: 'center', gap: 12, marginTop: 4 },
  removeButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: colors.sage, borderColor: colors.sage },
  actionDisabled: { opacity: 0.55 },
  empty: { alignItems: 'center', paddingTop: 76, paddingHorizontal: 34 },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '700', marginTop: 14 },
  emptyBody: { color: colors.inkMuted, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 7 },
  emptyButton: { marginTop: 20, minHeight: 44, borderRadius: radii.pill, paddingHorizontal: 18, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', gap: 7 },
  emptyButtonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(20,21,18,0.48)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  confirmCard: { width: '100%', maxWidth: 360, backgroundColor: colors.surfaceStrong, borderRadius: radii.large, padding: 22 },
  confirmTitle: { color: colors.ink, fontFamily: typography.serif, fontSize: 24, fontWeight: '700' },
  confirmBody: { color: colors.inkMuted, fontSize: 12, lineHeight: 19, marginTop: 9 },
  removeWarning: { color: colors.danger, fontSize: 11, lineHeight: 17, marginTop: 12 },
  confirmDanger: { minHeight: 46, borderRadius: radii.pill, backgroundColor: 'rgba(217,95,89,0.1)', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  confirmDangerText: { color: colors.danger, fontSize: 13, fontWeight: '800' },
  confirmCancel: { minHeight: 42, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  confirmCancelText: { color: colors.inkMuted, fontSize: 12, fontWeight: '800' },
});
