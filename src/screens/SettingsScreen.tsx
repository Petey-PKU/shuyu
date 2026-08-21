import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { PageHeader } from '../components/PageHeader';
import { colors, radii, typography } from '../theme';

const rows = [
  { icon: 'book-outline', title: '离线英汉词典', caption: 'ECDICT Core · 120,000 词条', status: '已就绪' },
  { icon: 'shield-checkmark-outline', title: '隐私说明', caption: '原文默认只保存在本地' },
  { icon: 'logo-github', title: '开源项目', caption: 'MIT License · 欢迎贡献' },
  { icon: 'information-circle-outline', title: '关于书中语', caption: '版本 1.1.0' },
] as const;

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { preferences, updatePreferences, resetAll } = useApp();

  const confirmReset = () => Alert.alert('清除全部本地数据？', '书籍、阅读进度和生词将从设备永久删除。', [
    { text: '取消', style: 'cancel' },
    { text: '全部清除', style: 'destructive', onPress: resetAll },
  ]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + 18 }]} showsVerticalScrollIndicator={false}>
      <PageHeader eyebrow="LOCAL FIRST" title="阅读偏好" />
      <Text style={styles.sectionLabel}>排版预览</Text>
      <View style={styles.preview}>
        <Text style={[styles.previewText, { fontSize: preferences.fontSize, lineHeight: preferences.lineHeight }]}>Stories let us travel without leaving the quiet of a room.</Text>
      </View>
      <View style={styles.settingCard}>
        <View style={styles.settingRow}>
          <View><Text style={styles.settingTitle}>正文字号</Text><Text style={styles.settingCaption}>{preferences.fontSize}px</Text></View>
          <View style={styles.stepper}>
            <Pressable onPress={() => updatePreferences({ fontSize: Math.max(16, preferences.fontSize - 1), lineHeight: Math.max(27, preferences.lineHeight - 1) })} style={styles.step}><Ionicons name="remove" size={18} color={colors.ink} /></Pressable>
            <Pressable onPress={() => updatePreferences({ fontSize: Math.min(25, preferences.fontSize + 1), lineHeight: Math.min(42, preferences.lineHeight + 1) })} style={styles.step}><Ionicons name="add" size={18} color={colors.ink} /></Pressable>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.settingRow}>
          <View><Text style={styles.settingTitle}>阅读主题</Text><Text style={styles.settingCaption}>纸张、明亮或夜间</Text></View>
          <View style={styles.swatches}>
            {(['paper', 'white', 'night'] as const).map((theme) => (
              <Pressable key={theme} onPress={() => updatePreferences({ theme })} style={[styles.swatch, { backgroundColor: theme === 'paper' ? colors.canvas : theme === 'white' ? '#fff' : colors.night }, preferences.theme === theme && styles.selectedSwatch]}>
                {preferences.theme === theme ? <Ionicons name="checkmark" size={14} color={theme === 'night' ? '#fff' : colors.ink} /> : null}
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.settingRow}>
          <View style={{ flex: 1, paddingRight: 18 }}><Text style={styles.settingTitle}>在线翻译增强</Text><Text style={styles.settingCaption}>关闭后点词全程离线，仅显示词典释义</Text></View>
          <Switch
            value={preferences.onlineSentenceTranslation}
            onValueChange={(value) => updatePreferences({ onlineSentenceTranslation: value })}
            trackColor={{ false: '#D7D5CF', true: colors.accentSoft }}
            thumbColor={preferences.onlineSentenceTranslation ? colors.accent : '#F8F7F3'}
          />
        </View>
      </View>

      <Text style={styles.sectionLabel}>项目</Text>
      <View style={styles.settingCard}>
        {rows.map((row, index) => (
          <View key={row.title} style={[styles.infoRow, index < rows.length - 1 && styles.infoBorder]}>
            <View style={styles.infoIcon}><Ionicons name={row.icon} size={20} color={colors.ink} /></View>
            <View style={{ flex: 1 }}><Text style={styles.settingTitle}>{row.title}</Text><Text style={styles.settingCaption}>{row.caption}</Text></View>
            {'status' in row ? <Text style={styles.readyBadge}>{row.status}</Text> : null}
          </View>
        ))}
      </View>
      <Pressable onPress={confirmReset} style={styles.dangerButton}><Text style={styles.dangerText}>清除全部本地数据</Text></Pressable>
      <Text style={styles.footer}>书中语 · SHUZHONGYU{`\n`}在书里，学会一门语言。</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 20, paddingBottom: 130 },
  sectionLabel: { color: colors.inkMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginTop: 28, marginBottom: 10, marginLeft: 4 },
  preview: { backgroundColor: colors.surfaceStrong, borderRadius: radii.large, paddingHorizontal: 25, paddingVertical: 28 },
  previewText: { color: colors.ink, fontFamily: typography.serif },
  settingCard: { backgroundColor: 'rgba(255,255,255,0.72)', borderRadius: radii.large, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  settingRow: { minHeight: 76, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  settingCaption: { color: colors.inkMuted, fontSize: 10, marginTop: 4 },
  divider: { height: 1, backgroundColor: colors.line, marginLeft: 18 },
  stepper: { flexDirection: 'row', gap: 8 },
  step: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  swatches: { flexDirection: 'row', gap: 10 },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  selectedSwatch: { borderColor: colors.accent, borderWidth: 2 },
  infoRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  infoBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  infoIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  readyBadge: { color: colors.sage, backgroundColor: 'rgba(95,125,102,0.1)', borderRadius: radii.pill, paddingHorizontal: 9, paddingVertical: 5, fontSize: 9, fontWeight: '800' },
  dangerButton: { marginTop: 18, height: 52, borderRadius: radii.medium, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(217,95,89,0.09)' },
  dangerText: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  footer: { color: '#AAABA6', textAlign: 'center', fontSize: 9, lineHeight: 16, fontWeight: '700', letterSpacing: 1.2, marginTop: 30 },
});
