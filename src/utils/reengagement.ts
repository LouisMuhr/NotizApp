// Rückkehr-Benachrichtigungen ("Re-Engagement") — reine Planungslogik.
//
// Kein Expo-, kein Storage-Import: alles hier ist eine Funktion des übergebenen Stands,
// damit Zeitberechnung, Ruhezeiten, Kollisionen und Textauswahl ohne Gerät testbar sind.
// Das Einplanen beim OS übernimmt `reengagementScheduler.ts`.
//
// Regeln:
// - Stufen 3 / 7 / 14 Tage nach dem letzten Öffnen, danach nichts mehr bis zum nächsten Öffnen.
// - Exakt ab dem letzten Öffnen (keine Mindestabstände zwischen Stufen oder zu früheren).
// - Nie zwischen 21:00 und 9:00 Ortszeit (21–24 Uhr → 18:00 desselben Tages, 0–9 Uhr → 10:00).
// - Notiz-Erinnerungen blockieren keinen Tag. Liegt eine näher als 2 h am Zeitpunkt, wird
//   innerhalb desselben Tages (außerhalb der Ruhezeit) auf ≥ 2 h Abstand geschoben; geht das
//   nicht, wird trotzdem zum ursprünglichen Zeitpunkt gesendet.
// - Text nur aus Zahlen (nie Titel/Inhalte), Stufe 1 hat eine generische Variante, 2/3 nicht.

import type { Note } from '../models/Note';
import type { Thread } from '../models/Thought';

export type ReengagementStage = 1 | 2 | 3;
export type ReengagementKind = 'unthreaded' | 'openChecklist' | 'generic';
export type ReengagementTarget = 'Threads' | 'Notizen';

export const REENGAGEMENT_ID_PREFIX = 'velm-reengagement-';
export const REENGAGEMENT_DATA_KIND = 'reengagement';

export const STAGE_OFFSETS_DAYS: Record<ReengagementStage, number> = { 1: 3, 2: 7, 3: 14 };
export const QUIET_START_HOUR = 21;
export const QUIET_END_HOUR = 9;
/** Ziel bei Verschiebung aus dem späten Abend (21–24 Uhr). */
export const EVENING_FALLBACK_HOUR = 18;
/** Ziel bei Verschiebung aus der Nacht (0–9 Uhr). */
export const MORNING_FALLBACK_HOUR = 10;
/** Mindestabstand zu einer Notiz-Erinnerung am selben Tag. */
export const REMINDER_GAP_MS = 2 * 60 * 60 * 1000;
/** Fenster für "neue Notizen ohne Thread". */
export const RECENT_WINDOW_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReengagementStats {
  /** Aktive Notizen der letzten 7 Tage, die in keinem Thread stecken (auch keinem archivierten). */
  unthreadedRecent: number;
  /** Offene Checklisten-Punkte in aktiven Notizen. */
  openChecklistItems: number;
}

export interface PlannedReengagement {
  stage: ReengagementStage;
  /** Stabiler Identifier fürs OS (`velm-reengagement-<stufe>`). */
  identifier: string;
  date: Date;
  kind: ReengagementKind;
  count: number;
  target: ReengagementTarget;
  /** i18n-Schlüssel für Titel und Text (Text pluralisiert über `count`). */
  titleKey: string;
  bodyKey: string;
}

export interface PlanInput {
  enabled: boolean;
  now: Date;
  /** Zeitpunkt des letzten Öffnens; fehlt er, gilt `now`. */
  lastOpenedAt: Date | null;
  notes: Note[];
  threads: Thread[];
  /**
   * Ob Threads für den Nutzer erreichbar sind (Synthese braucht ein bestätigtes Konto).
   * Ohne Threads ist "Notizen ohne Thread" kein sinnvoller Anlass.
   */
  threadsAvailable?: boolean;
  /** Länge eines "Tages" für die Stufen-Offsets (Default 24 h). Testmodus: 60 000 = 1 Tag → 1 Minute. */
  msPerDay?: number;
  /**
   * Testmodus (Admin): Ruhezeit und 2-h-Abstand zu Erinnerungen ignorieren und Stufen ohne
   * konkreten Anlass generisch füllen, damit alle drei Stufen sichtbar werden.
   */
  test?: boolean;
}

// ---------------------------------------------------------------------------
// Statistik
// ---------------------------------------------------------------------------

