import { supabase } from '@/lib/supabase';
import type { Tier } from '@/lib/tier';

// Synthese aus der Webapp: derselbe Bridge-Endpunkt wie in der App (`POST /api/synthesize`, Supabase-Token).
// Rate-Limit und Abrechnung entscheidet allein der Server; hier wird nur angezeigt.

const BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL ?? 'https://bridge-three-coral.vercel.app';

interface LimitProfile { tier: Tier | null; ai_last_run: string | null; ai_runs_today: number | null; ai_day_reset: string | null }

/** Gleiche Regel wie `computeNextAllowedAt` in der App (src/sync/subscriptionService.ts) und in der Bridge. */
export function computeNextAllowedAt(p: LimitProfile): Date | null {
  const tier = p.tier ?? 'free';
  if (tier === 'pro') {
    if (p.ai_day_reset && (p.ai_runs_today ?? 0) >= 10) {
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
  | { kind: 'error'; message: string };

const SERVER_ERRORS: Record<string, string> = {
  ai_unavailable: 'Die KI ist gerade nicht erreichbar. Dein Lauf wurde nicht verbraucht.',
  ai_response_invalid: 'Die KI-Antwort war unbrauchbar. Dein Lauf wurde nicht verbraucht.',
  synthesis_failed: 'Die Synthese ist fehlgeschlagen. Dein Lauf wurde nicht verbraucht.',
  profile_unavailable: 'Dein Profil konnte gerade nicht geladen werden. Bitte später erneut versuchen.',
  internal: 'Unerwarteter Serverfehler. Bitte später erneut versuchen.',
};

export async function runSynthesis(): Promise<SynthesisResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { kind: 'error', message: 'Nicht angemeldet.' };
  let res: Response;
  try {
    res = await fetch(`${BRIDGE_URL}/api/synthesize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'de' }),
    });
  } catch {
    return { kind: 'error', message: 'Keine Verbindung zum Server. Bitte später erneut versuchen.' };
  }
  const json = await res.json().catch(() => ({}));
  if (res.status === 429) {
    if (json?.error === 'busy') return { kind: 'busy' };
    return { kind: 'limit', nextAllowedAt: json?.next_allowed_at ? new Date(json.next_allowed_at) : null };
  }
  if (!res.ok) {
    const code = typeof json?.error === 'string' ? json.error : 'internal';
    return { kind: 'error', message: SERVER_ERRORS[code] ?? SERVER_ERRORS.internal };
  }
  if (json.message === 'no_feed_notes' || json.message === 'no_new_notes') return { kind: 'no_new' };
  if (json.message === 'nothing_assigned') return { kind: 'nothing_assigned' };
  return { kind: 'ok', created: json.threads_created ?? 0, updated: json.threads_updated ?? 0 };
}

/** Ergebnis als kurzer Satz (wie in der App). */
export function describeResult(r: { created: number; updated: number }): string {
  const parts: string[] = [];
  if (r.created) parts.push(`${r.created} ${r.created === 1 ? 'Thread' : 'Threads'} erstellt`);
  if (r.updated) parts.push(`${r.updated} ${r.updated === 1 ? 'Thread' : 'Threads'} aktualisiert`);
  return parts.length ? parts.join(', ') : 'Fertig — nichts Neues.';
}

/** „In 30 Minuten verfügbar" / „Ab 16:32 verfügbar" / „Ab Do., 17. Sep., 16:32 verfügbar" — nie aufgerundete Tage. */
export function formatAvailability(next: Date, now = new Date()): string {
  const minutes = Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 60_000));
  if (minutes < 60) return minutes === 1 ? 'In 1 Minute verfügbar' : `In ${minutes} Minuten verfügbar`;
  const sameDay = next.toDateString() === now.toDateString();
  if (sameDay) return `Ab ${next.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} verfügbar`;
  return `Ab ${next.toLocaleString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} verfügbar`;
}
