import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii } from '../theme';

export function InlineNotice({ message, actionLabel, onAction, onDismiss, tone = 'error', style }: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  tone?: 'error' | 'success';
  style?: StyleProp<ViewStyle>;
}) {
  const success = tone === 'success';
  return (
    <View accessibilityRole="alert" style={[styles.notice, success && styles.noticeSuccess, style]}>
      <Ionicons name={success ? 'checkmark-circle-outline' : 'alert-circle-outline'} size={19} color={success ? colors.sage : colors.danger} />
      <Text style={[styles.message, success && styles.successMessage]}>{message}</Text>
      {onAction && actionLabel ? <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} style={[styles.action, success && styles.successAction]}><Text style={[styles.actionText, success && styles.successActionText]}>{actionLabel}</Text></Pressable> : null}
      {onDismiss ? <Pressable accessibilityRole="button" accessibilityLabel="关闭提示" onPress={onDismiss} hitSlop={8} style={styles.close}><Ionicons name="close" size={16} color={colors.inkMuted} /></Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { marginHorizontal: 20, marginTop: 12, paddingHorizontal: 13, paddingVertical: 11, borderRadius: radii.medium, backgroundColor: 'rgba(217,95,89,0.1)', flexDirection: 'row', alignItems: 'center', gap: 8 },
  noticeSuccess: { backgroundColor: 'rgba(95,125,102,0.12)' },
  message: { flex: 1, color: colors.ink, fontSize: 11, lineHeight: 17 },
  successMessage: { color: colors.ink },
  action: { minHeight: 30, paddingHorizontal: 9, borderRadius: radii.pill, backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: colors.danger, fontSize: 10, fontWeight: '800' },
  successAction: { backgroundColor: colors.surfaceStrong },
  successActionText: { color: colors.sage },
  close: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
});
