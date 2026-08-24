import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
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
  const { ready, importing } = useApp();
  if (!ready) {
    return (
      <View style={styles.splash}>
        <View style={styles.logo}><Text style={styles.logoText}>语</Text></View>
        <Text style={styles.brand}>书语</Text>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 18 }} />
      </View>
    );
  }

  return (
    <>
      <NavigationContainer theme={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.canvas } }}>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="Reader" component={ReaderScreen} options={{ animation: 'fade_from_bottom' }} />
          <Stack.Screen name="LevelAssessment" component={LevelAssessmentScreen} />
          <Stack.Screen name="RecommendedBook" component={RecommendedBookScreen} />
          <Stack.Screen name="Review" component={ReviewScreen} options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        </Stack.Navigator>
      </NavigationContainer>
      <ImportOverlay visible={importing} />
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
  splash: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 72, height: 72, borderRadius: 24, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: colors.accent, fontFamily: typography.serif, fontSize: 38, fontWeight: '700' },
  brand: { color: colors.ink, fontSize: 12, fontWeight: '900', letterSpacing: 4, marginTop: 16 },
  tabBar: {
    position: 'absolute', left: 14, right: 14, bottom: 12, height: 68, paddingTop: 8, paddingBottom: 8,
    borderTopWidth: 0, borderRadius: 24, backgroundColor: 'rgba(252,250,246,0.96)', elevation: 12,
    shadowColor: '#1F211E', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 9 },
  },
  tabItem: { borderRadius: 18 },
  tabLabel: { fontSize: 9, fontWeight: '700', marginTop: 2 },
});