export function computeStats(notes: Note[], threads: Thread[], now: Date): ReengagementStats {
  const threaded = new Set<string>();
  for (const th of threads) for (const id of th.noteIds ?? []) threaded.add(id);
  const since = now.getTime() - RECENT_WINDOW_DAYS * DAY_MS;
  let unthreadedRecent = 0;
  let openChecklistItems = 0;
  for (const n of notes) {
    if (n.archivedAt) continue;
    const created = new Date(n.createdAt).getTime();
    if (!threaded.has(n.id) && Number.isFinite(created) && created >= since && created <= now.getTime()) {
      unthreadedRecent++;
    }
    for (const item of n.checklist ?? []) if (!item.checked) openChecklistItems++;
  }
  return { unthreadedRecent, openChecklistItems };
}

// ---------------------------------------------------------------------------
// Kalender: Erinnerungszeitpunkte
// ---------------------------------------------------------------------------

/**
 * Alle Zeitpunkte, zu denen an diesem Kalendertag eine Notiz-Erinnerung (aktive Notiz) klingelt.
 * Wiederholungen zählen an jedem passenden Tag ab dem ersten Termin (täglich = jeder Tag,
 * wöchentlich = Wochentag, monatlich = Monatstag, ab dem 29. auf die Monatslänge begrenzt —
 * wie `nextMonthlyOccurrences`).
 */
export function reminderTimesOnDay(notes: Note[], day: Date): Date[] {
  const endOfDay = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
  const result: Date[] = [];
  for (const n of notes) {
    if (n.archivedAt || !n.reminderAt) continue;
    const first = new Date(n.reminderAt);
    if (!Number.isFinite(first.getTime())) continue;
    const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), first.getHours(), first.getMinutes());
    switch (n.reminderRecurrence) {
      case 'daily':
        if (first.getTime() < endOfDay) result.push(at);
        break;
      case 'weekly': {
        const weekday = n.reminderWeekday ?? 2; // Expo: 1=So … 7=Sa, Default Montag (wie scheduleReminder)
        if (first.getTime() < endOfDay && day.getDay() + 1 === weekday) result.push(at);
        break;
      }
      case 'monthly': {
        const dom = n.reminderDayOfMonth ?? 1;
        const lastDay = new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate();
        if (first.getTime() < endOfDay && day.getDate() === Math.min(dom, lastDay)) result.push(at);
        break;
      }
      default:
        if (sameDay(first, day)) result.push(first);
    }
  }
  return result;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ---------------------------------------------------------------------------
// Zeitfenster
// ---------------------------------------------------------------------------

function atHour(d: Date, hour: number, dayOffset = 0): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dayOffset, hour, 0, 0, 0);
}

export function isQuietTime(d: Date): boolean {
  const h = d.getHours();
  return h >= QUIET_START_HOUR || h < QUIET_END_HOUR;
}

/**
 * Schiebt einen Zeitpunkt aus der Ruhezeit ins erlaubte Fenster, nie vor `notBefore`:
 * 21–24 Uhr → 18:00 desselben Tages (sonst nächster Tag 10:00), 0–9 Uhr → 10:00.
 */
export function moveOutOfQuietHours(d: Date, notBefore: Date): Date {
  let result = d.getTime() < notBefore.getTime() ? new Date(notBefore.getTime()) : new Date(d.getTime());
  const h = result.getHours();
  if (h >= QUIET_START_HOUR) {
    const evening = atHour(result, EVENING_FALLBACK_HOUR);
    result = evening.getTime() >= notBefore.getTime() ? evening : atHour(result, MORNING_FALLBACK_HOUR, 1);
  } else if (h < QUIET_END_HOUR) {
    result = atHour(result, MORNING_FALLBACK_HOUR);
  }
  return result;
}

/**
 * Platziert eine Stufe: erst aus der Ruhezeit (nie vor `notBefore`), dann — falls eine
 * Notiz-Erinnerung näher als 2 h liegt — auf den nächstgelegenen Zeitpunkt desselben Tages mit
 * ≥ 2 h Abstand zu allen Erinnerungen, außerhalb der Ruhezeit und nicht vor `notBefore`.
 * Gibt es keinen, bleibt es beim Zeitpunkt aus Schritt 1 (wird trotzdem gesendet).
 */
