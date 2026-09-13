import React, { useEffect, useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { useDictionary } from '../context/DictionaryContext';
import { PageHeader } from '../components/PageHeader';
import { colors, radii, typography } from '../theme';
import { listEnglishVoices, OFFLINE_VOICE_ID, speakEnglish, stopSpeech, SYSTEM_AUTO_VOICE_ID, type EnglishVoiceOption } from '../services/speech';
import { getTranslationProviderSummary } from '../services/translation';
import type { BackupPayload } from '../types';
import { InlineNotice } from '../components/InlineNotice';
import { formatBackupOperationError } from '../utils/backupErrors';

const rows = [
  { icon: 'book-outline', title: '离线英汉词典', caption: 'ECDICT Core · 120,000 词条', status: '已就绪' },
  { icon: 'shield-checkmark-outline', title: '隐私说明', caption: '原文默认只保存在本地' },
  { icon: 'logo-github', title: '开源项目', caption: 'GPL-3.0-only · 欢迎贡献' },
  { icon: 'information-circle-outline', title: '关于书语', caption: '版本 1.3.1' },
] as const;

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { books, words, preferences, updatePreferences, retryPersistence, resetAll, exportBackup, pickBackup, restoreBackup } = useApp();
  const { entryCount, dictionaryLoading, dictionaryUnavailable, retryDictionary } = useDictionary();
  const [voices, setVoices] = useState<EnglishVoiceOption[]>([]);
  const [backupBusy, setBackupBusy] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [onlinePromptVisible, setOnlinePromptVisible] = useState(false);
  const [aboutVisible, setAboutVisible] = useState(false);
  const [resetVisible, setResetVisible] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [backupMessageTone, setBackupMessageTone] = useState<'success' | 'error'>('success');
  const [backupRetryAction, setBackupRetryAction] = useState<'export' | 'restore' | null>(null);
  const [restorePayload, setRestorePayload] = useState<BackupPayload | null>(null);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [voiceErrorVoice, setVoiceErrorVoice] = useState<string | null>(null);
  const [voicePreviewing, setVoicePreviewing] = useState<string | null>(null);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);
  const [preferenceSaveError, setPreferenceSaveError] = useState<string | null>(null);
  const [retryingPreferences, setRetryingPreferences] = useState(false);

  useEffect(() => {
    let active = true;
    listEnglishVoices().then((available) => {
      if (!active) return;
      const visible = available.slice(0, 5);
      const selected = preferences.speechVoice && available.find((voice) => voice.identifier === preferences.speechVoice);
      if (selected && !visible.some((voice) => voice.identifier === selected.identifier)) visible.push(selected);
      setVoices(visible);
    });
    return () => { active = false; };
  }, [preferences.speechVoice]);

  useEffect(() => () => {
    void stopSpeech();
  }, []);

  const activeVoice = preferences.speechVoice ?? (Platform.OS === 'android' ? OFFLINE_VOICE_ID : SYSTEM_AUTO_VOICE_ID);

  const savePreferences = async (next: Parameters<typeof updatePreferences>[0]) => {
    try {
      await updatePreferences(next);
      setPreferenceSaveError(null);
    } catch {
      setPreferenceSaveError('偏好已在当前会话更新，但设备尚未保存。');
    }
  };

  const retryPreferenceSave = async () => {
    if (retryingPreferences) return;
    setRetryingPreferences(true);
    try {
      if (await retryPersistence()) setPreferenceSaveError(null);
    } finally {
      setRetryingPreferences(false);
    }
  };

  const openInfo = (title: string) => {
    if (title === '隐私说明') {
      setPrivacyVisible(true);
      return;
    }
    if (title === '开源项目') {
      setLinkMessage(null);
      void Linking.openURL('https://github.com/Petey-PKU/shuyu').catch(() => setLinkMessage('暂时无法打开开源项目页面，请稍后重试。'));
      return;
    }
    setAboutVisible(true);
  };

  const chooseVoice = async (voice: string) => {
    if (voicePreviewing) return;
    setVoicePreviewing(voice);
    setVoiceMessage(null);
    setVoiceErrorVoice(null);
    void savePreferences({ speechVoice: voice });
    try {
      const provider = await speakEnglish('Stories let us travel beyond the quiet of a room.', 'sentence', voice);
      if (voice === OFFLINE_VOICE_ID && provider === 'system-fallback') {
        setVoiceMessage('离线音色暂不可用，试听已自动使用系统发音。请在正式 Android APK 中测试。');
      }
    } catch {
      setVoiceMessage('试听暂时失败，请确认设备音量和系统英语音色后重试。');
      setVoiceErrorVoice(voice);
    } finally {
      setVoicePreviewing(null);
    }
  };

  const confirmReset = () => setResetVisible(true);

  const handleOnlineToggle = (value: boolean) => {
    if (value) {
      setOnlinePromptVisible(true);
      return;
    }
    void savePreferences({ onlineSentenceTranslation: false });
  };

  const enableOnlineTranslation = () => {
    setOnlinePromptVisible(false);
    void savePreferences({ onlineSentenceTranslation: true });
  };

  const showBackupMessage = (message: string, tone: 'success' | 'error' = 'success', retryAction: 'export' | 'restore' | null = null) => {
    setBackupMessageTone(tone);
    setBackupRetryAction(retryAction);
    setBackupMessage(message);
  };

  const handleExportBackup = async () => {
    if (backupBusy) return;
    if (Platform.OS === 'web') {
      showBackupMessage('Web 预览不支持选择本地备份目录，请在 Android 或 iOS 正式安装包中使用。', 'error');
      return;
    }
    setBackupBusy(true);
    try {
      const filename = await exportBackup();
      if (!filename) return;
      showBackupMessage(`备份已保存：${filename}。请妥善保管；其中包含你导入的书籍正文。`);
    } catch (error) {
      showBackupMessage(`备份未完成：${formatBackupOperationError(error, '请选择一个可写入的目录后重试')}`, 'error', 'export');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (backupBusy) return;
    if (Platform.OS === 'web') {
      showBackupMessage('Web 预览不支持恢复本地备份，请在 Android 或 iOS 正式安装包中使用。', 'error');
      return;
    }
    setBackupBusy(true);
    try {
      const payload = await pickBackup();
      if (!payload) { setBackupBusy(false); return; }
      setRestorePayload(payload);
      setBackupBusy(false);
    } catch (error) {
      setBackupBusy(false);
      showBackupMessage(`无法读取备份：${formatBackupOperationError(error, '请选择书语生成的 JSON 备份文件')}`, 'error', 'restore');
    }
  };

  const confirmRestoreBackup = () => {
    const payload = restorePayload;
    if (!payload || backupBusy) return;
    setRestorePayload(null);
    setBackupBusy(true);
    void restoreBackup(payload)
      .then(() => showBackupMessage('恢复完成：重新打开书架即可继续阅读。'))
      .catch((error) => showBackupMessage(`恢复未完成：${formatBackupOperationError(error, '请检查备份文件后重试')}`, 'error', 'restore'))
      .finally(() => setBackupBusy(false));
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + 18 }]} showsVerticalScrollIndicator={false}>
      <PageHeader eyebrow="LOCAL FIRST" title="阅读偏好" />
      {preferenceSaveError ? <InlineNotice message={preferenceSaveError} actionLabel={retryingPreferences ? '保存中…' : '重试保存'} onAction={() => void retryPreferenceSave()} onDismiss={() => setPreferenceSaveError(null)} /> : null}
      <Text style={styles.sectionLabel}>排版预览</Text>
      <View style={styles.preview}>
        <Text style={[styles.previewText, { fontSize: preferences.fontSize, lineHeight: preferences.lineHeight }]}>Stories let us travel without leaving the quiet of a room.</Text>
      </View>

      <View style={styles.settingCard}>
        <View style={styles.settingRow}>
          <View><Text style={styles.settingTitle}>正文字号</Text><Text style={styles.settingCaption}>{preferences.fontSize}px</Text></View>
          <View style={styles.stepper}>
            <Pressable accessibilityRole="button" accessibilityLabel="减小字号" accessibilityState={{ disabled: preferences.fontSize <= 16 }} disabled={preferences.fontSize <= 16} onPress={() => { void savePreferences({ fontSize: Math.max(16, preferences.fontSize - 1), lineHeight: Math.max(27, preferences.lineHeight - 1) }); }} style={[styles.step, preferences.fontSize <= 16 && styles.stepDisabled]}><Ionicons name="remove" size={18} color={colors.ink} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="增大字号" accessibilityState={{ disabled: preferences.fontSize >= 25 }} disabled={preferences.fontSize >= 25} onPress={() => { void savePreferences({ fontSize: Math.min(25, preferences.fontSize + 1), lineHeight: Math.min(42, preferences.lineHeight + 1) }); }} style={[styles.step, preferences.fontSize >= 25 && styles.stepDisabled]}><Ionicons name="add" size={18} color={colors.ink} /></Pressable>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.goalSettingRow}>
          <View><Text style={styles.settingTitle}>每日阅读目标</Text><Text style={styles.settingCaption}>完成目标后仍可继续阅读</Text></View>
          <View style={styles.goalChoices}>
            {[10, 15, 20, 30].map((minutes) => (
              <Pressable accessibilityRole="button" accessibilityLabel={`每日${minutes}分钟`} accessibilityState={{ selected: preferences.dailyGoalMinutes === minutes }} key={minutes} onPress={() => { void savePreferences({ dailyGoalMinutes: minutes }); }} style={[styles.goalChoice, preferences.dailyGoalMinutes === minutes && styles.goalChoiceSelected]}>
                <Text style={[styles.goalChoiceText, preferences.dailyGoalMinutes === minutes && styles.goalChoiceTextSelected]}>{minutes}分</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.settingRow}>
          <View><Text style={styles.settingTitle}>阅读主题</Text><Text style={styles.settingCaption}>纸张、明亮或夜间</Text></View>
          <View style={styles.swatches}>
            {(['paper', 'white', 'night'] as const).map((theme) => (
              <Pressable accessibilityRole="button" accessibilityLabel={theme === 'paper' ? '纸张主题' : theme === 'white' ? '明亮主题' : '夜间主题'} accessibilityState={{ selected: preferences.theme === theme }} key={theme} onPress={() => { void savePreferences({ theme }); }} style={[styles.swatch, { backgroundColor: theme === 'paper' ? colors.canvas : theme === 'white' ? '#fff' : colors.night }, preferences.theme === theme && styles.selectedSwatch]}>
                {preferences.theme === theme ? <Ionicons name="checkmark" size={14} color={theme === 'night' ? '#fff' : colors.ink} /> : null}
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.settingRow}>
          <View style={{ flex: 1, paddingRight: 18 }}><Text style={styles.settingTitle}>在线翻译增强</Text><Text style={styles.settingCaption}>{preferences.onlineSentenceTranslation ? `已开启：${getTranslationProviderSummary()}；未收录单词或主动获取整句翻译时可能联网` : '已关闭：点词只使用本地结果，整句翻译不会联网'}</Text></View>
          <Switch
            accessibilityLabel="在线翻译增强"
            value={preferences.onlineSentenceTranslation}
            onValueChange={handleOnlineToggle}
            trackColor={{ false: '#D7D5CF', true: colors.accentSoft }}
            thumbColor={preferences.onlineSentenceTranslation ? colors.accent : '#F8F7F3'}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.settingRow}>
          <View style={{ flex: 1, paddingRight: 18 }}><Text style={styles.settingTitle}>记录阅读统计</Text><Text style={styles.settingCaption}>{preferences.readingStatsEnabled === false ? '已关闭：不新增阅读分钟、连续天数和趋势；已有记录仍保留' : '记录阅读分钟、连续天数和趋势；关闭不影响阅读进度'}</Text></View>
          <Switch
            accessibilityLabel="记录阅读统计"
            value={preferences.readingStatsEnabled !== false}
            onValueChange={(value) => { void savePreferences({ readingStatsEnabled: value }); }}
            trackColor={{ false: '#D7D5CF', true: colors.accentSoft }}
            thumbColor={preferences.readingStatsEnabled !== false ? colors.accent : '#F8F7F3'}
          />
        </View>
      </View>

      <Text style={styles.sectionLabel}>英语发音音色</Text>
      <View style={styles.settingCard}>
        {voices.map((voice) => (
          <Pressable key={voice.identifier} accessibilityRole="button" accessibilityLabel={voicePreviewing === voice.identifier ? `正在试听${voice.name}` : `选择${voice.name}`} accessibilityState={{ selected: activeVoice === voice.identifier, disabled: !!voicePreviewing }} disabled={!!voicePreviewing} onPress={() => void chooseVoice(voice.identifier)} style={[styles.voiceRow, activeVoice === voice.identifier && styles.selectedVoiceRow, voicePreviewing && styles.voiceDisabled]}>
            <View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.settingTitle}>{voice.name}</Text><Text style={styles.settingCaption}>{voice.description}</Text></View>
            {voicePreviewing === voice.identifier ? <Text style={styles.voicePreviewLabel}>试听中…</Text> : activeVoice === voice.identifier ? <Ionicons name="checkmark-circle" size={20} color={colors.accent} /> : <Ionicons name="volume-medium-outline" size={18} color={colors.inkMuted} />}
          </Pressable>
        ))}
        {!voices.length ? <View style={styles.voiceEmpty}><Text style={styles.settingCaption}>正在读取可用音色…</Text></View> : null}
        {voiceMessage ? <InlineNotice message={voiceMessage} actionLabel={voiceErrorVoice ? '重试试听' : undefined} onAction={voiceErrorVoice ? () => void chooseVoice(voiceErrorVoice) : undefined} onDismiss={() => { setVoiceMessage(null); setVoiceErrorVoice(null); }} /> : null}
        <Text style={styles.voicePrivacy}>书语自带的 Android 音色完全离线；系统音色是否联网由设备、语音引擎和你安装的音色决定。</Text>
      </View>

      <Text style={styles.sectionLabel}>项目</Text>
      <View style={styles.settingCard}>
        {rows.map((row, index) => (
          <Pressable key={row.title} accessibilityRole="button" accessibilityLabel={row.title === '离线英汉词典' && dictionaryUnavailable ? '重试加载离线英汉词典' : row.title} accessibilityState={{ disabled: row.title === '离线英汉词典' && !dictionaryUnavailable }} disabled={row.title === '离线英汉词典' && !dictionaryUnavailable} onPress={() => row.title === '离线英汉词典' ? retryDictionary() : openInfo(row.title)} style={[styles.infoRow, index < rows.length - 1 && styles.infoBorder, (row.title !== '离线英汉词典' || dictionaryUnavailable) && styles.infoInteractive]}>
            <View style={styles.infoIcon}><Ionicons name={row.icon} size={20} color={colors.ink} /></View>
            <View style={{ flex: 1 }}><Text style={styles.settingTitle}>{row.title}</Text><Text style={styles.settingCaption}>{row.title === '离线英汉词典' && dictionaryLoading ? '正在加载离线词典；当前可先继续阅读' : row.title === '离线英汉词典' && dictionaryUnavailable ? '离线词典暂不可用；当前使用基础兜底，点击此处重试' : row.title === '离线英汉词典' && !entryCount ? (preferences.onlineSentenceTranslation ? 'Web 预览不加载随包词典；当前开启在线增强，未收录词可能联网' : 'Web 预览不加载随包词典；当前关闭在线增强，仅使用内置基础兜底') : row.title === '离线英汉词典' ? `ECDICT Core · ${entryCount.toLocaleString()} 词条` : row.caption}</Text></View>
            {'status' in row ? <Text style={styles.readyBadge}>{dictionaryUnavailable ? '重试' : dictionaryLoading ? '加载中' : entryCount ? row.status : 'Web'}</Text> : <Ionicons name="chevron-forward" size={17} color={colors.inkMuted} />}
          </Pressable>
        ))}
        {linkMessage ? <InlineNotice message={linkMessage} actionLabel="重试打开" onAction={() => openInfo('开源项目')} onDismiss={() => setLinkMessage(null)} /> : null}
      </View>
      <Text style={styles.sectionLabel}>本地备份</Text>
      <View style={styles.backupCard}>
        <Text style={styles.settingTitle}>把学习记录带到另一台设备</Text>
        <Text style={styles.settingCaption}>备份包含书籍正文、阅读进度、生词、统计和偏好，只写入你选择的本地目录，不会上传到书语服务器。</Text>
        <View style={styles.backupActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="导出本地备份" accessibilityState={{ disabled: backupBusy }} disabled={backupBusy} onPress={() => void handleExportBackup()} style={[styles.backupButton, styles.backupPrimary, backupBusy && styles.backupDisabled]}>
            <Ionicons name="download-outline" size={17} color="#fff" /><Text style={styles.backupPrimaryText}>{backupBusy ? '处理中…' : '导出备份'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="从本地备份恢复" accessibilityState={{ disabled: backupBusy }} disabled={backupBusy} onPress={() => void handleRestoreBackup()} style={[styles.backupButton, styles.backupSecondary, backupBusy && styles.backupDisabled]}>
            <Ionicons name="cloud-upload-outline" size={17} color={colors.ink} /><Text style={styles.backupSecondaryText}>恢复备份</Text>
          </Pressable>
        </View>
        {backupMessage ? (
          <View accessibilityRole="alert" style={[styles.backupMessage, backupMessageTone === 'error' && styles.backupMessageError]}>
            <Ionicons name={backupMessageTone === 'error' ? 'alert-circle-outline' : 'information-circle-outline'} size={17} color={backupMessageTone === 'error' ? colors.danger : colors.accent} />
            <Text style={[styles.backupMessageText, backupMessageTone === 'error' && styles.backupMessageErrorText]}>{backupMessage}</Text>
            {backupRetryAction ? <Pressable accessibilityRole="button" accessibilityLabel={backupRetryAction === 'export' ? '重试导出备份' : '重试读取备份'} onPress={() => void (backupRetryAction === 'export' ? handleExportBackup() : handleRestoreBackup())} style={styles.backupRetry}><Text style={styles.backupRetryText}>重试</Text></Pressable> : null}
            <Pressable accessibilityRole="button" accessibilityLabel="关闭备份提示" onPress={() => { setBackupMessage(null); setBackupRetryAction(null); }} hitSlop={8} style={styles.backupClose}><Ionicons name="close" size={16} color={colors.inkMuted} /></Pressable>
          </View>
        ) : null}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="清除全部本地数据" accessibilityState={{ disabled: backupBusy }} disabled={backupBusy} onPress={confirmReset} style={[styles.dangerButton, backupBusy && styles.backupDisabled]}><Text style={styles.dangerText}>清除全部本地数据</Text></Pressable>
      <Text style={styles.footer}>书语 · SHUYU{`\n`}在书里，学会一门语言。</Text>

      <Modal visible={onlinePromptVisible} transparent animationType="fade" onRequestClose={() => setOnlinePromptVisible(false)}>
        <Pressable style={styles.infoBackdrop} onPress={() => setOnlinePromptVisible(false)}>
          <Pressable accessibilityViewIsModal style={styles.infoCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.infoCardHeader}>
              <View style={styles.infoIcon}><Ionicons name="globe-outline" size={20} color={colors.accent} /></View>
              <Text accessibilityRole="header" style={styles.infoTitle}>开启在线翻译增强？</Text>
            </View>
            <Text style={styles.infoBody}>未被本地词典收录的单词，以及你主动请求的整句翻译，可能会发送给第三方翻译服务。</Text>
            <Text style={styles.infoBody}>当前翻译策略：{getTranslationProviderSummary()}。</Text>
            <Text style={styles.infoBody}>书籍正文、阅读进度和生词仍保存在设备；你可以随时在设置中关闭在线增强。</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="确认开启在线翻译增强" onPress={enableOnlineTranslation} style={styles.onlineConfirm}><Text style={styles.onlineConfirmText}>开启在线增强</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="暂不开启在线翻译增强" onPress={() => setOnlinePromptVisible(false)} style={styles.infoClose}><Text style={styles.infoCloseText}>暂不开启</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={privacyVisible} transparent animationType="fade" onRequestClose={() => setPrivacyVisible(false)}>
        <Pressable style={styles.infoBackdrop} onPress={() => setPrivacyVisible(false)}>
          <Pressable accessibilityViewIsModal style={styles.infoCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.infoCardHeader}>
              <View style={styles.infoIcon}><Ionicons name="shield-checkmark-outline" size={20} color={colors.sage} /></View>
              <Text accessibilityRole="header" style={styles.infoTitle}>隐私说明</Text>
            </View>
            <Text style={styles.infoBody}>书籍正文、阅读进度、生词和学习统计默认只保存在此设备。</Text>
            <Text style={styles.infoBody}>如果不想新增阅读分钟、连续天数和趋势记录，可以在上方关闭“记录阅读统计”；已有统计不会被删除。</Text>
            <Text style={styles.infoBody}>这个开关不影响查词和复习；查词次数仍只用于设备上的推荐排序，不会上传。</Text>
            <Text style={styles.infoBody}>{Platform.OS === 'web' ? `Web 预览内置约 ${entryCount.toLocaleString()} 个高频词；关闭在线增强时，未收录单词使用本地兜底，开启后才会尝试发送给第三方词典服务。正式安装包优先使用完整本地词典。` : '正式安装包优先使用离线词典在本地查词。开启在线翻译增强后，未收录的单词才会尝试发送给第三方词典服务。'}</Text>
            <Text style={styles.infoBody}>当前翻译策略：{getTranslationProviderSummary()}。</Text>
            <Text style={styles.infoBody}>整句翻译始终需要你在单词卡片中主动点击“获取整句翻译”；点击后，当前句子可能发送给第三方翻译服务。</Text>
            <Text style={styles.infoBody}>关闭在线翻译增强后，书语不会发起这些在线查词或整句翻译请求。</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="关闭隐私说明" onPress={() => setPrivacyVisible(false)} style={styles.infoClose}><Text style={styles.infoCloseText}>知道了</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={resetVisible} transparent animationType="fade" onRequestClose={() => setResetVisible(false)}>
        <Pressable style={styles.infoBackdrop} onPress={() => setResetVisible(false)}>
          <Pressable accessibilityViewIsModal style={styles.infoCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.infoCardHeader}>
              <View style={styles.resetIcon}><Ionicons name="warning-outline" size={20} color={colors.danger} /></View>
              <Text accessibilityRole="header" style={styles.infoTitle}>清除全部本地数据？</Text>
            </View>
            <Text style={styles.infoBody}>你导入的书籍、阅读进度、生词、统计和偏好都会从这台设备永久删除。重新开始后，书语可能重新生成一本不含个人数据的内置体验书。</Text>
            <Text style={styles.infoBody}>如果你还没有备份，请先取消并导出本地备份。</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="确认清除全部本地数据" onPress={() => { setResetVisible(false); void resetAll(); }} style={styles.resetConfirm}><Text style={styles.resetConfirmText}>全部清除</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="取消清除本地数据" onPress={() => setResetVisible(false)} style={styles.infoClose}><Text style={styles.infoCloseText}>取消</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={aboutVisible} transparent animationType="fade" onRequestClose={() => setAboutVisible(false)}>
        <Pressable style={styles.infoBackdrop} onPress={() => setAboutVisible(false)}>
          <Pressable accessibilityViewIsModal style={styles.infoCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.infoCardHeader}>
              <View style={styles.infoIcon}><Ionicons name="book-outline" size={20} color={colors.accent} /></View>
              <Text accessibilityRole="header" style={styles.infoTitle}>关于书语</Text>
            </View>
            <Text style={styles.infoBody}>书语是一款本地优先的英语语境阅读器。</Text>
            <Text style={styles.infoBody}>在书里，学会一门语言。</Text>
            <Text style={styles.infoBody}>版本 1.3.1 · GPL-3.0-only</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="关闭关于书语" onPress={() => setAboutVisible(false)} style={styles.infoClose}><Text style={styles.infoCloseText}>知道了</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={restorePayload !== null} transparent animationType="fade" onRequestClose={() => { if (!backupBusy) { setRestorePayload(null); setBackupBusy(false); } }}>
        <Pressable style={styles.infoBackdrop} onPress={() => { if (!backupBusy) { setRestorePayload(null); setBackupBusy(false); } }}>
          <Pressable accessibilityViewIsModal style={styles.infoCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.infoCardHeader}>
              <View style={styles.resetIcon}><Ionicons name="cloud-upload-outline" size={20} color={colors.danger} /></View>
              <Text accessibilityRole="header" style={styles.infoTitle}>覆盖当前本地数据？</Text>
            </View>
            {restorePayload ? <Text style={styles.infoBody}>备份时间：{new Date(restorePayload.exportedAt).toLocaleString()}\n包含 {restorePayload.books.length} 本书和 {restorePayload.words.length} 个生词。\n当前设备有 {books.length} 本书和 {words.length} 个生词。</Text> : null}
            <Text style={styles.infoBody}>恢复会替换当前书架与学习记录。恢复前请确认这份备份来自你信任的设备，并确认上面的数量符合预期。</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="确认恢复本地备份" onPress={confirmRestoreBackup} style={styles.resetConfirm}><Text style={styles.resetConfirmText}>恢复备份</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="取消恢复本地备份" onPress={() => { setRestorePayload(null); setBackupBusy(false); }} style={styles.infoClose}><Text style={styles.infoCloseText}>取消</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  voiceRow: { minHeight: 64, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  selectedVoiceRow: { backgroundColor: colors.accentSoft },
  voiceDisabled: { opacity: 0.58 },
  voicePreviewLabel: { color: colors.accent, fontSize: 10, fontWeight: '800' },
  voicePrivacy: { color: colors.inkMuted, fontSize: 10, lineHeight: 16, paddingHorizontal: 18, paddingVertical: 12 },
  voiceEmpty: { paddingHorizontal: 18, paddingVertical: 18 },
  stepper: { flexDirection: 'row', gap: 8 },
  step: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  stepDisabled: { opacity: 0.42 },
  swatches: { flexDirection: 'row', gap: 10 },
  goalChoices: { flexDirection: 'row', gap: 6 },
  goalSettingRow: { padding: 18, gap: 12 },
  backupCard: { padding: 18, borderRadius: radii.large, backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.line },
  backupActions: { flexDirection: 'row', gap: 9, marginTop: 16 },
  backupButton: { flex: 1, minHeight: 46, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  backupPrimary: { backgroundColor: colors.ink },
  backupSecondary: { backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.line },
  backupPrimaryText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  backupSecondaryText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  backupDisabled: { opacity: 0.52 },
  goalChoice: { minWidth: 40, height: 32, borderRadius: 16, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  goalChoiceSelected: { backgroundColor: colors.ink },
  goalChoiceText: { color: colors.inkMuted, fontSize: 10, fontWeight: '800' },
  goalChoiceTextSelected: { color: '#fff' },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  selectedSwatch: { borderColor: colors.accent, borderWidth: 2 },
  infoRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  infoInteractive: { backgroundColor: 'rgba(255,255,255,0.16)' },
  infoBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  infoIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  readyBadge: { color: colors.sage, backgroundColor: 'rgba(95,125,102,0.1)', borderRadius: radii.pill, paddingHorizontal: 9, paddingVertical: 5, fontSize: 9, fontWeight: '800' },
  dangerButton: { marginTop: 18, height: 52, borderRadius: radii.medium, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(217,95,89,0.09)' },
  dangerText: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  footer: { color: '#AAABA6', textAlign: 'center', fontSize: 9, lineHeight: 16, fontWeight: '700', letterSpacing: 1.2, marginTop: 30 },
  infoBackdrop: { flex: 1, backgroundColor: 'rgba(15,16,13,0.48)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  infoCard: { width: '100%', maxWidth: 360, backgroundColor: colors.surfaceStrong, borderRadius: radii.large, padding: 22 },
  infoCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 16 },
  infoTitle: { color: colors.ink, fontFamily: typography.serif, fontSize: 24, fontWeight: '700' },
  infoBody: { color: colors.inkMuted, fontSize: 12, lineHeight: 20, marginTop: 10 },
  infoClose: { minHeight: 46, borderRadius: radii.pill, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  infoCloseText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  resetIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: 'rgba(217,95,89,0.12)', alignItems: 'center', justifyContent: 'center' },
  resetConfirm: { minHeight: 46, borderRadius: radii.pill, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  onlineConfirm: { minHeight: 46, borderRadius: radii.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  onlineConfirmText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  resetConfirmText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  backupMessage: { marginTop: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 13, backgroundColor: colors.accentSoft, flexDirection: 'row', alignItems: 'center', gap: 8 },
  backupMessageError: { backgroundColor: 'rgba(217,95,89,0.1)' },
  backupMessageText: { flex: 1, color: colors.inkMuted, fontSize: 10, lineHeight: 16 },
  backupMessageErrorText: { color: colors.danger },
  backupRetry: { minHeight: 30, paddingHorizontal: 9, borderRadius: radii.pill, backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center' },
  backupRetryText: { color: colors.danger, fontSize: 10, fontWeight: '800' },
  backupClose: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
});
