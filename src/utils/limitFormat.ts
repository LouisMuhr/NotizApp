import type { AppLocale } from '../i18n';

type T = (key: string, options?: Record<string, unknown>) => string;

const intl = (locale: AppLocale) => (locale === 'en' ? 'en-US' : 'de-DE');

/** "Do., 17. Sep., 16:32" bzw. "Thu, Sep 17, 4:32 PM" — Datum MIT Uhrzeit (Entscheidung 13). */
export function formatDateTime(date: Date, locale: AppLocale): string {
  return date.toLocaleString(intl(locale), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "16:32" bzw. "4:32 PM". */
export function formatTime(date: Date, locale: AppLocale): string {
  return date.toLocaleTimeString(intl(locale), { hour: '2-digit', minute: '2-digit' });
}

/**
 * Text fuer "wann ist der naechste Lauf moeglich", relativ zu `now`:
 * - unter 60 Minuten: "In 30 Minuten verfuegbar"
 * - heute:            "Ab 16:32 verfuegbar"
 * - spaeter:          "Ab Do., 17. Sep., 16:32 verfuegbar"
 * Nie in aufgerundeten Tagen (E6).
 */
export function formatAvailability(nextAllowedAt: Date, now: Date, locale: AppLocale, t: T): string {
  const diffMs = nextAllowedAt.getTime() - now.getTime();
  const minutes = Math.max(1, Math.ceil(diffMs / 60_000));
  if (minutes < 60) return t('limit.inMinutes', { count: minutes });
  const sameDay =
    nextAllowedAt.getFullYear() === now.getFullYear() &&
    nextAllowedAt.getMonth() === now.getMonth() &&
    nextAllowedAt.getDate() === now.getDate();
  if (sameDay) return t('limit.atTime', { time: formatTime(nextAllowedAt, locale) });
  return t('limit.atDate', { date: formatDateTime(nextAllowedAt, locale) });
}
