import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { BookCover } from '../components/BookCover';
import { PageHeader } from '../components/PageHeader';
import { colors, radii, shadows } from '../theme';

type Props = CompositeScreenProps<BottomTabScreenProps<MainTabParamList, 'Library'>, NativeStackScreenProps<RootStackParamList>>;

export function LibraryScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { books, importBook, removeBook } = useApp();
  const [query, setQuery] = useState('');
  const coverWidth = Math.min(168, Math.max(128, (width - 62) / 2));
  const filtered = useMemo(() => books.filter((book) => `${book.title} ${book.author}`.toLowerCase().includes(query.toLowerCase())), [books, query]);

  const handleImport = async () => {
    try {
      const book = await importBook();
      if (book) navigation.navigate('Reader', { bookId: book.id });
    } catch (error) {
      Alert.alert('无法导入', error instanceof Error ? error.message : '请稍后再试');
    }
  };

  const confirmDelete = (bookId: string, title: string) => {
    Alert.alert('删除本地书籍？', `“${title}”的阅读进度和相关生词也会删除。`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => removeBook(bookId) },
    ]);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 18 }]}>
      <View style={styles.header}>
        <PageHeader title="我的书架" eyebrow={`${books.length} 本本地书籍`} />
        <Pressable accessibilityRole="button" accessibilityLabel="导入 TXT 或 EPUB" onPress={handleImport} style={styles.addButton}><Ionicons name="add" size={24} color={colors.ink} /></Pressable>
      </View>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.inkMuted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="搜索书名或作者" placeholderTextColor="#9B9C97" style={styles.input} />
        {query ? <Pressable onPress={() => setQuery('')}><Ionicons name="close-circle" size={18} color={colors.inkMuted} /></Pressable> : null}
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="library-outline" size={34} color={colors.inkMuted} />
            <Text style={styles.emptyTitle}>没有找到书籍</Text>
            <Text style={styles.emptyBody}>导入 TXT 或 EPUB，开始你的私人阅读空间。</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('Reader', { bookId: item.id })}
            onLongPress={() => confirmDelete(item.id, item.title)}
            accessibilityRole="button"
            accessibilityLabel={`打开《${item.title}》`}
            style={({ pressed }) => [styles.book, pressed && { opacity: 0.78 }]}
          >
            <View>
              <BookCover book={item} width={coverWidth} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`管理《${item.title}》`}
                onPress={() => confirmDelete(item.id, item.title)}
                style={styles.bookMenu}
              >
                <Ionicons name="ellipsis-horizontal" size={17} color="#fff" />
              </Pressable>
            </View>
            <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
            <Text numberOfLines={1} style={styles.meta}>{item.author}</Text>
            <View style={styles.progressLine}>
              <View style={[styles.progressFill, { width: `${Math.max(2, item.progress * 100)}%`, backgroundColor: item.accent }]} />
            </View>
            <Text style={styles.detail}>{Math.round(item.progress * 100)}% · {item.chapterCount} 章 · {item.format.toUpperCase()}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: { paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center', ...shadows.card },
  search: { margin: 20, height: 50, borderRadius: radii.medium, backgroundColor: 'rgba(255,255,255,0.72)', borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  input: { flex: 1, height: '100%', color: colors.ink, fontSize: 14 },
  list: { paddingHorizontal: 20, paddingBottom: 130 },
  row: { justifyContent: 'space-between', marginBottom: 26 },
  book: { width: '47%' },
  bookMenu: { position: 'absolute', right: 9, top: 9, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(20,21,18,0.62)', alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.ink, fontSize: 14, lineHeight: 19, fontWeight: '700', marginTop: 12 },
  meta: { color: colors.inkMuted, fontSize: 11, marginTop: 4 },
  progressLine: { height: 3, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.07)', marginTop: 10, overflow: 'hidden' },
  progressFill: { height: 3, borderRadius: 3 },
  detail: { color: colors.inkMuted, fontSize: 9, fontWeight: '600', marginTop: 6 },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 30 },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptyBody: { color: colors.inkMuted, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 7 },
});
