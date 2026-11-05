import { Linking } from 'react-native';
import type { AppLocale } from '../i18n';

// Einzige Fassung von Datenschutzerklärung und Impressum liegt in der Webapp
// (webapp/app/privacy + impressum, englisch unter /en/…, Routen in webapp/components/LegalPage.tsx).
// `app.json` → privacyPolicyUrl zeigt auf die deutsche Fassung, die zur englischen verlinkt.
const BASE = 'https://www.velmnote.com';

export function privacyUrl(locale: AppLocale): string {
  return `${BASE}${locale === 'en' ? '/en/privacy' : '/privacy'}`;
}

export function imprintUrl(locale: AppLocale): string {
  return `${BASE}${locale === 'en' ? '/en/imprint' : '/impressum'}`;
}

export function openPrivacyPolicy(locale: AppLocale) {
  Linking.openURL(privacyUrl(locale)).catch(() => {});
}

export function openImprint(locale: AppLocale) {
  Linking.openURL(imprintUrl(locale)).catch(() => {});
}
