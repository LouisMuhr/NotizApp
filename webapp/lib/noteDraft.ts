// Neue Notiz aus der Webapp: Prüfung und Erinnerungs-Felder. Client und Server (`/api/notes`) nutzen
// dieselben Regeln. Keine Imports mit `@/` — die Jest-Tests im Repo-Root laden die Datei direkt.

export type Recurrence = 'once' | 'daily' | 'weekly' | 'monthly';

/** Erinnerung wie die App sie liest (src/sync/remoteNotes.ts): klingeln tut sie nur auf dem Handy. */
export interface ReminderFields {
  reminder_at: string;
  reminder_recurrence: Recurrence;
  /** Expo-Zählung wie in der App: 1 = Sonntag … 7 = Samstag */
  reminder_weekday: number | null;
  reminder_day_of_month: number | null;
}

export interface NoteDraft {
  title: string;
  content: string;
  category: string;
  threadId: string;
  includeInThreads: boolean;
  reminder: ReminderFields | null;
}

/** Fehler-Codes: der Server liefert sie als `{ error }`, der Client übersetzt sie (lib/i18n.tsx). */
export type NoteError =
  | 'empty' | 'title_too_long' | 'content_too_long'
  | 'reminder_incomplete_once' | 'reminder_incomplete_recurring' | 'reminder_past' | 'reminder_invalid'
  | 'unauthorized' | 'network' | 'internal';

export const MAX_TITLE = 500;
export const MAX_CONTENT = 50_000; // wie beim Bookmarklet (/api/note)
const RECURRENCES: Recurrence[] = ['once', 'daily', 'weekly', 'monthly'];

/** Eingaben im Fenster: Uhrzeit „HH:MM", Datum+Zeit aus `datetime-local` („YYYY-MM-DDTHH:MM", Ortszeit). */
export interface ReminderInput {
  recurrence: Recurrence | null;
  dateTime: string;
  time: string;
  weekday: number;
  dayOfMonth: number;
}

function parseTime(time: string): [number, number] | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h < 24 && min < 60 ? [h, min] : null;
}

/**
 * Erinnerungs-Eingabe → Felder für die Datenbank. Bei Wiederholungen zählt für die App nur die Uhrzeit
 * (plus Wochentag bzw. Monatstag); `reminder_at` ist der nächste Termin, damit die Notiz ihn anzeigen kann.
 */
export function buildReminder(input: ReminderInput, now = new Date()): { reminder: ReminderFields | null } | { error: NoteError } {
  const r = input.recurrence;
  if (!r) return { reminder: null };
  if (r === 'once') {
    if (!input.dateTime) return { error: 'reminder_incomplete_once' };
    const at = new Date(input.dateTime);
    if (Number.isNaN(at.getTime())) return { error: 'reminder_incomplete_once' };
    if (at.getTime() <= now.getTime()) return { error: 'reminder_past' };
    return { reminder: { reminder_at: at.toISOString(), reminder_recurrence: 'once', reminder_weekday: null, reminder_day_of_month: null } };
  }
  const hm = parseTime(input.time);
  if (!hm) return { error: 'reminder_incomplete_recurring' };
  const at = new Date(now); at.setHours(hm[0], hm[1], 0, 0);
  if (r === 'daily') {
    if (at <= now) at.setDate(at.getDate() + 1);
    return { reminder: { reminder_at: at.toISOString(), reminder_recurrence: 'daily', reminder_weekday: null, reminder_day_of_month: null } };
  }
  if (r === 'weekly') {
    const wd = input.weekday;
    if (!Number.isInteger(wd) || wd < 1 || wd > 7) return { error: 'reminder_invalid' };
    let diff = (wd - 1 - at.getDay() + 7) % 7;
    if (diff === 0 && at <= now) diff = 7;
    at.setDate(at.getDate() + diff);
    return { reminder: { reminder_at: at.toISOString(), reminder_recurrence: 'weekly', reminder_weekday: wd, reminder_day_of_month: null } };
  }
  const dom = input.dayOfMonth;
  if (!Number.isInteger(dom) || dom < 1 || dom > 31) return { error: 'reminder_invalid' };
  // Nächster Monat, in dem der Tag vorkommt (kurze Monate: wie die App auf den letzten Tag kürzen)
  for (let k = 0; k < 3; k++) {
    const y = now.getFullYear(), mo = now.getMonth() + k;
    const last = new Date(y, mo + 1, 0).getDate();
    const cand = new Date(y, mo, Math.min(dom, last), hm[0], hm[1], 0, 0);
    if (cand > now) return { reminder: { reminder_at: cand.toISOString(), reminder_recurrence: 'monthly', reminder_weekday: null, reminder_day_of_month: dom } };
  }
  return { error: 'reminder_invalid' };
}

/** Prüft einen Entwurf (Client vor dem Senden, Server vor dem Schreiben). null = in Ordnung. */
export function validateDraft(d: Partial<NoteDraft> | null | undefined, now = new Date()): NoteError | null {
  if (!d || typeof d !== 'object') return 'empty';
  const title = typeof d.title === 'string' ? d.title.trim() : '';
  const content = typeof d.content === 'string' ? d.content.trim() : '';
  // Wie in der App: ein Titel oder ein Inhalt genügt.
  if (!title && !content) return 'empty';
  if (title.length > MAX_TITLE) return 'title_too_long';
  if (content.length > MAX_CONTENT) return 'content_too_long';
  const r = d.reminder;
  if (r) {
    if (!RECURRENCES.includes(r.reminder_recurrence)) return 'reminder_invalid';
    const at = new Date(r.reminder_at);
    if (typeof r.reminder_at !== 'string' || Number.isNaN(at.getTime())) return 'reminder_invalid';
    if (r.reminder_recurrence === 'weekly' && !(Number.isInteger(r.reminder_weekday) && r.reminder_weekday! >= 1 && r.reminder_weekday! <= 7)) return 'reminder_invalid';
    if (r.reminder_recurrence === 'monthly' && !(Number.isInteger(r.reminder_day_of_month) && r.reminder_day_of_month! >= 1 && r.reminder_day_of_month! <= 31)) return 'reminder_invalid';
    // Etwas Spielraum für die Uhr zwischen Browser und Server
    if (r.reminder_recurrence === 'once' && at.getTime() <= now.getTime() - 60_000) return 'reminder_past';
  }
  return null;
}
