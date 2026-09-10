import type { MeasuredLine } from '../utils/pagination';

export interface ChapterTextMeasureProps {
  text: string;
  width: number;
  left: number;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  onLines: (lines: MeasuredLine[]) => void;
}
