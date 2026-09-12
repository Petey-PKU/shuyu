import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { InlineNotice } from '../components/InlineNotice';
import { colors, radii, shadows, typography } from '../theme';
import { isWordDue } from '../utils/review';

type Props = CompositeScreenProps<BottomTabScreenProps<MainTabParamList, 'Today'>, NativeStackScreenProps<RootStackParamList>>;

function greeting() {
  const hour = new Date().getHours();
  if (hour < 11) return '早上好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { books, stats, words, preferences, importBook } = useApp();
  const [importError, setImportError] = useState<string | null>(null);
  const current = [...books].sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt))[0];
  const currentCompleted = !!current && current.progress >= 1;
  const recentBooks = [...books].sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt)).slice(0, 5);
  const activeWords = words.filter((word) => !word.mastered).length;
  const dueWords = words.filter((word) => !word.mastered && isWordDue(word.nextReviewAt, Date.now())).length;
  const isSampleOnly = books.length === 1 && books[0].format === 'sample';
  const today = localDateKey(new Date());
  const yesterday = localDateKey(new Date(Date.now() - 86_400_000));
  const displayedStreak = stats.lastReadDate === today || stats.lastReadDate === yesterday ? stats.streak : 0;
  const displayedTodayMinutes = stats.todayDate === today ? stats.todayMinutes : 0;
  const goalCaption = displayedTodayMinutes >= preferences.dailyGoalMinutes
    ? '今日目标已完成'
    : `${displayedTodayMinutes}/${preferences.dailyGoalMinutes} 分钟目标`;
  const openBook = (book: typeof current) => {
    if (!book) return;
    navigation.navigate('Reader', book.progress >= 1
      ? { bookId: book.id, chapterIndex: 0, paragraphIndex: 0, replay: true }
      : { bookId: book.id });
  };

  const handleImport = async () => {
    try {
      const book = await importBook();
      setImportError(null);
      if (book) navigation.navigate('Reader', { bookId: book.id });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : '请确认文件格式后重试');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + 18 }]} showsVerticalScrollIndicator={false}>
      <PageHeader
        eyebrow="书语 · 语境阅读"
        title={greeting()}
        right={
          <Pressable accessibilityRole="button" accessibilityLabel="导入电子书" onPress={handleImport} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
            <Ionicons name="add" size={25} color={colors.ink} />
          </Pressable>
        }
      />
      {importError ? <InlineNotice message={importError} actionLabel="重试导入" onAction={() => void handleImport()} onDismiss={() => setImportError(null)} /> : null}

      {isSampleOnly ? (
        <View style={styles.welcomeCard}>
          <View style={styles.welcomeIcon}><Ionicons name="sparkles-outline" size={20} color={colors.accent} /></View>
          <View style={styles.welcomeCopy}>
            <Text style={styles.welcomeTitle}>这是一本体验书</Text>
            <Text style={styles.welcomeBody}>先试试点词查义；准备好后，导入自己的英文书继续阅读。</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="导入自己的英文书" onPress={handleImport} style={styles.welcomeButton}><Text style={styles.welcomeButtonText}>导入</Text></Pressable>
        </View>
      ) : null}

      {current ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${currentCompleted ? '重读' : '继续上次阅读'}：${current.title}`} onPress={() => openBook(current)} style={({ pressed }) => [styles.hero, pressed && styles.heroPressed]}>
          <LinearGradient colors={['#242520', '#171815']} style={StyleSheet.absoluteFill} />
          <View style={styles.heroCopy}>
            <View>
              <Text style={styles.heroEyebrow}>{currentCompleted ? '已读完 · 重读' : '继续阅读'}</Text>
              <Text numberOfLines={3} style={styles.heroTitle}>{current.title}</Text>
              <Text numberOfLines={1} style={styles.heroAuthor}>{current.author}</Text>
            </View>
            <View>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(3, current.progress * 100)}%` }]} /></View>
              <View style={styles.progressMeta}>
                <Text style={styles.progressText}>{Math.round(current.progress * 100)}%</Text>
                <View style={styles.continuePill}>
                  <Text style={styles.continueText}>{currentCompleted ? '重读' : '继续'}</Text>
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
        <Text style={styles.sectionCaption}>{goalCaption}</Text>
      </View>
      <View style={styles.metrics}>
        <View style={[styles.metricCard, styles.metricWarm]}>
          <Ionicons name="flame-outline" size={21} color={colors.accent} />
          <Text style={styles.metricValue}>{displayedStreak}</Text>
          <Text style={styles.metricLabel}>连续天数</Text>
        </View>
        <View style={[styles.metricCard, styles.metricSage]}>
          <Ionicons name="time-outline" size={21} color={colors.sage} />
          <Text style={styles.metricValue}>{displayedTodayMinutes}</Text>
          <Text style={styles.metricLabel}>今日分钟</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`${dueWords ? '开始复习' : '打开生词本'}，${activeWords} 个学习中${dueWords ? `，${dueWords} 个今天到期` : ''}`} onPress={() => dueWords ? navigation.navigate('Review') : navigation.navigate('Vocabulary')} style={[styles.metricCard, styles.metricBlue]}>
          <Ionicons name="sparkles-outline" size={21} color={colors.blue} />
          <Text style={styles.metricValue}>{activeWords}</Text>
          <Text style={styles.metricLabel}>待掌握词</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>最近书页</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="查看全部书籍" onPress={() => navigation.navigate('Library')}><Text style={styles.link}>查看全部</Text></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bookRow}>
        {recentBooks.map((book) => (
          <Pressable key={book.id} accessibilityRole="button" accessibilityLabel={`${book.progress >= 1 ? '重读' : '继续阅读'}《${book.title}》`} onPress={() => openBook(book)} style={styles.bookItem}>
            <BookCover book={book} width={116} compact />
            <Text numberOfLines={2} style={styles.bookTitle}>{book.title}</Text>
            <Text style={styles.bookProgress}>{Math.round(book.progress * 100)}% · {book.format.toUpperCase()}</Text>
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" accessibilityLabel="导入新书" onPress={handleImport} style={styles.importCard}>
          <View style={styles.importIcon}><Ionicons name="document-text-outline" size={25} color={colors.accent} /></View>
          <Text style={styles.importTitle}>导入新书</Text>
          <Text style={styles.importBody}>TXT · EPUB · MOBI · AZW3 · PDF</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.privacyNote}>
        <Ionicons name="shield-checkmark-outline" size={20} color={colors.sage} />
        <View style={{ flex: 1 }}>
          <Text style={styles.privacyTitle}>书籍留在你的设备</Text>
          <Text style={styles.privacyBody}>书籍正文保存在设备。开启在线增强后，未收录单词与主动请求翻译的句子可能发送给第三方服务。</Text>
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
  welcomeCard: { marginTop: 18, padding: 14, borderRadius: radii.medium, backgroundColor: colors.sageSoft, flexDirection: 'row', alignItems: 'center', gap: 11 },
  welcomeIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center' },
  welcomeCopy: { flex: 1 },
  welcomeTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  welcomeBody: { color: colors.inkMuted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  welcomeButton: { borderRadius: radii.pill, backgroundColor: colors.ink, paddingHorizontal: 13, paddingVertical: 9 },
  welcomeButtonText: { color: '#fff', fontSize: 10, fontWeight: '800' },
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
