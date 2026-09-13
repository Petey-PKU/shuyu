import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
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
  dictionaryLoading: boolean;
  dictionaryUnavailable: boolean;
  retryDictionary: () => void;
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

export function DictionaryProvider({ children }: { children: React.ReactNode }) {
  const [database, setDatabase] = useState<SQLiteDatabase | null>(null);
  const [databaseError, setDatabaseError] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const errorScheduled = useRef(false);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialize = useCallback(async (nextDatabase: SQLiteDatabase) => {
    setDatabase(nextDatabase);
  }, []);
  const handleError = useCallback(() => {
    if (errorScheduled.current) return;
    errorScheduled.current = true;
    errorTimer.current = setTimeout(() => {
      errorTimer.current = null;
      setDatabaseError(true);
    }, 0);
  }, []);
  const retryDictionary = useCallback(() => {
    if (errorTimer.current) {
      clearTimeout(errorTimer.current);
      errorTimer.current = null;
    }
    errorScheduled.current = false;
    setDatabase(null);
    setDatabaseError(false);
    setRetryNonce((current) => current + 1);
  }, []);
  const lookup = useCallback(async (word: string, allowOnline = true): Promise<LookupResult> => {
    const normalized = word.toLowerCase();
    if (!database) return allowOnline ? lookupNetworkWord(normalized) : fallbackLookup(normalized);
    try {
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
    } catch {
      // A runtime query failure (for example a closed or damaged database)
      // should enter the same recoverable state as initialization failure.
      handleError();
      if (!allowOnline) return fallbackLookup(normalized);
      try { return await lookupNetworkWord(normalized); }
      catch { return { ...fallbackLookup(normalized), networkError: true }; }
    }
    if (!allowOnline) return fallbackLookup(normalized);
    return lookupNetworkWord(normalized);
  }, [database, handleError]);
  const value = useMemo(() => ({
    lookup,
    translateContext: translateSentence,
    entryCount: database ? 120_000 : 0,
    dictionaryLoading: !database && !databaseError,
    dictionaryUnavailable: databaseError,
    retryDictionary,
  }), [database, databaseError, lookup, retryDictionary]);
  const loader = databaseError ? null : (
    <SQLiteProvider
      key={retryNonce}
      databaseName="shuyu-ecdict-v1.db"
      assetSource={{ assetId: require('../../assets/dictionary/ecdict-core.db') }}
      onInit={initialize}
      onError={handleError}
    >{null}</SQLiteProvider>
  );
  return <DictionaryContext.Provider value={value}>{loader}{children}</DictionaryContext.Provider>;
}

export function useDictionary() {
  const context = useContext(DictionaryContext);
  if (!context) throw new Error('useDictionary must be used inside DictionaryProvider');
  return context;
}
