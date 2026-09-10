import React from 'react';
import { Text } from 'react-native';
import type { ChapterTextMeasureProps } from './ChapterTextMeasure.types';

export function ChapterTextMeasure({ text, width, left, fontFamily, fontSize, lineHeight, onLines }: ChapterTextMeasureProps) {
  return <Text accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    onTextLayout={(event) => onLines(event.nativeEvent.lines.map((line) => ({ text: line.text, y: line.y, height: line.height })))}
    style={{ position: 'absolute', left, top: 0, opacity: 0, width, fontFamily, fontSize, lineHeight, letterSpacing: 0.12 }}
  >{text}</Text>;
}
