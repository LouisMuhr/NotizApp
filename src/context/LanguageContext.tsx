import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppLocale,
  DEFAULT_LOCALE,
  detectDeviceLocale,
  i18n,
  setI18nLocale,
  t as translate,
} from '../i18n';

const LANGUAGE_KEY = '@notizapp_language';

export type LanguagePreference = AppLocale | 'system';

interface LanguageContextType {
  locale: AppLocale;
  preference: LanguagePreference;
  setPreference: (preference: LanguagePreference) => void;
  t: typeof translate;
}

const initialLocale = detectDeviceLocale();
setI18nLocale(initialLocale);

const LanguageContext = createContext<LanguageContextType>({
  locale: initialLocale,
  preference: 'system',
  setPreference: () => {},
  t: translate,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<LanguagePreference>('system');
  const [locale, setLocale] = useState<AppLocale>(initialLocale);

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_KEY).then((stored) => {
      if (stored === 'de' || stored === 'en') {
        setPreferenceState(stored);
        setLocale(stored);
        setI18nLocale(stored);
      }
    });
  }, []);

  const setPreference = (next: LanguagePreference) => {
    setPreferenceState(next);
    const resolved = next === 'system' ? detectDeviceLocale() : next;
    setLocale(resolved);
    setI18nLocale(resolved);
    if (next === 'system') {
      AsyncStorage.removeItem(LANGUAGE_KEY);
    } else {
      AsyncStorage.setItem(LANGUAGE_KEY, next);
    }
  };

  return (
    <LanguageContext.Provider value={{ locale, preference, setPreference, t: translate }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);

export { i18n, DEFAULT_LOCALE };
