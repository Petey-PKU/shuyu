import React, { useEffect, useMemo, useState } from 'react';
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

export function VocabularyScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { words, preferences, toggleMastered, removeWord } = useApp();
  const [tab, setTab] = useState<'learning' | 'mastered'>('learning');
  const [query, setQuery] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [removeTarget, setRemoveTarget] = useState<{ id: string; word: string } | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  const filtered = useMemo(() => words.filter((word) => tab === 'mastered' ? word.mastered : !word.mastered), [words, tab]);
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
  const reviewMeta = !active && nextReviewAt ? `下次复习：${reviewDelayLabel(nextReviewAt, now)}` : reviewedToday ? `今天已复习 ${reviewedToday} 个` : '从原句开始回忆';
  const emptyTitle = normalizedQuery ? '没有匹配的词' : tab === 'mastered' ? '还没有掌握词' : '这里还很安静';
  const emptyBody = normalizedQuery ? '试试单词、释义、原句或书名。' : tab === 'mastered' ? '在复习中点“记住了”，掌握的词会出现在这里。' : '阅读时点击单词并收藏，它会带着原句来到这里。';
  const speakWord = (word: string) => {
    setSpeechError(null);
    void speakEnglish(word, 'word', preferences.speechVoice).catch(() => setSpeechError('朗读暂时不可用，请检查设备音量或系统英语音色。'));
  };
  const confirmRemove = (id: string, word: string) => setRemoveTarget({ id, word });

  return (
      <View style={[styles.screen, { paddingTop: insets.top + 18 }]}>
      <View style={styles.header}><PageHeader eyebrow={`${words.length} 个收藏词`} title="语境生词" /></View>
      {speechError ? <InlineNotice message={speechError} onDismiss={() => setSpeechError(null)} /> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={active ? `开始复习，${active} 个到期词` : reviewTitle} accessibilityState={{ disabled: !active }} disabled={!active} onPress={() => navigation.navigate('Review')} style={({ pressed }) => [styles.reviewCard, !active && { opacity: 0.62 }, pressed && { transform: [{ scale: 0.99 }] }]}>
        <View style={styles.reviewIcon}><Ionicons name="layers-outline" size={25} color={colors.accent} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.reviewEyebrow}>今日复习</Text>
          <Text style={styles.reviewTitle}>{reviewTitle}</Text>
          <Text style={styles.reviewMeta}>{reviewMeta}</Text>
        </View>
        <View style={styles.reviewGo}><Ionicons name="arrow-forward" size={18} color={colors.surfaceStrong} /></View>
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
              <Pressable accessibilityRole="button" accessibilityLabel={`回到${item.bookTitle}中${item.word}所在原文`} onPress={() => navigation.navigate('Reader', { bookId: item.bookId, chapterIndex: item.chapterIndex, paragraphIndex: item.paragraphIndex, returnTo: 'Vocabulary' })} style={styles.sourceButton}>
                <Text style={styles.source}>{item.bookTitle} · {item.reviewCount ? `已复习 ${item.reviewCount} 次` : '待首次复习'}{!item.mastered && item.nextReviewAt && !isWordDue(item.nextReviewAt, now) ? ` · ${reviewDelayLabel(item.nextReviewAt, now)}` : ''}</Text>
                <Ionicons name="arrow-forward" size={12} color={colors.accent} />
              </Pressable>
            </View>
            <View style={styles.wordActions}>
              <Pressable accessibilityRole="button" accessibilityLabel={`移除${item.word}`} onPress={() => confirmRemove(item.id, item.word)} style={styles.removeButton}>
                <Ionicons name="trash-outline" size={16} color={colors.inkMuted} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={item.mastered ? `标记${item.word}为学习中` : `标记${item.word}为已掌握`} accessibilityState={{ checked: item.mastered }} onPress={() => { void toggleMastered(item.id).catch(() => undefined); }} style={[styles.check, item.mastered && styles.checked]}>
                <Ionicons name={item.mastered ? 'checkmark' : 'checkmark-outline'} size={17} color={item.mastered ? '#fff' : colors.inkMuted} />
              </Pressable>
            </View>
          </View>
        )}
      />
      <Modal visible={!!removeTarget} transparent animationType="fade" onRequestClose={() => setRemoveTarget(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setRemoveTarget(null)}>
          <Pressable style={styles.confirmCard} onPress={(event) => event.stopPropagation()}>
            <Text accessibilityRole="header" style={styles.confirmTitle}>移除这个词？</Text>
            <Text style={styles.confirmBody}>“{removeTarget?.word}”会从生词本中删除，但不会影响原书内容。</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="确认移除生词" onPress={() => {
              if (removeTarget) void removeWord(removeTarget.id).catch(() => undefined);
              setRemoveTarget(null);
            }} style={styles.confirmDanger}><Text style={styles.confirmDangerText}>移除</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="取消移除生词" onPress={() => setRemoveTarget(null)} style={styles.confirmCancel}><Text style={styles.confirmCancelText}>取消</Text></Pressable>
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
  empty: { alignItems: 'center', paddingTop: 76, paddingHorizontal: 34 },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '700', marginTop: 14 },
  emptyBody: { color: colors.inkMuted, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 7 },
  emptyButton: { marginTop: 20, minHeight: 44, borderRadius: radii.pill, paddingHorizontal: 18, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', gap: 7 },
  emptyButtonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(20,21,18,0.48)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  confirmCard: { width: '100%', maxWidth: 360, backgroundColor: colors.surfaceStrong, borderRadius: radii.large, padding: 22 },
  confirmTitle: { color: colors.ink, fontFamily: typography.serif, fontSize: 24, fontWeight: '700' },
  confirmBody: { color: colors.inkMuted, fontSize: 12, lineHeight: 19, marginTop: 9 },
  confirmDanger: { minHeight: 46, borderRadius: radii.pill, backgroundColor: 'rgba(217,95,89,0.1)', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  confirmDangerText: { color: colors.danger, fontSize: 13, fontWeight: '800' },
  confirmCancel: { minHeight: 42, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  confirmCancelText: { color: colors.inkMuted, fontSize: 12, fontWeight: '800' },
});
