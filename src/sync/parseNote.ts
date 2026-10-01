// Client fuer /api/parse-note (KI-Strukturierung diktierter Notizen, nur Pro).
// Wirft nie: jeder Fehler kommt als { error } zurueck, damit das Sprach-Sheet
// das Diktat dann unveraendert speichern kann.

import { getSupabase } from './supabaseClient';
import { BRIDGE_URL, bridgePost } from './bridge';
import type { ReminderRecurrence } from '../models/Note';

export interface StructuredNoteResult {
  title: string;
  content: string;
  checklist: string[];
  category: string;
  reminder: {
    at: string; // lokale Zeit "YYYY-MM-DDTHH:mm"
    recurrence: ReminderRecurrence;
    weekday: number | null;
    dayOfMonth: number | null;
  } | null;
}

export type ParseNoteError =
  | 'limit_reached'
  | 'plan_required'
  | 'unavailable'; // Netz, Timeout, KI, Server — fuer den User alles dasselbe

export interface ParseNoteRequest {
  transcript: string;
  title: string;
  categories: string[];
  locale: 'de' | 'en';
  /** Fuer Tests injizierbar. */
  now?: Date;
}

const TIMEOUT_MS = 15000;

const pad = (n: number) => String(n).padStart(2, '0');

/** Lokale Geraetezeit als "YYYY-MM-DDTHH:mm" — die Bridge rechnet nie mit Zeitzonen. */
export function toLocalNow(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export async function parseNoteRemote(
  req: ParseNoteRequest,
): Promise<{ result: StructuredNoteResult } | { error: ParseNoteError }> {
  const supabase = getSupabase();
  if (!BRIDGE_URL || !supabase) return { error: 'unavailable' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { error: 'unavailable' };
    const res = await bridgePost(
      '/api/parse-note',
      session.access_token,
      {
        transcript: req.transcript,
        title: req.title,
        categories: req.categories,
        localNow: toLocalNow(req.now ?? new Date()),
        locale: req.locale,
      },
      controller.signal,
    );
    if (res.ok) return { result: (await res.json()) as StructuredNoteResult };
    const body = await res.json().catch(() => ({}));
    if (res.status === 429 && body?.error === 'limit_reached') return { error: 'limit_reached' };
    if (res.status === 403 && body?.error === 'plan_required') return { error: 'plan_required' };
    return { error: 'unavailable' };
  } catch {
    return { error: 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}
