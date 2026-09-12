import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ImportStatus } from '../types';
import { colors, radii, typography } from '../theme';

interface Props {
  status: ImportStatus | null;
  onCancel: () => void;
}

export function ImportOverlay({ status, onCancel }: Props) {
  const isOcr = status?.phase === 'ocr';
  const currentPage = status?.currentPage ?? 0;
  const totalPages = status?.totalPages ?? 0;
  const progress = totalPages > 0 ? Math.min(1, currentPage / totalPages) : 0;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!status) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [status?.startedAt]);

  const elapsedSeconds = status?.startedAt ? Math.max(0, Math.floor((now - status.startedAt) / 1000)) : 0;
  const elapsedLabel = elapsedSeconds >= 60
    ? `${Math.floor(elapsedSeconds / 60)} 分 ${elapsedSeconds % 60} 秒`
    : `${elapsedSeconds} 秒`;

  return (
    <Modal
      transparent
      visible={status !== null}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop} accessibilityViewIsModal>
        <View accessibilityRole="alert" style={styles.card}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.title}>{isOcr ? '正在识别扫描页' : '正在整理书页'}</Text>
          {isOcr ? (
            <>
              <Text style={styles.pageCount}>
                {status?.cancelling ? '正在停止…' : currentPage > 0 ? `第 ${currentPage} / ${totalPages} 页` : `准备识别 ${totalPages} 页`}
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
              </View>
              <Text style={styles.body}>
                英文 OCR 完全在本机进行。请保持应用在前台，识别完成后会自动整理为连续正文。
              </Text>
              {(status?.skippedPages ?? 0) > 0 ? (
                <Text style={styles.warning}>已有 {status?.skippedPages} 页未能识别，将继续处理后续页面。</Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="停止 PDF 文字识别"
                disabled={status?.cancelling}
                onPress={onCancel}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed, status?.cancelling && styles.disabled]}
              >
                <Text style={styles.cancelText}>{status?.cancelling ? '正在停止' : '停止识别'}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.body}>{status?.cancelling ? '正在取消导入，请稍候…' : <>本地解析章节与文字，书籍原文不会上传。已用时 {elapsedLabel}；大型文件可能需要更久，请保持应用在前台。</>}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="取消电子书导入"
                disabled={status?.cancelling}
                onPress={onCancel}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed, status?.cancelling && styles.disabled]}
              >
                <Text style={styles.cancelText}>{status?.cancelling ? '正在取消' : '取消导入'}</Text>
              </Pressable>
            </>
          )}
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
  pageCount: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  progressTrack: { width: '100%', height: 6, borderRadius: 6, backgroundColor: colors.line, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 6, backgroundColor: colors.accent },
  warning: { color: '#A15235', fontSize: 11, lineHeight: 17, textAlign: 'center' },
  cancelButton: { minWidth: 128, height: 42, paddingHorizontal: 20, borderRadius: 21, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  cancelText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.52 },
});
