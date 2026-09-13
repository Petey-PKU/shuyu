import type { ParsedBook } from '../types';

function countWords(text: string): number {
  return text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)?.length ?? 0;
}

export const MAX_CHAPTER_WORDS = 5_000;
export const MAX_CHAPTER_CHARACTERS = 30_000;

function splitLongParagraph(paragraph: string, maxCharacters = 1_800): string[] {
  if (paragraph.length <= maxCharacters) return [paragraph];
  const sentences = paragraph.match(/[^.!?。！？]+[.!?。！？]+["'”’)]*|[^.!?。！？]+$/g) ?? [paragraph];
  const chunks: string[] = [];
  let current = '';
  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();
    if (!sentence) continue;
    if (current && current.length + sentence.length + 1 > maxCharacters) {
      chunks.push(current);
      current = '';
    }
    if (sentence.length > maxCharacters) {
      for (const word of sentence.split(/\s+/)) {
        if (current && current.length + word.length + 1 > maxCharacters) {
          chunks.push(current);
          current = '';
        }
        current = current ? `${current} ${word}` : word;
      }
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [paragraph];
}

/** Keep a single reader measurement bounded while preserving the source order. */
export function splitChapterSections(chapter: ParsedBook['chapters'][number]): ParsedBook['chapters'] {
  const paragraphs = chapter.paragraphs.flatMap((paragraph) => splitLongParagraph(paragraph));
  const sections: ParsedBook['chapters'] = [];
  let current: string[] = [];
  let words = 0;
  let characters = 0;
  let part = 1;
  const flush = () => {
    if (!current.length) return;
    sections.push({
      title: part === 1 ? chapter.title : `${chapter.title}（续 ${part}）`,
      paragraphs: current,
      wordCount: countWords(current.join(' ')),
    });
    current = [];
    words = 0;
    characters = 0;
    part += 1;
  };
  for (const paragraph of paragraphs) {
    const paragraphWords = countWords(paragraph);
    if (current.length && (words + paragraphWords > MAX_CHAPTER_WORDS || characters + paragraph.length > MAX_CHAPTER_CHARACTERS)) flush();
    current.push(paragraph);
    words += paragraphWords;
    characters += paragraph.length;
  }
  flush();
  return sections.length ? sections : [{ ...chapter, paragraphs: [], wordCount: 0 }];
}
