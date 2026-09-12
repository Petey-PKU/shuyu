import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { fallbackLookup, lookupNetworkWord, translateSentence, type LookupResult } from '../services/translation';

interface DictionaryRow {
  word: string;
  phonetic: string;
  translation: string;
  tags: string;
}

interface DictionaryContextValue {
  lookup: (word: string, allowOnline?: boolean) => Promise<LookupResult>;
  translateContext: (sentence: string) => Promise<string | undefined>;
  entryCount: number;
}

const DictionaryContext = createContext<DictionaryContextValue | null>(null);

function cleanMeaning(translation: string) {
  return translation
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^\[网络\]/.test(line))
    .slice(0, 6)
    .join('\n');
}

function DictionaryBridge({ children }: { children: React.ReactNode }) {
  const database = useSQLiteContext();
  const lookup = useCallback(async (word: string, allowOnline = true): Promise<LookupResult> => {
    const normalized = word.toLowerCase();
    const row = await database.getFirstAsync<DictionaryRow>(`
      SELECT word, phonetic, translation, tags FROM entries WHERE word = $word
      UNION ALL
      SELECT entry.word, entry.phonetic, entry.translation, entry.tags
      FROM aliases AS alias
      JOIN entries AS entry ON entry.word = alias.lemma
      WHERE alias.alias = $word
      LIMIT 1
    `, { $word: normalized });
    if (row) {
      return {
        meaning: cleanMeaning(row.translation),
        phonetic: row.phonetic || undefined,
        source: 'offline',
        matchedWord: row.word === normalized ? undefined : row.word,
        tags: row.tags ? row.tags.split(/\s+/).filter(Boolean) : undefined,
      };
    }
    if (!allowOnline) return fallbackLookup(normalized);
    return lookupNetworkWord(normalized);
  }, [database]);
  const value = useMemo(() => ({ lookup, translateContext: translateSentence, entryCount: 120_000 }), [lookup]);
  return <DictionaryContext.Provider value={value}>{children}</DictionaryContext.Provider>;
}

export function DictionaryProvider({ children }: { children: React.ReactNode }) {
  return (
    <SQLiteProvider
      databaseName="shuyu-ecdict-v1.db"
      assetSource={{ assetId: require('../../assets/dictionary/ecdict-core.db') }}
    >
      <DictionaryBridge>{children}</DictionaryBridge>
    </SQLiteProvider>
  );
}

export function useDictionary() {
  const context = useContext(DictionaryContext);
  if (!context) throw new Error('useDictionary must be used inside DictionaryProvider');
  return context;
}
