import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { PageHeader } from '../components/PageHeader';
import { colors, radii, typography } from '../theme';

type Props = CompositeScreenProps<BottomTabScreenProps<MainTabParamList, 'Vocabulary'>, NativeStackScreenProps<RootStackParamList>>;

export function VocabularyScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { words, toggleMastered } = useApp();
  const [tab, setTab] = useState<'learning' | 'mastered'>('learning');
  const filtered = useMemo(() => words.filter((word) => tab === 'mastered' ? word.mastered : !word.mastered), [words, tab]);
  const active = words.filter((word) => !word.mastered).length;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 18 }]}>
      <View style={styles.header}><PageHeader eyebrow={`${words.length} 个收藏词`} title="语境生词" /></View>
      <Pressable disabled={!active} onPress={() => navigation.navigate('Review')} style={({ pressed }) => [styles.reviewCard, !active && { opacity: 0.62 }, pressed && { transform: [{ scale: 0.99 }] }]}>
        <View style={styles.reviewIcon}><Ionicons name="layers-outline" size={25} color={colors.accent} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.reviewEyebrow}>今日复习</Text>
          <Text style={styles.reviewTitle}>{active ? `${active} 个词等待重逢` : '今天已经完成'}</Text>
        </View>
        <View style={styles.reviewGo}><Ionicons name="arrow-forward" size={18} color={colors.surfaceStrong} /></View>
      </Pressable>
      <View style={styles.tabs}>
        <Pressable onPress={() => setTab('learning')} style={[styles.tab, tab === 'learning' && styles.activeTab]}><Text style={[styles.tabText, tab === 'learning' && styles.activeTabText]}>学习中</Text></Pressable>
        <Pressable onPress={() => setTab('mastered')} style={[styles.tab, tab === 'mastered' && styles.activeTab]}><Text style={[styles.tabText, tab === 'mastered' && styles.activeTabText]}>已掌握</Text></Pressable>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="bookmark-outline" size={34} color={colors.inkMuted} /><Text style={styles.emptyTitle}>这里还很安静</Text><Text style={styles.emptyBody}>阅读时点击单词并收藏，它会带着原句来到这里。</Text></View>}
        renderItem={({ item }) => (
          <View style={styles.wordRow}>
            <View style={styles.wordMain}>
              <View style={styles.wordTitleRow}>
                <Text style={styles.word}>{item.word}</Text>
                {item.phonetic ? <Text style={styles.phonetic}>{item.phonetic}</Text> : null}
                <Pressable onPress={() => Speech.speak(item.word, { language: 'en-US', rate: 0.86 })}><Ionicons name="volume-medium-outline" size={19} color={colors.accent} /></Pressable>
              </View>
              <Text style={styles.meaning}>{item.meaning}</Text>
              <Text numberOfLines={2} style={styles.context}>{item.context}</Text>
              <Text style={styles.source}>{item.bookTitle}</Text>
            </View>
            <Pressable onPress={() => toggleMastered(item.id)} style={[styles.check, item.mastered && styles.checked]}>
              <Ionicons name={item.mastered ? 'checkmark' : 'checkmark-outline'} size={17} color={item.mastered ? '#fff' : colors.inkMuted} />
            </Pressable>
          </View>
        )}
      />
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
  reviewGo: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
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
  source: { color: colors.accent, fontSize: 9, fontWeight: '700', marginTop: 8 },
  check: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  checked: { backgroundColor: colors.sage, borderColor: colors.sage },
  empty: { alignItems: 'center', paddingTop: 76, paddingHorizontal: 34 },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '700', marginTop: 14 },
  emptyBody: { color: colors.inkMuted, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 7 },
});
