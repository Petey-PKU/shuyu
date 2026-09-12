import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { fallbackLookup, lookupNetworkWord, translateSentence, type LookupResult } from '../services/translation';

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
    if (!allowOnline) return fallbackLookup(word);
    return lookupNetworkWord(word);
  }, []);
  const value = useMemo(() => ({ lookup, translateContext: translateSentence, entryCount: 0, dictionaryLoading: false, dictionaryUnavailable: false, retryDictionary: () => undefined }), [lookup]);
  return <DictionaryContext.Provider value={value}>{children}</DictionaryContext.Provider>;
}

export function useDictionary() {
  const context = useContext(DictionaryContext);
  if (!context) throw new Error('useDictionary must be used inside DictionaryProvider');
  return context;
}
