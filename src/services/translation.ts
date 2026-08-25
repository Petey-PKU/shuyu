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
const MAX_BING_QUERY_CHARACTERS = 950;
const BING_TRANSLATOR_PAGE = 'https://www.bing.com/translator';
const BING_USER_AGENT = 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36';

interface BingPageCredentials {
  key: string;
  token: string;
  ig: string;
  iid: string;
  expiresAt: number;
}

interface BingSession extends BingPageCredentials {
  origin: string;
  referer: string;
  cookie?: string;
}

let bingSession: BingSession | undefined;
let bingSessionRequest: Promise<BingSession | undefined> | undefined;

export function getTranslationProviderSummary(): string {
  const endpoint = process.env.EXPO_PUBLIC_TRANSLATION_ENDPOINT?.trim();
  const configuredName = process.env.EXPO_PUBLIC_TRANSLATION_PROVIDER_NAME?.trim();
  const builtIn = '必应（实验性）· MyMemory 兜底';
  if (!endpoint) return builtIn;
  return `${configuredName || '自定义翻译服务'}优先 · ${builtIn}`;
}

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

export function splitBingTranslationText(text: string): string[] {
  if (Array.from(text).length <= MAX_BING_QUERY_CHARACTERS) return [text];
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
    if (Array.from(combined).length <= MAX_BING_QUERY_CHARACTERS) {
      current = combined;
      continue;
    }
    pushCurrent();
    const words = unit.split(/\s+/);
    let wordChunk = '';
    for (const word of words) {
      const combinedWords = wordChunk ? `${wordChunk} ${word}` : word;
      if (Array.from(combinedWords).length <= MAX_BING_QUERY_CHARACTERS) {
        wordChunk = combinedWords;
        continue;
      }
      if (wordChunk) chunks.push(wordChunk);
      const characters = Array.from(word);
      while (characters.length > MAX_BING_QUERY_CHARACTERS) {
        chunks.push(characters.splice(0, MAX_BING_QUERY_CHARACTERS).join(''));
      }
      wordChunk = characters.join('');
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

export function parseBingPageCredentials(html: string, now = Date.now()): BingPageCredentials | undefined {
  const prevention = html.match(/params_AbusePreventionHelper\s*=\s*\[\s*(\d+)\s*,\s*["']([^"']+)["']/i);
  const ig = html.match(/["']IG["']\s*:\s*["']([^"']+)["']/i)
    ?? html.match(/["']ig["']\s*:\s*["']([^"']+)["']/i);
  const iidMatches = [...html.matchAll(/data-iid=["']([^"']+)["']/gi)];
  const iid = iidMatches.at(-1)?.[1];
  if (!prevention?.[1] || !prevention[2] || !ig?.[1] || !iid) return undefined;
  const issuedAt = Number(prevention[1]);
  const plausibleIssuedAt = Number.isFinite(issuedAt) && issuedAt > now - 24 * 60 * 60 * 1000
    ? issuedAt
    : now;
  return {
    key: prevention[1],
    token: prevention[2],
    ig: ig[1],
    iid,
    expiresAt: plausibleIssuedAt + 55 * 60 * 1000,
  };
}

export function parseBingTranslation(data: any, source: string): string | undefined {
  if (!Array.isArray(data) || data.length === 0) return undefined;
  return cleanTranslation(data[0]?.translations?.[0]?.text, source);
}

function getCookieHeader(headers: Headers): string | undefined {
  const withSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  let cookieLines = withSetCookie.getSetCookie?.() ?? [];
  if (!cookieLines.length) {
    const combined = headers.get('set-cookie');
    if (combined) cookieLines = combined.split(/,(?=\s*[^;,=\s]+=[^;,]+)/);
  }
  const cookies = cookieLines
    .map((line) => line.split(';', 1)[0]?.trim())
    .filter((cookie): cookie is string => Boolean(cookie));
  return cookies.length ? cookies.join('; ') : undefined;
}

function getTrustedBingOrigin(responseUrl: string): string | undefined {
  try {
    const url = new URL(responseUrl);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || (hostname !== 'bing.com' && !hostname.endsWith('.bing.com'))) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
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

async function fetchText(url: string, init: RequestInit, timeoutMs: number): Promise<{ response: Response; text: string } | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) return undefined;
    return { response, text: await response.text() };
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

async function getBingSession(timeoutMs: number): Promise<BingSession | undefined> {
  if (bingSession && bingSession.expiresAt > Date.now() + 60_000) return bingSession;
  if (bingSessionRequest) return bingSessionRequest;
  bingSessionRequest = (async () => {
    const page = await fetchText(BING_TRANSLATOR_PAGE, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': BING_USER_AGENT,
      },
      credentials: 'include',
      redirect: 'follow',
      cache: 'no-store',
    }, timeoutMs);
    if (!page) return undefined;
    const credentials = parseBingPageCredentials(page.text);
    const origin = getTrustedBingOrigin(page.response.url || BING_TRANSLATOR_PAGE);
    if (!credentials || !origin) return undefined;
    bingSession = {
      ...credentials,
      origin,
      referer: page.response.url || `${origin}/translator`,
      cookie: getCookieHeader(page.response.headers),
    };
    return bingSession;
  })();
  try {
    return await bingSessionRequest;
  } finally {
    bingSessionRequest = undefined;
  }
}

async function requestBingChunk(text: string, timeoutMs: number): Promise<string | undefined> {
  const session = await getBingSession(timeoutMs);
  if (!session) return undefined;
  const body = [
    ['fromLang', 'en'],
    ['to', 'zh-Hans'],
    ['text', text],
    ['token', session.token],
    ['key', session.key],
  ].map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    Origin: session.origin,
    Referer: session.referer,
    'User-Agent': BING_USER_AGENT,
    'X-Requested-With': 'XMLHttpRequest',
  };
  if (session.cookie) headers.Cookie = session.cookie;
  const data = await fetchJson(
    `${session.origin}/ttranslatev3?isVertical=1&IG=${encodeURIComponent(session.ig)}&IID=${encodeURIComponent(session.iid)}`,
    { method: 'POST', headers, body, credentials: 'include' },
    timeoutMs,
  );
  const translated = parseBingTranslation(data, text);
  if (!translated && bingSession?.key === session.key) bingSession = undefined;
  return translated;
}

async function requestBing(text: string, timeoutMs: number, attempts: number): Promise<string | undefined> {
  const chunks = splitBingTranslationText(text);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const translated: string[] = [];
    for (const chunk of chunks) {
      const value = await requestBingChunk(chunk, timeoutMs);
      if (!value) break;
      translated.push(value);
    }
    if (translated.length === chunks.length) return translated.join('').trim() || undefined;
  }
  return undefined;
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

async function requestFallbackChunk(text: string, timeoutMs: number, attempts: number): Promise<string | undefined> {
  const cached = resultCache.get(text);
  if (cached) return cached;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const translated = await requestMyMemory(text, timeoutMs);
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
    // A configured official provider gets the complete sentence first. The
    // built-in Bing-compatible path then translates directly from the device.
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const custom = await requestCustomProvider(normalized, timeoutMs);
      if (custom) {
        remember(normalized, custom);
        return custom;
      }
    }
    const bing = await requestBing(normalized, timeoutMs, attempts);
    if (bing) {
      remember(normalized, bing);
      return bing;
    }
    const chunks = splitTranslationText(normalized);
    const translated: string[] = [];
    for (const chunk of chunks) {
      const value = await requestFallbackChunk(chunk, timeoutMs, attempts);
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
