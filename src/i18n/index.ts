import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';
import de from './locales/de';
import en from './locales/en';

export type AppLocale = 'de' | 'en';
export const SUPPORTED_LOCALES: AppLocale[] = ['de', 'en'];
export const DEFAULT_LOCALE: AppLocale = 'de';

export const i18n = new I18n({ de, en });
i18n.defaultLocale = DEFAULT_LOCALE;
i18n.enableFallback = true;

export function detectDeviceLocale(): AppLocale {
  const tag = Localization.getLocales()[0]?.languageCode;
  return tag === 'en' ? 'en' : DEFAULT_LOCALE;
}

export function setI18nLocale(locale: AppLocale) {
  i18n.locale = locale;
}

export function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options);
}
