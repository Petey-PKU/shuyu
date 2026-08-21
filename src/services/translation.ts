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

const requestCache = new Map<string, string | undefined>();

async function translate(text: string, timeoutMs = 3200): Promise<string | undefined> {
  if (requestCache.has(text)) return requestCache.get(text);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const endpoint = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-CN`;
    const response = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return undefined;
    const data = await response.json();
    const translated = data?.responseData?.translatedText;
    if (typeof translated !== 'string' || !translated.trim() || /MYMEMORY WARNING/i.test(translated)) return undefined;
    const value = translated.trim();
    requestCache.set(text, value);
    return value;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
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
  const meaning = await translate(word.toLowerCase(), 2500);
  return meaning ? { meaning, source: 'network' } : fallbackLookup(word);
}

export async function translateSentence(sentence: string): Promise<string | undefined> {
  if (!sentence.trim()) return undefined;
  return translate(sentence, 3800);
}
