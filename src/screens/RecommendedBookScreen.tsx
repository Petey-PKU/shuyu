import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RecommendedBookCover } from '../components/RecommendedBookCover';
import { InlineNotice } from '../components/InlineNotice';
import { useApp } from '../context/AppContext';
import { recommendedBookById } from '../data/recommendedBooks';
import type { RootStackParamList } from '../navigation/types';
import type { DifficultyFeedback } from '../types';
import { effectiveReadingScore, genreLabels, recommendationMatchLabel } from '../services/recommendation';
import { colors, radii, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'RecommendedBook'>;

const lengthLabels = { short: '短篇', medium: '中等篇幅', long: '长篇' } as const;
const feedbackOptions: { value: DifficultyFeedback; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'easy', label: '偏简单', icon: 'leaf-outline' },
  { value: 'right', label: '正合适', icon: 'checkmark-circle-outline' },
  { value: 'hard', label: '有点难', icon: 'trending-up-outline' },
];

export function RecommendedBookScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const book = recommendedBookById.get(route.params.bookId);
  const [importError, setImportError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const {
    books,
    recommendationState,
    readingSignals,
    importBook,
    toggleSavedRecommendedBook,
    setRecommendedBookFeedback,
  } = useApp();

  if (!book) return null;
  const saved = recommendationState.savedBookIds.includes(book.id);
  const feedback = recommendationState.feedback[book.id];
  const targetScore = effectiveReadingScore(recommendationState, readingSignals, books);

  const handleImport = async () => {
    try {
      const imported = await importBook();
      setImportError(null);
      if (imported) navigation.replace('Reader', { bookId: imported.id });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : '请确认文件格式后重试');
    }
  };

  const handleToggleSaved = async () => {
    const wasSaved = recommendationState.savedBookIds.includes(book.id);
    setSaveNotice(null);
    try {
      await toggleSavedRecommendedBook(book.id);
      setSaveNotice({ tone: 'success', message: wasSaved ? '已从想读移除' : '已加入想读' });
    } catch {
      setSaveNotice({ tone: 'error', message: wasSaved ? '本次会话已移除，但设备保存失败，请稍后重试保存。' : '本次会话已加入，但设备保存失败，请稍后重试保存。' });
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 34 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="返回" onPress={() => navigation.goBack()} style={styles.iconButton}><Ionicons name="chevron-back" size={23} color={colors.ink} /></Pressable>
        <Text style={styles.topTitle}>选书详情</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={saved ? '移出想读' : '加入想读'} accessibilityState={{ selected: saved }} onPress={() => void handleToggleSaved()} style={[styles.iconButton, saved && styles.savedIconButton]}><Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={saved ? '#fff' : colors.ink} /></Pressable>
      </View>
      {importError ? <InlineNotice message={importError} actionLabel="重试导入" onAction={() => void handleImport()} onDismiss={() => setImportError(null)} /> : null}
      {saveNotice ? <InlineNotice tone={saveNotice.tone} message={saveNotice.message} onDismiss={() => setSaveNotice(null)} /> : null}

      <View style={styles.hero}>
        <RecommendedBookCover book={book} width={150} />
        <View style={styles.heroCopy}>
          <View style={styles.levelPill}><Text style={styles.levelPillText}>{book.level} · {recommendationMatchLabel(book, targetScore)}</Text></View>
          <Text style={styles.title}>{book.title}</Text>
          <Text style={styles.author}>{book.author}</Text>
          <Text style={styles.edition}>{book.edition}</Text>
        </View>
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}><Text style={styles.metricValue}>{book.difficulty}</Text><Text style={styles.metricLabel}>难度分</Text></View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}><Text style={styles.metricValue}>{lengthLabels[book.length]}</Text><Text style={styles.metricLabel}>阅读篇幅</Text></View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}><Text style={styles.metricValue}>{book.genres.length}</Text><Text style={styles.metricLabel}>主题标签</Text></View>
      </View>

      <Text style={styles.sectionLabel}>内容简介</Text>
      <Text style={styles.body}>{book.summary}</Text>
      <Text style={styles.sectionLabel}>为什么推荐</Text>
      <View style={styles.reasonCard}><Ionicons name="sparkles" size={20} color={colors.accent} /><Text style={styles.reasonText}>{book.fitReason}</Text></View>
      <View style={styles.tagRow}>{book.genres.map((genre) => <View key={genre} style={styles.tag}><Text style={styles.tagText}>{genreLabels[genre]}</Text></View>)}</View>

      <Text style={styles.sectionLabel}>读过之后告诉我</Text>
      <Text style={styles.feedbackHint}>你的判断会调整后续推荐，但不会直接改变测试等级。</Text>
      <View style={styles.feedbackRow}>
        {feedbackOptions.map((option) => {
          const selected = feedback === option.value;
          return <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={`反馈：${option.label}`} accessibilityState={{ selected }} onPress={() => { void setRecommendedBookFeedback(book.id, option.value).catch(() => undefined); }} style={[styles.feedbackButton, selected && styles.feedbackSelected]}><Ionicons name={option.icon} size={18} color={selected ? '#fff' : colors.inkMuted} /><Text style={[styles.feedbackText, selected && styles.feedbackTextSelected]}>{option.label}</Text></Pressable>;
        })}
      </View>

      <View style={styles.sourceBoundary}>
        <Ionicons name="shield-checkmark-outline" size={22} color={colors.sage} />
        <View style={{ flex: 1 }}><Text style={styles.sourceTitle}>获取方式由你决定</Text><Text style={styles.sourceBody}>{Platform.OS === 'web' ? '本页不提供下载、购买或试读入口。请只导入你有权使用的 TXT、无 DRM EPUB/MOBI/AZW3/KF8；PDF 与 OCR 请使用正式 Android 安装包。' : '本页不提供下载、购买或试读入口。请只导入你有权使用的 TXT、无 DRM EPUB/MOBI/AZW3/KF8，以及数字文本型或英文扫描版 PDF。'}</Text></View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="导入自己的文件开始阅读" onPress={handleImport} style={styles.importButton}><Ionicons name="document-text-outline" size={18} color="#fff" /><Text style={styles.importText}>我已有文件，导入阅读</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 20 },
  topBar: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center' },
  savedIconButton: { backgroundColor: colors.accent },
  topTitle: { color: colors.inkMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  hero: { marginTop: 22, flexDirection: 'row', alignItems: 'center', gap: 21 },
  heroCopy: { flex: 1 },
  levelPill: { alignSelf: 'flex-start', backgroundColor: colors.accentSoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  levelPillText: { color: colors.accent, fontSize: 9, fontWeight: '900' },
  title: { color: colors.ink, fontFamily: typography.serif, fontSize: 25, lineHeight: 30, fontWeight: '700', marginTop: 13, letterSpacing: -0.5 },
  author: { color: colors.inkMuted, fontSize: 11, marginTop: 9 },
  edition: { color: colors.accent, fontSize: 9, lineHeight: 14, fontWeight: '800', marginTop: 9 },
  metrics: { minHeight: 78, marginTop: 26, borderRadius: radii.large, backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center' },
  metric: { flex: 1, alignItems: 'center' },
  metricValue: { color: colors.ink, fontFamily: typography.serif, fontSize: 15, fontWeight: '700' },
  metricLabel: { color: colors.inkMuted, fontSize: 8, marginTop: 4 },
  metricDivider: { width: 1, height: 32, backgroundColor: colors.line },
  sectionLabel: { color: colors.inkMuted, fontSize: 9, fontWeight: '900', letterSpacing: 1.3, marginTop: 28, marginBottom: 10 },
  body: { color: colors.ink, fontFamily: typography.serif, fontSize: 16, lineHeight: 27 },
  reasonCard: { padding: 17, borderRadius: radii.medium, backgroundColor: colors.accentSoft, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  reasonText: { flex: 1, color: colors.ink, fontSize: 12, lineHeight: 19, fontWeight: '600' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 13 },
  tag: { borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: colors.line, paddingHorizontal: 11, paddingVertical: 7 },
  tagText: { color: colors.inkMuted, fontSize: 9, fontWeight: '700' },
  feedbackHint: { color: colors.inkMuted, fontSize: 10, lineHeight: 16, marginTop: -4, marginBottom: 11 },
  feedbackRow: { flexDirection: 'row', gap: 8 },
  feedbackButton: { flex: 1, minHeight: 64, borderRadius: 17, backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', gap: 6 },
  feedbackSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  feedbackText: { color: colors.inkMuted, fontSize: 9, fontWeight: '800' },
  feedbackTextSelected: { color: '#fff' },
  sourceBoundary: { marginTop: 28, padding: 17, borderRadius: radii.medium, backgroundColor: colors.sageSoft, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  sourceTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  sourceBody: { color: colors.inkMuted, fontSize: 10, lineHeight: 16, marginTop: 5 },
  importButton: { height: 55, borderRadius: radii.medium, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 15 },
  importText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});
