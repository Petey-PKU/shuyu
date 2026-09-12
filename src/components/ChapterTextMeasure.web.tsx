import React, { useEffect, useRef } from 'react';
import type { ChapterTextMeasureProps } from './ChapterTextMeasure.types';
import type { MeasuredLine } from '../utils/pagination';

/** React Native Web does not emit onTextLayout. Measure the browser's actual line wraps. */
export function ChapterTextMeasure({ text, width, left, fontFamily, fontSize, lineHeight, onLines }: ChapterTextMeasureProps) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    const measure = () => {
      const container = element.current;
      const node = container?.firstChild;
      if (!container || !node || cancelled) return;
      const range = document.createRange();
      const top = container.getBoundingClientRect().top;
      const lines: MeasuredLine[] = [];
      let offset = 0;
      let start = 0;
      let y: number | undefined;
      const chunk = () => {
        if (cancelled) return;
        // Yield for long chapters so navigation and resize remain responsive while measuring.
        const chunkEnd = Math.min(text.length, offset + 1500);
        while (offset < chunkEnd) {
          const next = offset + ((text.codePointAt(offset) ?? 0) > 0xffff ? 2 : 1);
          range.setStart(node, offset);
          range.setEnd(node, next);
          const rect = range.getClientRects()[0];
          if (rect?.height) {
            const nextY = rect.top - top;
            if (y !== undefined && nextY > y + 1) {
              lines.push({ text: text.slice(start, offset), y, height: lineHeight });
              start = offset;
            }
            y = nextY;
          }
          offset = next;
        }
        if (offset < text.length) frame = requestAnimationFrame(chunk);
        else {
          lines.push({ text: text.slice(start), y: y ?? 0, height: lineHeight });
          onLines(lines);
        }
      };
      frame = requestAnimationFrame(chunk);
    };
    void document.fonts.ready.then(() => { if (!cancelled) measure(); });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [text, width, fontFamily, fontSize, lineHeight, onLines]);

  return <div ref={element} aria-hidden style={{ position: 'absolute', left, top: 0, opacity: 0, pointerEvents: 'none',
    width, fontFamily, fontSize, lineHeight: `${lineHeight}px`, letterSpacing: '0.12px', whiteSpace: 'pre-wrap', overflowWrap: 'break-word',
  }}>{text}</div>;
}
