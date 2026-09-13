import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './src/context/AppContext';
import { DictionaryProvider } from './src/context/DictionaryContext';
import { HomeScreen } from './src/screens/HomeScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { DiscoverScreen } from './src/screens/DiscoverScreen';
import { VocabularyScreen } from './src/screens/VocabularyScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ReaderScreen } from './src/screens/ReaderScreen';
import { ReviewScreen } from './src/screens/ReviewScreen';
import { LevelAssessmentScreen } from './src/screens/LevelAssessmentScreen';
import { RecommendedBookScreen } from './src/screens/RecommendedBookScreen';
import { ImportOverlay } from './src/components/ImportOverlay';
import { InlineNotice } from './src/components/InlineNotice';
import type { MainTabParamList, RootStackParamList } from './src/navigation/types';
import { colors, typography } from './src/theme';
import { formatBackupOperationError } from './src/utils/backupErrors';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

const icons: Record<keyof MainTabParamList, { active: keyof typeof Ionicons.glyphMap; idle: keyof typeof Ionicons.glyphMap }> = {
  Today: { active: 'today', idle: 'today-outline' },
  Discover: { active: 'compass', idle: 'compass-outline' },
  Library: { active: 'library', idle: 'library-outline' },
  Vocabulary: { active: 'bookmark', idle: 'bookmark-outline' },
  Settings: { active: 'options', idle: 'options-outline' },
};

const labels: Record<keyof MainTabParamList, string> = {
  Today: '今天', Discover: '发现', Library: '书架', Vocabulary: '生词', Settings: '设置',
};

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: '#91928D',
        tabBarLabel: labels[route.name],
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
        tabBarIcon: ({ focused, color }) => (
          <Ionicons name={focused ? icons[route.name].active : icons[route.name].idle} color={color} size={21} />
        ),
      })}
    >
      <Tabs.Screen name="Today" component={HomeScreen} />
      <Tabs.Screen name="Discover" component={DiscoverScreen} />
      <Tabs.Screen name="Library" component={LibraryScreen} />
      <Tabs.Screen name="Vocabulary" component={VocabularyScreen} />
      <Tabs.Screen name="Settings" component={SettingsScreen} />
    </Tabs.Navigator>
  );
}

