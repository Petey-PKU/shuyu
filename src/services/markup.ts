const namedEntities: Record<string, string> = {
  aacute: 'á', acirc: 'â', aelig: 'æ', agrave: 'à', amp: '&', aring: 'å', atilde: 'ã', auml: 'ä',
  bull: '•', ccedil: 'ç', cent: '¢', copy: '©', deg: '°', divide: '÷', eacute: 'é', ecirc: 'ê',
  egrave: 'è', eth: 'ð', euml: 'ë', euro: '€', gt: '>', hellip: '…', iacute: 'í', icirc: 'î',
  igrave: 'ì', iuml: 'ï', laquo: '«', ldquo: '“', lsquo: '‘', lt: '<', mdash: '—', middot: '·',
  nbsp: ' ', ndash: '–', not: '¬', ntilde: 'ñ', oacute: 'ó', ocirc: 'ô', ograve: 'ò', ordf: 'ª',
  ordm: 'º', oslash: 'ø', otilde: 'õ', ouml: 'ö', para: '¶', plusmn: '±', pound: '£', quot: '"',
  raquo: '»', reg: '®', rdquo: '”', rsquo: '’', sect: '§', shy: '', szlig: 'ß', thorn: 'þ',
  times: '×', trade: '™', uacute: 'ú', ucirc: 'û', ugrave: 'ù', uuml: 'ü', yacute: 'ý', yen: '¥',
  yuml: 'ÿ', apos: "'",
};

function codePoint(value: string, radix: number): string {
  const parsed = Number.parseInt(value, radix);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 0x10ffff) return '';
  try {
    return String.fromCodePoint(parsed);
  } catch {
    return '';
  }
}

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);?/gi, (_, value) => codePoint(value, 16))
    .replace(/&#(\d+);?/g, (_, value) => codePoint(value, 10))
    .replace(/&([a-z][a-z0-9]+);/gi, (full, name) => namedEntities[name.toLowerCase()] ?? full);
}

function plainInlineText(source: string): string {
  return decodeHtmlEntities(source.replace(/<[^>]+>/g, ' '))
    .replace(/[\u00ad\u200b-\u200d\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitLongParagraph(paragraph: string, maxCharacters = 1800): string[] {
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
      const words = sentence.split(/\s+/);
      for (const word of words) {
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

export function htmlToParagraphs(source: string): { title?: string; paragraphs: string[] } {
  const body = source.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? source;
  const heading = body.match(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/i)?.[1];
  const withoutNoise = body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|svg|math|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<nav\b[^>]*(?:epub:type\s*=\s*["']toc["']|role\s*=\s*["']doc-toc["'])[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\b[^>]*>/gi, '\n\n')
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<\/(p|div|section|article|aside|header|footer|h1|h2|h3|h4|h5|h6|li|blockquote|pre|tr|dt|dd)>/gi, '\n\n')
    .replace(/<\/(td|th)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  const text = decodeHtmlEntities(withoutNoise)
    .replace(/[\u00ad\u200b-\u200d\ufeff]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter((paragraph) => paragraph.length > 1)
    .flatMap((paragraph) => splitLongParagraph(paragraph));

  const title = heading ? plainInlineText(heading) : undefined;
  return { title: title || undefined, paragraphs };
}
