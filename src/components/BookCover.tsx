import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Book } from '../types';
import { colors, radii, shadows, typography } from '../theme';

interface Props {
  book: Book;
  width?: number;
  compact?: boolean;
}

export function BookCover({ book, width = 126, compact = false }: Props) {
  const height = Math.round(width * 1.45);
  return (
    <View style={[styles.cover, shadows.card, { width, height, backgroundColor: book.accent }]}>
      <View style={styles.rule} />
      <Text numberOfLines={compact ? 3 : 4} style={[styles.title, compact && styles.compactTitle]}>{book.title}</Text>
      <View style={styles.bottom}>
        <Text numberOfLines={1} style={styles.author}>{book.author}</Text>
        <Text style={styles.mark}>书中语</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    borderRadius: radii.medium,
    padding: 16,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  rule: { width: 28, height: 2, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.65)' },
  title: {
    color: colors.surfaceStrong,
    fontFamily: typography.serif,
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.35,
  },
  compactTitle: { fontSize: 17, lineHeight: 21 },
  bottom: { gap: 8 },
  author: { color: 'rgba(255,255,255,0.78)', fontSize: 11 },
  mark: { color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: '800', letterSpacing: 1.8 },
});
