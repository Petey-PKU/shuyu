import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import type { RootStackParamList } from '../navigation/types';
import { colors, radii, shadows, typography } from '../theme';
import { speakEnglish } from '../services/speech';
import { InlineNotice } from '../components/InlineNotice';
import { escapeRegExp, isWordDue, nextReviewTime, reviewDelayLabel } from '../utils/review';

type Props = NativeStackScreenProps<RootStackParamList, 'Review'>;

function sourceLocation(chapterIndex?: number, paragraphIndex?: number) {
  if (chapterIndex === undefined || paragraphIndex === undefined) return '';
  return `第 ${chapterIndex + 1} 章 · 第 ${paragraphIndex + 1} 段`;
}

export function ReviewScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { words, preferences, toggleMastered, deferWord, retryPersistence } = useApp();
  const now = Date.now();
  const [reviewQueueIds] = useState(() => words.filter((word) => !word.mastered && isWordDue(word.nextReviewAt, now)).map((word) => word.id));
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  const [masteredCount, setMasteredCount] = useState(0);
  const [deferredCount, setDeferredCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [pendingReview, setPendingReview] = useState<{ id: string; mastered: boolean } | null>(null);
  const submittingRef = useRef(false);
  const queue = reviewQueueIds.reduce<typeof words>((items, id) => {
    const word = words.find((item) => item.id === id);
    if (word && !reviewedIds.includes(word.id)) items.push(word);
    return items;
  }, []);
  const total = reviewQueueIds.length;
  const [revealed, setRevealed] = useState(false);
  const current = queue[0];
  const nextReviewAt = nextReviewTime(words);
  const returnTo = route.params?.returnTo === 'Today' ? 'Today' : 'Vocabulary';
  const returnLabel = returnTo === 'Today' ? '返回今天' : '返回生词本';
  const speakWord = (word: string) => {
    setSpeechError(null);
    void speakEnglish(word, 'word', preferences.speechVoice)
      .then((provider) => { if (provider === 'system-fallback') setSpeechError('内置离线音色暂不可用，当前使用系统英语音色；可在设置中切换或稍后重试。'); })
      .catch(() => setSpeechError('朗读暂时不可用，请检查设备音量或系统英语音色。'));
  };

  if (!current) {
    return <View style={[styles.done, { paddingTop: insets.top }]}><View style={styles.doneIcon}><Ionicons name="checkmark" size={34} color="#fff" /></View><Text accessibilityRole="header" style={styles.doneTitle}>本轮已完成</Text><Text style={styles.doneBody}>本轮复习了 {reviewedIds.length} 个词：记住了 {masteredCount} 个，稍后再看 {deferredCount} 个。{nextReviewAt ? `下次复习：${reviewDelayLabel(nextReviewAt)}。` : '继续阅读，在故事中遇见更多词汇。'}</Text><Pressable accessibilityRole="button" accessibilityLabel="继续阅读" onPress={() => navigation.navigate('Main', { screen: 'Today' })} style={styles.doneButton}><Text style={styles.doneButtonText}>继续阅读</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={returnLabel} onPress={() => navigation.navigate('Main', { screen: returnTo })} style={styles.doneSecondary}><Text style={styles.doneSecondaryText}>{returnLabel}</Text></Pressable></View>;
  }

  const completeReview = (id: string, mastered: boolean) => {
    if (mastered) setMasteredCount((count) => count + 1);
    else setDeferredCount((count) => count + 1);
    setReviewedIds((ids) => ids.includes(id) ? ids : [...ids, id]);
    setPendingReview(null);
    setRevealed(false);
  };

  const next = async (mastered: boolean) => {
    if (submittingRef.current) return;
    const currentId = current.id;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      if (mastered) await toggleMastered(current.id);
      else await deferWord(current.id);
      completeReview(currentId, mastered);
    } catch {
      // Keep the card and the chosen answer visible until the local write can
      // be retried; advancing here would make a failed result look complete.
      setPendingReview({ id: currentId, mastered });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const retryPendingReview = async () => {
    if (!pendingReview || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      if (await retryPersistence()) completeReview(pendingReview.id, pendingReview.mastered);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const cloze = current.context.replace(new RegExp(`\\b${escapeRegExp(current.word)}\\b`, 'i'), '______');

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 18 }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="退出复习" onPress={() => navigation.goBack()} style={styles.close}><Ionicons name="close" size={24} color={colors.ink} /></Pressable>
        <Text style={styles.counter}>{Math.min(reviewedIds.length + 1, total)} / {total}</Text>
        <View style={styles.close} />
      </View>
      <View style={styles.progress}><View style={[styles.progressFill, { width: `${total ? ((reviewedIds.length + 1) / total) * 100 : 0}%` }]} /></View>
      {speechError ? <InlineNotice message={speechError} onDismiss={() => setSpeechError(null)} /> : null}
      {pendingReview ? <InlineNotice message="本次复习结果已保留，但设备尚未保存。" actionLabel={submitting ? '保存中…' : '重试保存'} onAction={() => void retryPendingReview()} /> : null}
      <View style={styles.card}>
        <Text style={styles.eyebrow}>回到原句</Text>
        <Text style={styles.context}>{revealed ? current.context : cloze}</Text>
        {revealed ? (
          <View style={styles.answer}>
            <View style={styles.answerRow}><Text style={styles.word}>{current.word}</Text><Pressable accessibilityRole="button" accessibilityLabel={`朗读${current.word}`} onPress={() => speakWord(current.word)}><Ionicons name="volume-medium" size={21} color={colors.accent} /></Pressable></View>
            <Text style={styles.meaning}>{current.meaning}</Text>
            {current.contextTranslation ? <Text style={styles.translation}>{current.contextTranslation}</Text> : null}
          </View>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="查看答案" onPress={() => setRevealed(true)} style={styles.reveal}><Text style={styles.revealText}>轻触查看答案</Text></Pressable>
        )}
        <Pressable accessibilityRole="button" accessibilityLabel={`回到${current.bookTitle}${sourceLocation(current.chapterIndex, current.paragraphIndex) ? `，${sourceLocation(current.chapterIndex, current.paragraphIndex)}` : ''}原文`} onPress={() => navigation.navigate('Reader', { bookId: current.bookId, chapterIndex: current.chapterIndex, paragraphIndex: current.paragraphIndex, returnTo })} style={styles.sourceButton}>
          <Text style={styles.source}>{current.bookTitle}{sourceLocation(current.chapterIndex, current.paragraphIndex) ? ` · ${sourceLocation(current.chapterIndex, current.paragraphIndex)}` : ''} · 回到原文</Text>
          <Ionicons name="arrow-forward" size={13} color={colors.accent} />
        </Pressable>
      </View>
      {revealed && !pendingReview ? (
        <View style={styles.actions}>
          <Pressable disabled={submitting} accessibilityRole="button" accessibilityLabel="稍后再次复习" accessibilityState={{ disabled: submitting }} onPress={() => void next(false)} style={[styles.action, styles.again, submitting && styles.actionDisabled]}><Ionicons name="refresh" size={19} color={colors.ink} /><Text style={styles.againText}>再看看</Text></Pressable>
          <Pressable disabled={submitting} accessibilityRole="button" accessibilityLabel="标记为已掌握" accessibilityState={{ disabled: submitting }} onPress={() => void next(true)} style={[styles.action, styles.know, submitting && styles.actionDisabled]}><Ionicons name="checkmark" size={20} color="#fff" /><Text style={styles.knowText}>记住了</Text></Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  counter: { color: colors.inkMuted, fontSize: 11, fontWeight: '700' },
  progress: { height: 3, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.07)', overflow: 'hidden', marginTop: 8 },
  progressFill: { height: 3, backgroundColor: colors.accent, borderRadius: 3 },
  card: { flex: 1, marginVertical: 30, backgroundColor: colors.surfaceStrong, borderRadius: 32, padding: 28, justifyContent: 'center', ...shadows.card },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, textAlign: 'center', marginBottom: 26 },
  context: { color: colors.ink, fontFamily: typography.serif, fontSize: 25, lineHeight: 38, textAlign: 'center', letterSpacing: -0.25 },
  reveal: { alignSelf: 'center', marginTop: 28, backgroundColor: colors.canvas, borderRadius: radii.pill, paddingHorizontal: 18, paddingVertical: 11 },
  revealText: { color: colors.inkMuted, fontSize: 11, fontWeight: '700' },
  answer: { marginTop: 30, paddingTop: 24, borderTopWidth: 1, borderTopColor: colors.line },
  answerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  word: { color: colors.ink, fontFamily: typography.serif, fontSize: 31, fontWeight: '700' },
  meaning: { color: colors.ink, fontSize: 15, fontWeight: '700', textAlign: 'center', marginTop: 10 },
  translation: { color: colors.inkMuted, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 12 },
  source: { color: colors.inkMuted, fontSize: 9, textAlign: 'center', marginTop: 28 },
  sourceButton: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 28 },
  actions: { flexDirection: 'row', gap: 12 },
  action: { flex: 1, height: 54, borderRadius: radii.medium, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  again: { backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.line },
  know: { backgroundColor: colors.ink },
  againText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  knowText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  actionDisabled: { opacity: 0.56 },
  done: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 38 },
  doneIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  doneTitle: { color: colors.ink, fontFamily: typography.serif, fontSize: 30, fontWeight: '700' },
  doneBody: { color: colors.inkMuted, fontSize: 13, lineHeight: 21, textAlign: 'center', marginTop: 10 },
  doneButton: { backgroundColor: colors.ink, borderRadius: radii.pill, paddingHorizontal: 22, paddingVertical: 13, marginTop: 26 },
  doneButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  doneSecondary: { paddingHorizontal: 22, paddingVertical: 12, marginTop: 3 },
  doneSecondaryText: { color: colors.inkMuted, fontSize: 12, fontWeight: '800' },
});
