import React from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { colors, radii, typography } from '../theme';

export function ImportOverlay({ visible }: { visible: boolean }) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.title}>正在整理书页</Text>
          <Text style={styles.body}>本地解析章节与文字，书籍原文不会上传。</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,21,18,0.42)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  card: { width: '100%', maxWidth: 320, backgroundColor: colors.surfaceStrong, borderRadius: radii.large, padding: 30, alignItems: 'center', gap: 13 },
  title: { marginTop: 5, fontFamily: typography.serif, fontSize: 22, fontWeight: '700', color: colors.ink },
  body: { fontSize: 13, lineHeight: 20, color: colors.inkMuted, textAlign: 'center' },
});
