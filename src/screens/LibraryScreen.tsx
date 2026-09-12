import React, { useMemo, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { BookCover } from '../components/BookCover';
import { PageHeader } from '../components/PageHeader';
import { colors, radii, shadows, typography } from '../theme';

type Props = CompositeScreenProps<BottomTabScreenProps<MainTabParamList, 'Library'>, NativeStackScreenProps<RootStackParamList>>;

export function LibraryScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { books, importBook, removeBook, updateBookMetadata } = useApp();
  const [query, setQuery] = useState('');
  const [editingBook, setEditingBook] = useState<{ id: string; title: string; author: string } | null>(null);
  const [menuBook, setMenuBook] = useState<{ id: string; title: string; author: string } | null>(null);
  const [deleteBook, setDeleteBook] = useState<{ id: string; title: string } | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftAuthor, setDraftAuthor] = useState('');
  const coverWidth = Math.min(168, Math.max(128, (width - 62) / 2));
  const filtered = useMemo(() => books.filter((book) => `${book.title} ${book.author}`.toLowerCase().includes(query.toLowerCase())), [books, query]);

  const handleImport = async () => {
    try {
      const book = await importBook();
      if (book) navigation.navigate('Reader', { bookId: book.id });
    } catch (error) {
      Alert.alert('无法导入', error instanceof Error ? error.message : '请稍后再试', [
        { text: '取消', style: 'cancel' },
        { text: '重试', onPress: () => { void handleImport(); } },
      ]);
    }
  };

  const confirmDelete = (bookId: string, title: string) => {
    setMenuBook(null);
    setDeleteBook({ id: bookId, title });
  };

  const openBookMenu = (bookId: string, title: string, author: string) => {
    setMenuBook({ id: bookId, title, author });
  };

  const saveMetadata = async () => {
    if (!editingBook) return;
    try {
      await updateBookMetadata(editingBook.id, draftTitle, draftAuthor);
      setEditingBook(null);
    } catch (error) {
      Alert.alert('无法保存', error instanceof Error ? error.message : '请检查书名后重试');
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 18 }]}>
      <View style={styles.header}>
        <PageHeader title="我的书架" eyebrow={`${books.length} 本本地书籍`} />
        <Pressable accessibilityRole="button" accessibilityLabel="导入电子书" onPress={handleImport} style={styles.addButton}><Ionicons name="add" size={24} color={colors.ink} /></Pressable>
      </View>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.inkMuted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="搜索书名或作者" placeholderTextColor="#9B9C97" style={styles.input} />
        {query ? <Pressable accessibilityRole="button" accessibilityLabel="清除搜索" onPress={() => setQuery('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.inkMuted} /></Pressable> : null}
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
            <Text style={styles.emptyTitle}>{query ? '没有匹配的书籍' : '还没有书籍'}</Text>
            <Text style={styles.emptyBody}>{query ? '试试其他书名或作者关键词。' : '导入 TXT、EPUB、无 DRM 的 MOBI/AZW3/KF8，以及数字文本型或英文扫描版 PDF，开始你的私人阅读空间。'}</Text>
            {!query ? (
              <Pressable accessibilityRole="button" accessibilityLabel="导入第一本书" onPress={handleImport} style={styles.emptyButton}>
                <Ionicons name="document-text-outline" size={17} color="#fff" />
                <Text style={styles.emptyButtonText}>导入第一本书</Text>
              </Pressable>
            ) : null}
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
                onPress={(event) => { event.stopPropagation(); openBookMenu(item.id, item.title, item.author); }}
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
      <Modal visible={!!editingBook} transparent animationType="slide" onRequestClose={() => setEditingBook(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setEditingBook(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoiding}>
            <Pressable style={styles.editCard} onPress={(event) => event.stopPropagation()}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.editTitle}>编辑书籍信息</Text>
                <Text style={styles.editLabel}>书名</Text>
                <TextInput value={draftTitle} onChangeText={setDraftTitle} placeholder="书名" placeholderTextColor="#9B9C97" style={styles.editInput} autoFocus returnKeyType="next" />
                <Text style={styles.editLabel}>作者</Text>
                <TextInput value={draftAuthor} onChangeText={setDraftAuthor} placeholder="作者（可选）" placeholderTextColor="#9B9C97" style={styles.editInput} returnKeyType="done" onSubmitEditing={() => void saveMetadata()} />
                <View style={styles.editActions}>
                  <Pressable accessibilityRole="button" accessibilityLabel="取消编辑" onPress={() => setEditingBook(null)} style={styles.editCancel}><Text style={styles.editCancelText}>取消</Text></Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="保存书籍信息" onPress={() => void saveMetadata()} style={styles.editSave}><Text style={styles.editSaveText}>保存</Text></Pressable>
                </View>
              </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
      <Modal visible={!!menuBook} transparent animationType="fade" onRequestClose={() => setMenuBook(null)}>
        <Pressable style={styles.modalBackdropCenter} onPress={() => setMenuBook(null)}>
          <Pressable style={styles.actionCard} onPress={(event) => event.stopPropagation()}>
            <Text accessibilityRole="header" style={styles.actionTitle}>管理{menuBook ? `《${menuBook.title}》` : '书籍'}</Text>
            <Text style={styles.actionBody}>可以编辑书籍信息，或从本地书架删除它。</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="编辑书籍信息" onPress={() => {
              if (!menuBook) return;
              setEditingBook(menuBook);
              setDraftTitle(menuBook.title);
              setDraftAuthor(menuBook.author);
              setMenuBook(null);
            }} style={styles.actionPrimary}><Text style={styles.actionPrimaryText}>编辑信息</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="删除书籍" onPress={() => menuBook && confirmDelete(menuBook.id, menuBook.title)} style={styles.actionDanger}><Text style={styles.actionDangerText}>删除书籍</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="取消管理" onPress={() => setMenuBook(null)} style={styles.actionCancel}><Text style={styles.actionCancelText}>取消</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={!!deleteBook} transparent animationType="fade" onRequestClose={() => setDeleteBook(null)}>
        <Pressable style={styles.modalBackdropCenter} onPress={() => setDeleteBook(null)}>
          <Pressable style={styles.actionCard} onPress={(event) => event.stopPropagation()}>
            <Text accessibilityRole="header" style={styles.actionTitle}>删除本地书籍？</Text>
            <Text style={styles.actionBody}>“{deleteBook?.title}”的阅读进度和相关生词也会删除。</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="确认删除书籍" onPress={() => {
              if (deleteBook) void removeBook(deleteBook.id);
              setDeleteBook(null);
            }} style={styles.actionDanger}><Text style={styles.actionDangerText}>删除书籍</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="取消删除" onPress={() => setDeleteBook(null)} style={styles.actionCancel}><Text style={styles.actionCancelText}>保留书籍</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  emptyButton: { marginTop: 20, height: 48, borderRadius: radii.medium, paddingHorizontal: 18, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', gap: 8 },
  emptyButtonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(20,21,18,0.42)', justifyContent: 'flex-end' },
  modalBackdropCenter: { flex: 1, backgroundColor: 'rgba(20,21,18,0.48)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  actionCard: { width: '100%', maxWidth: 360, backgroundColor: colors.surfaceStrong, borderRadius: radii.large, padding: 22 },
  actionTitle: { color: colors.ink, fontFamily: typography.serif, fontSize: 23, fontWeight: '700' },
  actionBody: { color: colors.inkMuted, fontSize: 12, lineHeight: 19, marginTop: 9 },
  actionPrimary: { minHeight: 46, borderRadius: radii.pill, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  actionPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  actionDanger: { minHeight: 46, borderRadius: radii.pill, backgroundColor: 'rgba(217,95,89,0.1)', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  actionDangerText: { color: colors.danger, fontSize: 13, fontWeight: '800' },
  actionCancel: { minHeight: 42, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  actionCancelText: { color: colors.inkMuted, fontSize: 12, fontWeight: '800' },
  keyboardAvoiding: { width: '100%' },
  editCard: { backgroundColor: colors.surfaceStrong, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 34 },
  editTitle: { color: colors.ink, fontFamily: typography.serif, fontSize: 22, fontWeight: '700', marginBottom: 20 },
  editLabel: { color: colors.inkMuted, fontSize: 10, fontWeight: '800', marginTop: 10, marginBottom: 7 },
  editInput: { height: 48, borderRadius: 14, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, color: colors.ink, fontSize: 14 },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  editCancel: { flex: 1, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  editCancelText: { color: colors.inkMuted, fontSize: 13, fontWeight: '800' },
  editSave: { flex: 1, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  editSaveText: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
