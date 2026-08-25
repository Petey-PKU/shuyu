import { decodeHtmlEntities } from './markup';

export interface LookupResult {
  meaning: string;
  phonetic?: string;
  source: 'offline' | 'network' | 'fallback';
  matchedWord?: string;
  tags?: string[];
}

const fallbackGlosses: Record<string, string> = {
  the: '这；这个（定冠词）', a: '一个；一（不定冠词）', an: '一个；一（不定冠词）',
  and: '和；并且', but: '但是', or: '或者', in: '在……里面', on: '在……上面',
  at: '在；于', to: '向；到；为了', from: '从；来自', with: '和；带着', for: '为了；给',
  of: '……的', is: '是', was: '是（过去式）', are: '是', were: '是（过去式）',
  be: '成为；是', have: '有；拥有', had: '有（过去式）', not: '不；没有',
  she: '她', he: '他', they: '他们；她们；它们', it: '它；这件事', we: '我们',
  you: '你；你们', i: '我', light: '光；灯；轻的', book: '书', read: '阅读',
  quiet: '安静的；平静的', small: '小的', world: '世界', beautiful: '美丽的',
  night: '夜晚', morning: '早晨', home: '家；回家', story: '故事',
};

const resultCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string | undefined>>();
const MAX_CACHE_ENTRIES = 240;
const MAX_QUERY_BYTES = 450;

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function utf8ByteLength(text: string): number {
  let length = 0;
  for (const character of text) {
    const point = character.codePointAt(0) ?? 0;
    length += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return length;
}

export function splitTranslationText(text: string): string[] {
  if (utf8ByteLength(text) <= MAX_QUERY_BYTES) return [text];
  const units = text.match(/[^,;:—.!?。！？]+[,;:—.!?。！？]+["'”’)]*|[^,;:—.!?。！？]+$/g) ?? [text];
  const chunks: string[] = [];
  let current = '';
  const pushCurrent = () => {
    if (current.trim()) chunks.push(current.trim());
    current = '';
  };
  for (const rawUnit of units) {
    const unit = rawUnit.trim();
    if (!unit) continue;
    const combined = current ? `${current} ${unit}` : unit;
    if (utf8ByteLength(combined) <= MAX_QUERY_BYTES) {
      current = combined;
      continue;
    }
    pushCurrent();
    let wordChunk = '';
    for (const word of unit.split(/\s+/)) {
      const combinedWords = wordChunk ? `${wordChunk} ${word}` : word;
      if (utf8ByteLength(combinedWords) <= MAX_QUERY_BYTES) {
        wordChunk = combinedWords;
      } else {
        if (wordChunk) chunks.push(wordChunk);
        wordChunk = word;
      }
    }
    current = wordChunk;
  }
  pushCurrent();
  return chunks;
}

function remember(key: string, value: string) {
  resultCache.delete(key);
  resultCache.set(key, value);
  if (resultCache.size > MAX_CACHE_ENTRIES) {
    const oldest = resultCache.keys().next().value as string | undefined;
    if (oldest) resultCache.delete(oldest);
  }
}

function cleanTranslation(value: unknown, source: string): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = decodeHtmlEntities(value).replace(/\s+/g, ' ').trim();
  if (!cleaned || /MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID LANGUAGE|USAGE LIMIT/i.test(cleaned)) return undefined;
  if (normalizeText(cleaned).toLowerCase() === normalizeText(source).toLowerCase()) return undefined;
  return cleaned;
}

async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<any | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) return undefined;
    return await response.json();
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

async function requestCustomProvider(text: string, timeoutMs: number): Promise<string | undefined> {
  const endpoint = process.env.EXPO_PUBLIC_TRANSLATION_ENDPOINT?.trim();
  if (!endpoint) return undefined;
  const data = await fetchJson(endpoint, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, source: 'en', target: 'zh-CN' }),
  }, timeoutMs);
  return cleanTranslation(data?.translation ?? data?.translatedText ?? data?.data?.translation, text);
}

async function requestMyMemory(text: string, timeoutMs: number): Promise<string | undefined> {
  const endpoint = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-CN&mt=1`;
  const data = await fetchJson(endpoint, { headers: { Accept: 'application/json' } }, timeoutMs);
  const primary = cleanTranslation(data?.responseData?.translatedText, text);
  if (primary) return primary;
  if (!Array.isArray(data?.matches)) return undefined;
  for (const match of data.matches) {
    const candidate = cleanTranslation(match?.translation, text);
    if (candidate) return candidate;
  }
  return undefined;
}

async function requestChunk(text: string, timeoutMs: number, attempts: number): Promise<string | undefined> {
  const cached = resultCache.get(text);
  if (cached) return cached;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const custom = await requestCustomProvider(text, timeoutMs);
    const translated = custom ?? await requestMyMemory(text, timeoutMs);
    if (translated) {
      remember(text, translated);
      return translated;
    }
  }
  return undefined;
}

async function translate(text: string, timeoutMs: number, attempts: number): Promise<string | undefined> {
  const normalized = normalizeText(text);
  if (!normalized) return undefined;
  const cached = resultCache.get(normalized);
  if (cached) return cached;
  const pending = inFlight.get(normalized);
  if (pending) return pending;

  const request = (async () => {
    const chunks = splitTranslationText(normalized);
    const translated: string[] = [];
    for (const chunk of chunks) {
      const value = await requestChunk(chunk, timeoutMs, attempts);
      if (!value) return undefined;
      translated.push(value);
    }
    const value = translated.join(' ').trim();
    if (value) remember(normalized, value);
    return value || undefined;
  })();
  inFlight.set(normalized, request);
  try {
    return await request;
  } finally {
    inFlight.delete(normalized);
  }
}

export function fallbackLookup(word: string): LookupResult {
  const normalized = word.toLowerCase();
  return {
    meaning: fallbackGlosses[normalized] || '离线核心词典暂未收录这个词',
    source: 'fallback',
  };
}

export async function lookupNetworkWord(word: string): Promise<LookupResult> {
  const meaning = await translate(word.toLowerCase(), 4_500, 1);
  return meaning ? { meaning, source: 'network' } : fallbackLookup(word);
}

export async function translateSentence(sentence: string): Promise<string | undefined> {
  return translate(sentence, 7_000, 2);
}
