import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../theme';

export function PageHeader({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  copy: { flexShrink: 1 },
  eyebrow: { color: colors.accent, fontSize: 11, lineHeight: 18, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.ink, fontFamily: typography.serif, fontSize: 34, lineHeight: 42, fontWeight: '700', letterSpacing: -1.2 },
});
