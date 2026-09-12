import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { assessmentQuestions, scoreAssessment } from '../data/assessment';
import { useApp } from '../context/AppContext';
import type { RootStackParamList } from '../navigation/types';
import type { ReadingLevelProfile } from '../types';
import { levelLabels } from '../services/recommendation';
import { colors, radii, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'LevelAssessment'>;

const confidenceLabels = { low: '初步判断', medium: '可信度中等', high: '可信度较高' } as const;

export function LevelAssessmentScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { setReadingProfile } = useApp();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<ReadingLevelProfile | null>(null);
  const [answering, setAnswering] = useState(false);
  const [exitVisible, setExitVisible] = useState(false);
  const answeringRef = useRef(false);
  const allowExitRef = useRef(false);
  const question = assessmentQuestions[questionIndex];

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowExitRef.current || result || !Object.keys(answers).length) return;
      event.preventDefault();
      setExitVisible(true);
    });
    return unsubscribe;
  }, [answers, navigation, result]);

  const requestExit = () => {
    if (answeringRef.current) return;
    if (result || !Object.keys(answers).length) {
      allowExitRef.current = true;
      navigation.goBack();
      return;
    }
    setExitVisible(true);
  };

  const confirmExit = () => {
    allowExitRef.current = true;
    setExitVisible(false);
    navigation.goBack();
  };

  const choose = async (optionIndex: number) => {
    if (answeringRef.current) return;
    answeringRef.current = true;
    setAnswering(true);
    try {
      const next = { ...answers, [question.id]: optionIndex };
      setAnswers(next);
      if (questionIndex < assessmentQuestions.length - 1) {
        setQuestionIndex(questionIndex + 1);
        return;
      }
      const profile = scoreAssessment(next);
      try {
        await setReadingProfile(profile);
      } catch {
        // The optimistic profile is still usable; AppShell exposes the retry action.
      } finally {
        // The optimistic profile is already available in memory; show the result even
        // when the persistence layer reports a recoverable write failure.
        setResult(profile);
      }
    } finally {
      answeringRef.current = false;
      setAnswering(false);
    }
  };

  const restart = () => {
    setAnswers({});
    setQuestionIndex(0);
    setResult(null);
  };

  if (result) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={[styles.resultContent, { paddingTop: insets.top + 26, paddingBottom: insets.bottom + 30 }]}>
        <View style={styles.resultOrb}><Text style={styles.resultLevel}>{result.level}</Text></View>
        <Text style={styles.eyebrow}>{confidenceLabels[result.confidence]}</Text>
        <Text style={styles.resultTitle}>{levelLabels[result.level]}</Text>
        <Text style={styles.resultBody}>推荐会从与你当前水平接近的书开始，并保留少量轻松读物和进阶挑战。之后还会参考本地阅读中的查词频率进行微调。</Text>
        <View style={styles.scoreCard}>
          <View><Text style={styles.scoreLabel}>阅读适配分</Text><Text style={styles.scoreHint}>用于排序，不是考试成绩</Text></View>
          <Text style={styles.scoreValue}>{result.score}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="查看我的推荐" onPress={() => navigation.goBack()} style={styles.primaryButton}><Text style={styles.primaryText}>查看我的推荐</Text><Ionicons name="arrow-forward" size={17} color="#fff" /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="重新测试" onPress={restart} style={styles.secondaryButton}><Text style={styles.secondaryText}>重新测试</Text></Pressable>
      </ScrollView>
    );
  }

  const progress = (questionIndex + 1) / assessmentQuestions.length;
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="退出测试" onPress={requestExit} style={styles.iconButton}><Ionicons name="close" size={23} color={colors.ink} /></Pressable>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress * 100}%` }]} /></View>
        <Text style={styles.counter}>{questionIndex + 1}/{assessmentQuestions.length}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.questionContent}>
        <Text style={styles.levelHint}>难度自适应 · {question.level}</Text>
        {question.passage ? <View style={styles.passageCard}><Text style={styles.passage}>{question.passage}</Text></View> : null}
        <Text style={styles.prompt}>{question.prompt}</Text>
        <View style={styles.options}>
          {question.options.map((option, index) => (
            <Pressable key={option} accessibilityRole="button" accessibilityLabel={`选择答案 ${String.fromCharCode(65 + index)}：${option}`} accessibilityState={{ disabled: answering }} disabled={answering} onPress={() => void choose(index)} style={({ pressed }) => [styles.option, pressed && styles.optionPressed, answering && styles.optionDisabled]}>
              <View style={styles.optionLetter}><Text style={styles.optionLetterText}>{String.fromCharCode(65 + index)}</Text></View>
              <Text style={styles.optionText}>{option}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.privacy}>答案与结果只保存在本机。为了避免测试偏差，作答后不立即显示正误。</Text>
      </ScrollView>
      <Modal visible={exitVisible} transparent animationType="fade" onRequestClose={() => setExitVisible(false)}>
        <Pressable style={styles.exitBackdrop} onPress={() => setExitVisible(false)}>
          <Pressable accessibilityViewIsModal style={styles.exitCard} onPress={(event) => event.stopPropagation()}>
            <Text accessibilityRole="header" style={styles.exitTitle}>退出水平测试？</Text>
            <Text style={styles.exitBody}>已完成的作答不会保存为结果，退出后需要重新开始这次测试。</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="退出并放弃当前测试" onPress={confirmExit} style={styles.exitDanger}><Text style={styles.exitDangerText}>退出测试</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="继续当前测试" onPress={() => setExitVisible(false)} style={styles.exitCancel}><Text style={styles.exitCancelText}>继续测试</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  topBar: { height: 54, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 13 },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { flex: 1, height: 5, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.08)', overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 5, backgroundColor: colors.accent },
  counter: { color: colors.inkMuted, fontSize: 10, fontWeight: '700', width: 34, textAlign: 'right' },
  questionContent: { paddingHorizontal: 22, paddingTop: 30, paddingBottom: 40 },
  levelHint: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 18 },
  passageCard: { backgroundColor: colors.surfaceStrong, borderRadius: radii.large, padding: 21, marginBottom: 24, borderWidth: 1, borderColor: colors.line },
  passage: { color: colors.ink, fontFamily: typography.serif, fontSize: 17, lineHeight: 28 },
  prompt: { color: colors.ink, fontFamily: typography.serif, fontSize: 25, lineHeight: 36, fontWeight: '700', letterSpacing: -0.5 },
  options: { gap: 11, marginTop: 30 },
  option: { minHeight: 64, borderRadius: radii.medium, backgroundColor: 'rgba(255,255,255,0.75)', borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 13 },
  optionPressed: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  optionDisabled: { opacity: 0.62 },
  optionLetter: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  optionLetterText: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  optionText: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 21, fontWeight: '600' },
  privacy: { color: colors.inkMuted, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 28, paddingHorizontal: 15 },
  resultContent: { flexGrow: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  resultOrb: { width: 126, height: 126, borderRadius: 63, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginBottom: 26 },
  resultLevel: { color: colors.accent, fontFamily: typography.serif, fontSize: 47, fontWeight: '700' },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  resultTitle: { color: colors.ink, fontFamily: typography.serif, fontSize: 31, fontWeight: '700', marginTop: 9 },
  resultBody: { color: colors.inkMuted, fontSize: 13, lineHeight: 21, textAlign: 'center', marginTop: 16, maxWidth: 390 },
  scoreCard: { width: '100%', marginTop: 28, padding: 18, borderRadius: radii.large, backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scoreLabel: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  scoreHint: { color: colors.inkMuted, fontSize: 9, marginTop: 4 },
  scoreValue: { color: colors.accent, fontFamily: typography.serif, fontSize: 30, fontWeight: '700' },
  primaryButton: { width: '100%', height: 56, borderRadius: radii.medium, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18 },
  primaryText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  secondaryButton: { height: 48, justifyContent: 'center', paddingHorizontal: 20, marginTop: 5 },
  secondaryText: { color: colors.inkMuted, fontSize: 12, fontWeight: '700' },
  exitBackdrop: { flex: 1, backgroundColor: 'rgba(20,21,18,0.48)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  exitCard: { width: '100%', maxWidth: 360, backgroundColor: colors.surfaceStrong, borderRadius: radii.large, padding: 22 },
  exitTitle: { color: colors.ink, fontFamily: typography.serif, fontSize: 23, fontWeight: '700' },
  exitBody: { color: colors.inkMuted, fontSize: 12, lineHeight: 19, marginTop: 9 },
  exitDanger: { minHeight: 46, borderRadius: radii.pill, backgroundColor: 'rgba(217,95,89,0.1)', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  exitDangerText: { color: colors.danger, fontSize: 13, fontWeight: '800' },
  exitCancel: { minHeight: 42, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  exitCancelText: { color: colors.inkMuted, fontSize: 12, fontWeight: '800' },
});
