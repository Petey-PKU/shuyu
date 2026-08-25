import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import type { RootStackParamList } from '../navigation/types';
import { colors, radii, shadows, typography } from '../theme';
import { speakEnglish } from '../services/speech';

type Props = NativeStackScreenProps<RootStackParamList, 'Review'>;

export function ReviewScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { words, preferences, toggleMastered } = useApp();
  const queue = words.filter((word) => !word.mastered);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const current = queue[index];

  if (!current) {
    return <View style={[styles.done, { paddingTop: insets.top }]}><View style={styles.doneIcon}><Ionicons name="checkmark" size={34} color="#fff" /></View><Text style={styles.doneTitle}>今天到这里</Text><Text style={styles.doneBody}>词汇需要在故事中反复相遇。明天再来看看它们。</Text><Pressable onPress={() => navigation.goBack()} style={styles.doneButton}><Text style={styles.doneButtonText}>返回生词本</Text></Pressable></View>;
  }

  const next = async (mastered: boolean) => {
    if (mastered) await toggleMastered(current.id);
    setRevealed(false);
    setIndex((value) => value + 1);
  };

  const cloze = current.context.replace(new RegExp(`\\b${current.word}\\b`, 'i'), '______');

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 18 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.close}><Ionicons name="close" size={24} color={colors.ink} /></Pressable>
        <Text style={styles.counter}>{index + 1} / {queue.length}</Text>
        <View style={styles.close} />
      </View>
      <View style={styles.progress}><View style={[styles.progressFill, { width: `${((index + 1) / queue.length) * 100}%` }]} /></View>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>回到原句</Text>
        <Text style={styles.context}>{revealed ? current.context : cloze}</Text>
        {revealed ? (
          <View style={styles.answer}>
            <View style={styles.answerRow}><Text style={styles.word}>{current.word}</Text><Pressable onPress={() => void speakEnglish(current.word, 'word', preferences.speechVoice)}><Ionicons name="volume-medium" size={21} color={colors.accent} /></Pressable></View>
            <Text style={styles.meaning}>{current.meaning}</Text>
            {current.contextTranslation ? <Text style={styles.translation}>{current.contextTranslation}</Text> : null}
          </View>
        ) : (
          <Pressable onPress={() => setRevealed(true)} style={styles.reveal}><Text style={styles.revealText}>轻触查看答案</Text></Pressable>
        )}
        <Text style={styles.source}>{current.bookTitle}</Text>
      </View>
      {revealed ? (
        <View style={styles.actions}>
          <Pressable onPress={() => next(false)} style={[styles.action, styles.again]}><Ionicons name="refresh" size={19} color={colors.ink} /><Text style={styles.againText}>再看看</Text></Pressable>
          <Pressable onPress={() => next(true)} style={[styles.action, styles.know]}><Ionicons name="checkmark" size={20} color="#fff" /><Text style={styles.knowText}>记住了</Text></Pressable>
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
  actions: { flexDirection: 'row', gap: 12 },
  action: { flex: 1, height: 54, borderRadius: radii.medium, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  again: { backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.line },
  know: { backgroundColor: colors.ink },
  againText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  knowText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  done: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 38 },
  doneIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  doneTitle: { color: colors.ink, fontFamily: typography.serif, fontSize: 30, fontWeight: '700' },
  doneBody: { color: colors.inkMuted, fontSize: 13, lineHeight: 21, textAlign: 'center', marginTop: 10 },
  doneButton: { backgroundColor: colors.ink, borderRadius: radii.pill, paddingHorizontal: 22, paddingVertical: 13, marginTop: 26 },
  doneButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
