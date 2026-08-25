export interface TextToken {
  value: string;
  word: boolean;
  start: number;
}

export function countWords(text: string): number {
  return text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)?.length ?? 0;
}

export function tokenizeParagraph(text: string): TextToken[] {
  const tokens: TextToken[] = [];
  const pattern = /[A-Za-z]+(?:['’-][A-Za-z]+)*|[^A-Za-z]+/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    tokens.push({
      value: match[0],
      word: /^[A-Za-z]/.test(match[0]),
      start: match.index,
    });
  }
  return tokens;
}

export function sentenceAt(text: string, offset: number): string {
  const boundaries = /[^.!?。！？]+[.!?。！？]?/g;
  let match: RegExpExecArray | null;
  while ((match = boundaries.exec(text)) !== null) {
    if (offset >= match.index && offset <= match.index + match[0].length) {
      return match[0].trim();
    }
  }
  return text.trim();
}

export function cleanFileName(name: string): string {
  return name.replace(/\.(txt|epub|mobi|azw3|kf8|pdf)$/i, '').replace(/[_-]+/g, ' ').trim();
}

export function splitPlainText(text: string, fallbackTitle: string) {
  const normalized = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\u00a0]+/g, ' ')
    .trim();

  const lines = normalized.split('\n');
  const chapterPattern = /^\s*(chapter|part|book)\s+([\divxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten)\b.*$/i;
  const chapters: { title: string; body: string[] }[] = [];
  let current = { title: '开始阅读', body: [] as string[] };

  for (const line of lines) {
    const trimmed = line.trim();
    if (chapterPattern.test(trimmed)) {
      if (current.body.some(Boolean)) chapters.push(current);
      current = { title: trimmed, body: [] };
    } else {
      current.body.push(trimmed);
    }
  }
  if (current.body.some(Boolean)) chapters.push(current);

  const normalizedChapters = (chapters.length ? chapters : [{ title: fallbackTitle, body: lines }])
    .map((chapter, index) => {
      const paragraphs = chapter.body
        .join('\n')
        .split(/\n\s*\n|(?<=\.)\s*\n(?=[A-Z“\"])/)
        .map((item) => item.replace(/\s+/g, ' ').trim())
        .filter((item) => item.length > 0);
      const safeParagraphs = paragraphs.length
        ? paragraphs
        : chapter.body.map((item) => item.trim()).filter(Boolean);
      const body = safeParagraphs.join(' ');
      return {
        title: chapter.title || `第 ${index + 1} 章`,
        paragraphs: safeParagraphs,
        wordCount: countWords(body),
      };
    })
    .filter((chapter) => chapter.wordCount > 0);

  return normalizedChapters;
}
