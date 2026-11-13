import { supabase } from '@/lib/supabase';
import type { Tier } from '@/lib/tier';
import type { Locale, Messages } from '@/lib/i18n';

// Synthese aus der Webapp: derselbe Bridge-Endpunkt wie in der App (`POST /api/synthesize`, Supabase-Token).
// Rate-Limit und Abrechnung entscheidet allein der Server; hier wird nur angezeigt.

const BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL ?? 'https://bridge-three-coral.vercel.app';

/** Pro-Synthesen pro UTC-Tag, wie in der Bridge. */
const PRO_SYNTHESES_PER_DAY = 3;

interface LimitProfile { tier: Tier | null; ai_last_run: string | null; ai_runs_today: number | null; ai_day_reset: string | null }

/** Gleiche Regel wie `computeNextAllowedAt` in der App (src/sync/subscriptionService.ts) und in der Bridge. */
export function computeNextAllowedAt(p: LimitProfile): Date | null {
  const tier = p.tier ?? 'free';
  if (tier === 'pro') {
    if (p.ai_day_reset && (p.ai_runs_today ?? 0) >= PRO_SYNTHESES_PER_DAY) {
      const midnight = new Date(p.ai_day_reset); // 'YYYY-MM-DD' → 00:00 UTC
      midnight.setUTCDate(midnight.getUTCDate() + 1);
      return midnight;
    }
    return null;
  }
  if (!p.ai_last_run) return null;
  const last = new Date(p.ai_last_run).getTime();
  return new Date(last + (tier === 'free' ? 7 * 24 : 24) * 60 * 60 * 1000);
}

/** null = unbekannt (Profil nicht lesbar) — die UI behauptet dann weder Sperre noch Freigabe. */
export async function fetchNextAllowedAt(userId: string): Promise<{ nextAllowedAt: Date | null } | null> {
  const { data, error } = await supabase
    .from('profiles').select('tier, ai_last_run, ai_runs_today, ai_day_reset').eq('id', userId).maybeSingle();
  if (error) return null;
  if (!data) return { nextAllowedAt: null }; // noch kein Profil → nie gelaufen
  return { nextAllowedAt: computeNextAllowedAt(data as LimitProfile) };
}

export type SynthesisResult =
  | { kind: 'ok'; created: number; updated: number }
  | { kind: 'no_new' }
  | { kind: 'nothing_assigned' }
  | { kind: 'limit'; nextAllowedAt: Date | null }
  | { kind: 'busy' }
  /** `code` = Fehler-Code des Servers bzw. `network`/`not_signed_in`; Text kommt aus lib/i18n.tsx */
  | { kind: 'error'; code: string };

export async function runSynthesis(locale: Locale): Promise<SynthesisResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { kind: 'error', code: 'not_signed_in' };
  let res: Response;
  try {
    res = await fetch(`${BRIDGE_URL}/api/synthesize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      // Die Bridge schreibt Thread-Titel und Zusammenfassungen in dieser Sprache
      body: JSON.stringify({ locale }),
    });
  } catch {
    return { kind: 'error', code: 'network' };
  }
  const json = await res.json().catch(() => ({}));
  if (res.status === 429) {
    if (json?.error === 'busy') return { kind: 'busy' };
    return { kind: 'limit', nextAllowedAt: json?.next_allowed_at ? new Date(json.next_allowed_at) : null };
  }
  if (!res.ok) return { kind: 'error', code: typeof json?.error === 'string' ? json.error : 'internal' };
  if (json.message === 'no_feed_notes' || json.message === 'no_new_notes') return { kind: 'no_new' };
  if (json.message === 'nothing_assigned') return { kind: 'nothing_assigned' };
  return { kind: 'ok', created: json.threads_created ?? 0, updated: json.threads_updated ?? 0 };
}

/** Text zu einem Fehler-Code; unbekannte Codes → allgemeiner Serverfehler. */
export function synthErrorText(t: Messages, code: string): string {
  return t.synth.errors[code] ?? t.synth.errors.internal;
}

/** Ergebnis als kurzer Satz (wie in der App). */
export function describeResult(t: Messages, r: { created: number; updated: number }): string {
  const parts: string[] = [];
  if (r.created) parts.push(t.synth.created(r.created));
  if (r.updated) parts.push(t.synth.updated(r.updated));
  return parts.length ? parts.join(', ') : t.synth.nothingNew;
}

/** „In 30 Minuten verfügbar" / „Ab 16:32 verfügbar" / „Ab Do., 17. Sep., 16:32 verfügbar" — nie aufgerundete Tage. */
export function formatAvailability(t: Messages, next: Date, now = new Date()): string {
  const minutes = Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 60_000));
  if (minutes < 60) return t.synth.inMinutes(minutes);
  const sameDay = next.toDateString() === now.toDateString();
  if (sameDay) return t.synth.from(next.toLocaleTimeString(t.dateLocale, { hour: '2-digit', minute: '2-digit' }));
  return t.synth.from(next.toLocaleString(t.dateLocale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));
}