function RecoveryResetModal({ visible, onClose, onConfirm }: { visible: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.recoveryModalBackdrop} onPress={onClose}>
        <Pressable accessibilityViewIsModal style={styles.recoveryModalCard} onPress={(event) => event.stopPropagation()}>
          <Text accessibilityRole="header" style={styles.recoveryModalTitle}>清除本地数据？</Text>
          <Text style={styles.recoveryModalBody}>这会删除你导入的书籍、阅读进度、生词、统计和偏好。重新开始后，书语可能重新生成一本不含个人数据的内置体验书；无法读取当前数据时，先尝试从备份恢复。</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="确认清除并重新开始" onPress={onConfirm} style={styles.recoveryConfirm}><Text style={styles.recoveryConfirmText}>清除并重新开始</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="取消清除本地数据" onPress={onClose} style={styles.recoveryCancel}><Text style={styles.recoveryCancelText}>取消</Text></Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function AppShell() {
  const { ready, storageActivity, storageNotice, dismissStorageNotice, startupError, retryLoad, pickBackup, restoreBackup, resetAll, importStatus, cancelImport, persistenceError, persistenceRetrying, retryPersistence } = useApp();
  const [recoveryResetVisible, setRecoveryResetVisible] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);

  const recoverFromBackup = async () => {
    if (recoveryBusy) return;
    setRecoveryBusy(true);
    setRecoveryMessage(null);
    try {
      const payload = await pickBackup();
      if (payload) await restoreBackup(payload);
    } catch (error) {
      setRecoveryMessage(formatBackupOperationError(error, '备份恢复未完成，请检查文件后重试。'));
    } finally {
      setRecoveryBusy(false);
    }
  };

  const retryStartupLoad = () => {
    if (recoveryBusy) return;
    setRecoveryMessage(null);
    void retryLoad();
  };

  const resetFromRecovery = () => {
    if (recoveryBusy) return;
    setRecoveryMessage(null);
    setRecoveryResetVisible(false);
    void resetAll();
  };

  if (!ready) {
    return (
      <>
      <View style={styles.splash}>
        <View style={styles.logo}><Text style={styles.logoText}>语</Text></View>
        <Text style={styles.brand}>书语</Text>
        {startupError ? (
          <View accessibilityViewIsModal style={styles.recovery}>
            <Text accessibilityRole="alert" style={styles.recoveryTitle}>本地数据未能读取</Text>
            <Text style={styles.recoveryBody}>{startupError}</Text>
            {recoveryMessage ? <Text accessibilityRole="alert" style={styles.recoveryError}>{recoveryMessage}</Text> : null}
            <Pressable accessibilityRole="button" accessibilityLabel="重新读取本地数据" accessibilityState={{ disabled: recoveryBusy }} disabled={recoveryBusy} onPress={retryStartupLoad} style={[styles.retryButton, recoveryBusy && styles.recoveryDisabled]}>
              <Text style={styles.retryText}>重新读取</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={recoveryBusy ? '正在恢复本地备份' : recoveryMessage ? '重试恢复本地备份' : '从本地备份恢复'} disabled={recoveryBusy} onPress={() => void recoverFromBackup()} style={[styles.recoverySecondary, recoveryBusy && styles.recoveryDisabled]}>
              <Text style={styles.recoverySecondaryText}>{recoveryBusy ? '恢复中…' : recoveryMessage ? '重试恢复' : '从备份恢复'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="清除本地数据并重新开始" accessibilityState={{ disabled: recoveryBusy }} disabled={recoveryBusy} onPress={() => setRecoveryResetVisible(true)} style={[styles.recoveryDestructive, recoveryBusy && styles.recoveryDisabled]}>
              <Text style={styles.recoveryDestructiveText}>清除并重新开始</Text>
            </Pressable>
          </View>
        ) : <>
          <ActivityIndicator accessibilityLabel={storageActivity === 'restore' ? '正在恢复备份' : storageActivity === 'reset' ? '正在清除本地数据' : '正在读取本地书架'} color={colors.accent} style={{ marginTop: 18 }} />
          {storageActivity === 'restore' ? <Text style={styles.recoveryBody}>正在恢复备份，请保持应用打开…</Text> : storageActivity === 'reset' ? <Text style={styles.recoveryBody}>正在清除本地数据，请保持应用打开…</Text> : null}
        </>}
      </View>
      <RecoveryResetModal visible={recoveryResetVisible} onClose={() => setRecoveryResetVisible(false)} onConfirm={resetFromRecovery} />
      </>
    );
  }

  return (
    <>
      <View style={{ flex: 1 }} pointerEvents={storageActivity ? 'none' : 'auto'} accessibilityElementsHidden={!!storageActivity} importantForAccessibility={storageActivity ? 'no-hide-descendants' : 'auto'}>
      <NavigationContainer theme={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.canvas } }}>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="Reader" component={ReaderScreen} options={{ animation: 'fade_from_bottom' }} />
          <Stack.Screen name="LevelAssessment" component={LevelAssessmentScreen} />
          <Stack.Screen name="RecommendedBook" component={RecommendedBookScreen} />
          <Stack.Screen name="Review" component={ReviewScreen} options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        </Stack.Navigator>
      </NavigationContainer>
      </View>
      <ImportOverlay status={importStatus} onCancel={cancelImport} />
      {storageNotice ? <InlineNotice tone="success" message={storageNotice} onDismiss={dismissStorageNotice} style={[styles.storageNotice, persistenceError && styles.storageNoticeAbovePersistence]} /> : null}
      {persistenceError ? <View accessibilityRole="alert" style={styles.persistenceBanner}>
        <View style={styles.persistenceCopy}>
          <Text style={styles.persistenceTitle}>本地数据需要重试</Text>
          <Text numberOfLines={2} style={styles.persistenceBody}>{persistenceError}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="重试保存本地数据" accessibilityState={{ disabled: persistenceRetrying }} disabled={persistenceRetrying} onPress={() => void retryPersistence()} style={[styles.persistenceButton, persistenceRetrying && styles.persistenceButtonDisabled]}>
          <Text style={styles.persistenceButtonText}>{persistenceRetrying ? '保存中…' : '重试'}</Text>
        </Pressable>
      </View> : null}
      {storageActivity === 'export' ? <View accessibilityViewIsModal style={styles.storageOverlay}>
        <ActivityIndicator color={colors.accent} accessibilityLabel="正在准备本地备份" />
        <Text style={styles.recoveryBody}>正在准备备份，请保持应用打开…</Text>
      </View> : null}
      <StatusBar style="dark" />
      <RecoveryResetModal visible={recoveryResetVisible} onClose={() => setRecoveryResetVisible(false)} onConfirm={resetFromRecovery} />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <DictionaryProvider>
        <AppProvider>
          <AppShell />
        </AppProvider>
      </DictionaryProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  storageOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 100, backgroundColor: 'rgba(252,250,246,0.96)', alignItems: 'center', justifyContent: 'center' },
  persistenceBanner: { position: 'absolute', left: 14, right: 14, bottom: 92, zIndex: 110, borderRadius: 18, paddingHorizontal: 15, paddingVertical: 12, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#1F211E', shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 14 },
  storageNotice: { position: 'absolute', left: 14, right: 14, bottom: 92, zIndex: 108, marginHorizontal: 0, marginTop: 0 },
  storageNoticeAbovePersistence: { bottom: 158 },
  persistenceCopy: { flex: 1 },
  persistenceTitle: { color: '#fff', fontSize: 12, fontWeight: '800' },
  persistenceBody: { color: 'rgba(255,255,255,0.72)', fontSize: 10, lineHeight: 15, marginTop: 3 },
  persistenceButton: { minWidth: 52, minHeight: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  persistenceButtonDisabled: { opacity: 0.58 },
  persistenceButtonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  splash: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 72, height: 72, borderRadius: 24, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: colors.accent, fontFamily: typography.serif, fontSize: 38, fontWeight: '700' },
  brand: { color: colors.ink, fontSize: 12, fontWeight: '900', letterSpacing: 4, marginTop: 16 },
  recovery: { marginTop: 24, paddingHorizontal: 32, maxWidth: 420, alignItems: 'center' },
  recoveryTitle: { color: colors.ink, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  recoveryBody: { color: colors.inkMuted, fontSize: 13, lineHeight: 21, textAlign: 'center', marginTop: 12 },
  recoveryError: { color: colors.danger, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 12 },
  retryButton: { backgroundColor: colors.ink, borderRadius: 24, paddingHorizontal: 24, paddingVertical: 14, marginTop: 22 },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  recoverySecondary: { minWidth: 150, borderRadius: 24, paddingHorizontal: 24, paddingVertical: 13, marginTop: 10, borderWidth: 1, borderColor: colors.line, alignItems: 'center' },
  recoverySecondaryText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  recoveryDestructive: { paddingHorizontal: 18, paddingVertical: 12, marginTop: 4, alignItems: 'center' },
  recoveryDestructiveText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  recoveryDisabled: { opacity: 0.55 },
  recoveryModalBackdrop: { flex: 1, backgroundColor: 'rgba(20,21,18,0.48)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  recoveryModalCard: { width: '100%', maxWidth: 360, backgroundColor: colors.surfaceStrong, borderRadius: 26, padding: 22 },
  recoveryModalTitle: { color: colors.ink, fontFamily: typography.serif, fontSize: 24, fontWeight: '700' },
  recoveryModalBody: { color: colors.inkMuted, fontSize: 12, lineHeight: 19, marginTop: 10 },
  recoveryConfirm: { minHeight: 46, borderRadius: 23, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  recoveryConfirmText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  recoveryCancel: { minHeight: 42, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  recoveryCancelText: { color: colors.inkMuted, fontSize: 12, fontWeight: '800' },
  tabBar: {
    position: 'absolute', left: 14, right: 14, bottom: 12, height: 68, paddingTop: 8, paddingBottom: 8,
    borderTopWidth: 0, borderRadius: 24, backgroundColor: 'rgba(252,250,246,0.96)', elevation: 12,
    shadowColor: '#1F211E', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 9 },
  },
  tabItem: { borderRadius: 18 },
  tabLabel: { fontSize: 9, fontWeight: '700', marginTop: 2 },
});
