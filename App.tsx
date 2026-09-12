import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
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
import type { MainTabParamList, RootStackParamList } from './src/navigation/types';
import { colors, typography } from './src/theme';

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

function AppShell() {
  const { ready, storageActivity, startupError, retryLoad, importStatus, cancelImport, persistenceError, retryPersistence } = useApp();
  if (!ready) {
    return (
      <View style={styles.splash}>
        <View style={styles.logo}><Text style={styles.logoText}>语</Text></View>
        <Text style={styles.brand}>书语</Text>
        {startupError ? (
          <View accessibilityViewIsModal style={styles.recovery}>
            <Text accessibilityRole="alert" style={styles.recoveryTitle}>本地数据未能读取</Text>
            <Text style={styles.recoveryBody}>{startupError}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="重新读取本地数据" onPress={() => void retryLoad()} style={styles.retryButton}>
              <Text style={styles.retryText}>重新读取</Text>
            </Pressable>
          </View>
        ) : <>
          <ActivityIndicator accessibilityLabel={storageActivity === 'restore' ? '正在恢复备份' : '正在读取本地书架'} color={colors.accent} style={{ marginTop: 18 }} />
          {storageActivity === 'restore' ? <Text style={styles.recoveryBody}>正在恢复备份，请保持应用打开…</Text> : null}
        </>}
      </View>
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
      {persistenceError ? <View accessibilityRole="alert" style={styles.persistenceBanner}>
        <View style={styles.persistenceCopy}>
          <Text style={styles.persistenceTitle}>本地数据需要重试</Text>
          <Text numberOfLines={2} style={styles.persistenceBody}>{persistenceError}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="重试保存本地数据" onPress={() => void retryPersistence()} style={styles.persistenceButton}>
          <Text style={styles.persistenceButtonText}>重试</Text>
        </Pressable>
      </View> : null}
      {storageActivity === 'export' ? <View accessibilityViewIsModal style={styles.storageOverlay}>
        <ActivityIndicator color={colors.accent} accessibilityLabel="正在准备本地备份" />
        <Text style={styles.recoveryBody}>正在准备备份，请保持应用打开…</Text>
      </View> : null}
      <StatusBar style="dark" />
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
  persistenceCopy: { flex: 1 },
  persistenceTitle: { color: '#fff', fontSize: 12, fontWeight: '800' },
  persistenceBody: { color: 'rgba(255,255,255,0.72)', fontSize: 10, lineHeight: 15, marginTop: 3 },
  persistenceButton: { minWidth: 52, minHeight: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  persistenceButtonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  splash: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 72, height: 72, borderRadius: 24, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: colors.accent, fontFamily: typography.serif, fontSize: 38, fontWeight: '700' },
  brand: { color: colors.ink, fontSize: 12, fontWeight: '900', letterSpacing: 4, marginTop: 16 },
  recovery: { marginTop: 24, paddingHorizontal: 32, maxWidth: 420, alignItems: 'center' },
  recoveryTitle: { color: colors.ink, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  recoveryBody: { color: colors.inkMuted, fontSize: 13, lineHeight: 21, textAlign: 'center', marginTop: 12 },
  retryButton: { backgroundColor: colors.ink, borderRadius: 24, paddingHorizontal: 24, paddingVertical: 14, marginTop: 22 },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  tabBar: {
    position: 'absolute', left: 14, right: 14, bottom: 12, height: 68, paddingTop: 8, paddingBottom: 8,
    borderTopWidth: 0, borderRadius: 24, backgroundColor: 'rgba(252,250,246,0.96)', elevation: 12,
    shadowColor: '#1F211E', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 9 },
  },
  tabItem: { borderRadius: 18 },
  tabLabel: { fontSize: 9, fontWeight: '700', marginTop: 2 },
});
