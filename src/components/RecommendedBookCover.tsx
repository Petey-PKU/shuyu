import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RecommendedBook } from '../types';
import { typography } from '../theme';

export function RecommendedBookCover({ book, width = 124 }: { book: RecommendedBook; width?: number }) {
  const height = Math.round(width * 1.42);
  return (
    <View style={[styles.cover, { width, height, backgroundColor: book.accent }]}>
      <View style={styles.rule} />
      <Text style={styles.level}>{book.level}</Text>
      <View style={styles.copy}>
        <Text numberOfLines={4} style={[styles.title, { fontSize: Math.max(14, width * 0.135) }]}>{book.title}</Text>
        <Text numberOfLines={2} style={styles.author}>{book.author}</Text>
      </View>
      <Text style={styles.mark}>书语推荐</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { borderRadius: 18, padding: 15, overflow: 'hidden', justifyContent: 'space-between' },
  rule: { position: 'absolute', top: 0, bottom: 0, left: 11, width: 1, backgroundColor: 'rgba(255,255,255,0.22)' },
  level: { alignSelf: 'flex-end', color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1.2, opacity: 0.9 },
  copy: { paddingLeft: 7 },
  title: { color: '#fff', fontFamily: typography.serif, lineHeight: 22, fontWeight: '700', letterSpacing: -0.35 },
  author: { color: 'rgba(255,255,255,0.72)', fontSize: 9, lineHeight: 13, marginTop: 8 },
  mark: { color: 'rgba(255,255,255,0.55)', fontSize: 7, fontWeight: '800', letterSpacing: 1, paddingLeft: 7 },
});