export function placeStage(target: Date, notBefore: Date, notes: Note[]): Date {
  const base = moveOutOfQuietHours(target, notBefore);
  const reminders = reminderTimesOnDay(notes, base).map((d) => d.getTime());
  const ok = (ms: number) => reminders.every((r) => Math.abs(r - ms) >= REMINDER_GAP_MS);
  if (ok(base.getTime())) return base;

  const dayStart = atHour(base, QUIET_END_HOUR).getTime();
  const dayEnd = atHour(base, QUIET_START_HOUR).getTime() - 60_000; // 20:59
  const earliest = Math.max(dayStart, notBefore.getTime());
  const candidates = [earliest, dayEnd];
  for (const r of reminders) candidates.push(r - REMINDER_GAP_MS, r + REMINDER_GAP_MS);
  let best: number | null = null;
  for (const c of candidates) {
    if (c < earliest || c > dayEnd || !ok(c)) continue;
    if (best === null || Math.abs(c - base.getTime()) < Math.abs(best - base.getTime())) best = c;
  }
  return best === null ? base : new Date(best);
}

// ---------------------------------------------------------------------------
// Inhalt
// ---------------------------------------------------------------------------

const STAGE_PREFERENCE: Record<ReengagementStage, ReengagementKind[]> = {
  1: ['unthreaded', 'openChecklist', 'generic'],
  2: ['openChecklist', 'unthreaded'],
  3: ['unthreaded', 'openChecklist'],
};

export function chooseContent(
  stage: ReengagementStage,
  stats: ReengagementStats,
  threadsAvailable: boolean,
): { kind: ReengagementKind; count: number; target: ReengagementTarget } | null {
  for (const kind of STAGE_PREFERENCE[stage]) {
    if (kind === 'unthreaded' && threadsAvailable && stats.unthreadedRecent > 0) {
      return { kind, count: stats.unthreadedRecent, target: 'Threads' };
    }
    if (kind === 'openChecklist' && stats.openChecklistItems > 0) {
      return { kind, count: stats.openChecklistItems, target: 'Notizen' };
    }
    if (kind === 'generic') return { kind, count: 0, target: 'Notizen' };
  }
  return null;
}

export function textKeys(kind: ReengagementKind): { titleKey: string; bodyKey: string } {
  return { titleKey: `reengagement.${kind}Title`, bodyKey: `reengagement.${kind}Body` };
}

// ---------------------------------------------------------------------------
// Gesamtplan
// ---------------------------------------------------------------------------

export function planReengagement(input: PlanInput): PlannedReengagement[] {
  if (!input.enabled) return [];
  const { now, notes, threads } = input;
  const base = input.lastOpenedAt ?? now;
  const stats = computeStats(notes, threads, now);
  const threadsAvailable = input.threadsAvailable ?? true;

  const notBefore = new Date(now.getTime() + 60_000);

  const plan: PlannedReengagement[] = [];
  for (const stage of [1, 2, 3] as ReengagementStage[]) {
    const content = chooseContent(stage, stats, threadsAvailable)
      ?? (input.test ? { kind: 'generic' as const, count: 0, target: 'Notizen' as const } : null);
    if (!content) continue;
    const target = new Date(base.getTime() + STAGE_OFFSETS_DAYS[stage] * (input.msPerDay ?? DAY_MS));
    const date = input.test ? target : placeStage(target, notBefore, notes);
    plan.push({
      stage,
      identifier: `${REENGAGEMENT_ID_PREFIX}${stage}`,
      date,
      ...content,
      ...textKeys(content.kind),
    });
  }
  return plan;
}

/** Text für eine geplante Stufe; `t` ist das i18n-`t`. Enthält ausschließlich Zahlen. */
export function renderText(
  p: Pick<PlannedReengagement, 'titleKey' | 'bodyKey' | 'count'>,
  t: (key: string, options?: Record<string, unknown>) => string,
): { title: string; body: string } {
  return { title: t(p.titleKey, { count: p.count }), body: t(p.bodyKey, { count: p.count }) };
}

export function isReengagementNotification(identifier: string | undefined, data: unknown): boolean {
  if (identifier && identifier.startsWith(REENGAGEMENT_ID_PREFIX)) return true;
  return !!data && typeof data === 'object' && (data as { kind?: unknown }).kind === REENGAGEMENT_DATA_KIND;
}
