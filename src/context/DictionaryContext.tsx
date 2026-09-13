import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { fallbackLookup, lookupNetworkWord, translateSentence, type LookupResult } from '../services/translation';

interface WebDictionaryEntry {
  0: string;
  1: string;
  2: string;
  3: string;
}

interface WebDictionaryData {
  entryCount: number;
  entries: WebDictionaryEntry[];
  aliases: Record<string, string>;
}

// Web gets a frequency-ranked subset so offline lookup remains useful without
// forcing the full native SQLite asset into the browser bundle.
const webDictionary = require('../../assets/dictionary/web-core.json') as WebDictionaryData;
const webEntries = new Map(webDictionary.entries.map((entry) => [entry[0].toLowerCase(), entry]));
const webAliases = new Map(Object.entries(webDictionary.aliases));

function cleanMeaning(translation: string) {
  return translation
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^\[网络\]/.test(line))
    .slice(0, 6)
    .join('\n');
}

interface DictionaryContextValue {
  lookup: (word: string, allowOnline?: boolean) => Promise<LookupResult>;
  translateContext: (sentence: string) => Promise<string | undefined>;
  entryCount: number;
  dictionaryLoading: boolean;
  dictionaryUnavailable: boolean;
  retryDictionary: () => void;
}

const DictionaryContext = createContext<DictionaryContextValue | null>(null);

export function DictionaryProvider({ children }: { children: React.ReactNode }) {
  const lookup = useCallback(async (word: string, allowOnline = true) => {
    const normalized = word.toLowerCase();
    const direct = webEntries.get(normalized);
    const matchedWord = direct ? normalized : webAliases.get(normalized);
    const row = direct ?? (matchedWord ? webEntries.get(matchedWord) : undefined);
    if (row) {
      return {
        meaning: cleanMeaning(row[2]),
        phonetic: row[1] || undefined,
        source: 'offline' as const,
        matchedWord: matchedWord && matchedWord !== normalized ? matchedWord : undefined,
        tags: row[3] ? row[3].split(/\s+/).filter(Boolean) : undefined,
      };
    }
    if (!allowOnline) return fallbackLookup(normalized);
    return lookupNetworkWord(word);
  }, []);
  const value = useMemo(() => ({ lookup, translateContext: translateSentence, entryCount: webDictionary.entryCount, dictionaryLoading: false, dictionaryUnavailable: false, retryDictionary: () => undefined }), [lookup]);
  return <DictionaryContext.Provider value={value}>{children}</DictionaryContext.Provider>;
}

export function useDictionary() {
  const context = useContext(DictionaryContext);
  if (!context) throw new Error('useDictionary must be used inside DictionaryProvider');
  return context;
}
