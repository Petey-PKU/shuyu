import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { BookCover } from '../components/BookCover';
import { PageHeader } from '../components/PageHeader';
import { colors, radii, shadows, typography } from '../theme';

type Props = CompositeScreenProps<BottomTabScreenProps<MainTabParamList, 'Today'>, NativeStackScreenProps<RootStackParamList>>;

function greeting() {
  const hour = new Date().getHours();
  if (hour < 11) return '早上好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

export function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { books, stats, words, importBook } = useApp();
  const current = [...books].sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt))[0];
  const activeWords = words.filter((word) => !word.mastered).length;

  const handleImport = async () => {
    try {
      const book = await importBook();
      if (book) navigation.navigate('Reader', { bookId: book.id });
    } catch (error) {
      Alert.alert('无法导入', error instanceof Error ? error.message : '请确认文件格式后重试');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + 18 }]} showsVerticalScrollIndicator={false}>
      <PageHeader
        eyebrow="书中语 · 语境阅读"
        title={greeting()}
        right={
          <Pressable onPress={handleImport} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
            <Ionicons name="add" size={25} color={colors.ink} />
          </Pressable>
        }
      />

      {current ? (
        <Pressable onPress={() => navigation.navigate('Reader', { bookId: current.id })} style={({ pressed }) => [styles.hero, pressed && styles.heroPressed]}>
          <LinearGradient colors={['#242520', '#171815']} style={StyleSheet.absoluteFill} />
          <View style={styles.heroCopy}>
            <View>
              <Text style={styles.heroEyebrow}>继续阅读</Text>
              <Text numberOfLines={3} style={styles.heroTitle}>{current.title}</Text>
              <Text numberOfLines={1} style={styles.heroAuthor}>{current.author}</Text>
            </View>
            <View>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(3, current.progress * 100)}%` }]} /></View>
              <View style={styles.progressMeta}>
                <Text style={styles.progressText}>{Math.round(current.progress * 100)}%</Text>
                <View style={styles.continuePill}>
                  <Text style={styles.continueText}>继续</Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.ink} />
                </View>
              </View>
            </View>
          </View>
          <View style={styles.heroCover}><BookCover book={current} width={112} compact /></View>
        </Pressable>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>今日节奏</Text>
        <Text style={styles.sectionCaption}>一点点，也算向前</Text>
      </View>
      <View style={styles.metrics}>
        <View style={[styles.metricCard, styles.metricWarm]}>
          <Ionicons name="flame-outline" size={21} color={colors.accent} />
          <Text style={styles.metricValue}>{stats.streak}</Text>
          <Text style={styles.metricLabel}>连续天数</Text>
        </View>
        <View style={[styles.metricCard, styles.metricSage]}>
          <Ionicons name="time-outline" size={21} color={colors.sage} />
          <Text style={styles.metricValue}>{stats.minutes}</Text>
          <Text style={styles.metricLabel}>阅读分钟</Text>
        </View>
        <View style={[styles.metricCard, styles.metricBlue]}>
          <Ionicons name="sparkles-outline" size={21} color={colors.blue} />
          <Text style={styles.metricValue}>{activeWords}</Text>
          <Text style={styles.metricLabel}>待掌握词</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>最近书页</Text>
        <Pressable onPress={() => navigation.navigate('Library')}><Text style={styles.link}>查看全部</Text></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bookRow}>
        {books.slice(0, 5).map((book) => (
          <Pressable key={book.id} onPress={() => navigation.navigate('Reader', { bookId: book.id })} style={styles.bookItem}>
            <BookCover book={book} width={116} compact />
            <Text numberOfLines={2} style={styles.bookTitle}>{book.title}</Text>
            <Text style={styles.bookProgress}>{Math.round(book.progress * 100)}% · {book.format.toUpperCase()}</Text>
          </Pressable>
        ))}
        <Pressable onPress={handleImport} style={styles.importCard}>
          <View style={styles.importIcon}><Ionicons name="document-text-outline" size={25} color={colors.accent} /></View>
          <Text style={styles.importTitle}>导入新书</Text>
          <Text style={styles.importBody}>TXT 或 EPUB</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.privacyNote}>
        <Ionicons name="shield-checkmark-outline" size={20} color={colors.sage} />
        <View style={{ flex: 1 }}>
          <Text style={styles.privacyTitle}>书籍留在你的设备</Text>
          <Text style={styles.privacyBody}>正文与词典查词留在设备；启用整句翻译后，仅在你点词时发送当前句子。</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 20, paddingBottom: 130 },
  addButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center', ...shadows.card },
  pressed: { transform: [{ scale: 0.96 }], opacity: 0.85 },
  hero: { marginTop: 25, height: 250, borderRadius: 30, overflow: 'hidden', flexDirection: 'row', ...shadows.card },
  heroPressed: { transform: [{ scale: 0.992 }] },
  heroCopy: { flex: 1, padding: 24, justifyContent: 'space-between', zIndex: 2 },
  heroCover: { width: 116, justifyContent: 'center', transform: [{ rotate: '4deg' }, { translateX: 6 }] },
  heroEyebrow: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginBottom: 11 },
  heroTitle: { color: '#FBF9F3', fontFamily: typography.serif, fontSize: 27, lineHeight: 31, fontWeight: '700', letterSpacing: -0.7 },
  heroAuthor: { color: 'rgba(255,255,255,0.52)', fontSize: 12, marginTop: 8 },
  progressTrack: { width: '100%', height: 3, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' },
  progressFill: { height: 3, borderRadius: 4, backgroundColor: colors.accent },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 13 },
  progressText: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '600' },
  continuePill: { flexDirection: 'row', gap: 5, alignItems: 'center', backgroundColor: '#F8F4EA', borderRadius: radii.pill, paddingHorizontal: 13, paddingVertical: 8 },
  continueText: { color: colors.ink, fontWeight: '700', fontSize: 12 },
  sectionHeader: { marginTop: 30, marginBottom: 14, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle: { color: colors.ink, fontFamily: typography.serif, fontWeight: '700', fontSize: 22, letterSpacing: -0.4 },
  sectionCaption: { color: colors.inkMuted, fontSize: 11 },
  link: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  metrics: { flexDirection: 'row', gap: 10 },
  metricCard: { flex: 1, minHeight: 118, borderRadius: radii.medium, padding: 14, justifyContent: 'space-between' },
  metricWarm: { backgroundColor: colors.accentSoft },
  metricSage: { backgroundColor: colors.sageSoft },
  metricBlue: { backgroundColor: '#DFE7EF' },
  metricValue: { color: colors.ink, fontFamily: typography.serif, fontSize: 26, fontWeight: '700' },
  metricLabel: { color: colors.inkMuted, fontSize: 11, fontWeight: '600' },
  bookRow: { gap: 15, paddingBottom: 8, paddingRight: 10 },
  bookItem: { width: 116, gap: 7 },
  bookTitle: { color: colors.ink, fontSize: 13, fontWeight: '700', lineHeight: 17 },
  bookProgress: { color: colors.inkMuted, fontSize: 10, fontWeight: '600' },
  importCard: { width: 116, height: 168, backgroundColor: 'rgba(255,255,255,0.5)', borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed', borderRadius: radii.medium, alignItems: 'center', justifyContent: 'center' },
  importIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  importTitle: { color: colors.ink, fontWeight: '700', fontSize: 12 },
  importBody: { color: colors.inkMuted, fontSize: 10, marginTop: 4 },
  privacyNote: { marginTop: 30, padding: 18, borderRadius: radii.medium, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
  privacyTitle: { color: colors.ink, fontWeight: '700', fontSize: 13, marginBottom: 5 },
  privacyBody: { color: colors.inkMuted, fontSize: 11, lineHeight: 17 },
});
