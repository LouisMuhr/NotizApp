// Warteschlange fuer KI-Strukturierung diktierter Notizen, die beim Speichern nicht
// laufen konnte (offline, Bridge nicht erreichbar). Die Notiz ist dann schon als
// normales Diktat gespeichert; sobald es geht, ergaenzt Claude Checkliste, Kategorie
// und Erinnerung. Rein lokal (AsyncStorage), geht nie mit dem Sync raus.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@notizapp_pending_parse';
/** Aelter als das: nicht mehr nachholen (Zeitangaben im Diktat waeren ohnehin veraltet). */
export const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

/** Laenger lehnt die Bridge ab (`invalid_input`) — solche Diktate gar nicht erst vormerken. */
export const MAX_TRANSCRIPT_CHARS = 4000;
/** So oft darf ein Eintrag bei erreichbarem Netz scheitern, bevor er verworfen wird. */
export const MAX_ATTEMPTS = 5;

export interface PendingParse {
  /** Fehlversuche bei erreichbarem Netz (kaputter Eintrag soll die Schlange nicht ewig belegen). */
  attempts?: number;
  noteId: string;
  /** Diktierter Titel (leer = KI darf einen vergeben). */
  title: string;
  transcript: string;
  locale: 'de' | 'en';
  /**
   * `updatedAt` der Notiz direkt nach dem Speichern. Weicht er spaeter ab, hat der User
   * die Notiz bearbeitet — dann wird nichts ueberschrieben.
   */
  noteUpdatedAt: string;
  /** Wann das Diktat aufgenommen wurde ("jetzt" fuer die KI: Zeitangaben beziehen sich darauf). */
  recordedAt: string;
}

/**
 * Gleicher Zeitpunkt? Nach dem Sync-Roundtrip liefert Postgres denselben Zeitpunkt in
 * anderer Schreibweise ("+00:00" statt "Z", andere Nachkommastellen) — ein String-Vergleich
 * hielte die Notiz dann faelschlich fuer bearbeitet.
 */
export function sameTimestamp(a: string, b: string): boolean {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  return Number.isNaN(ta) || Number.isNaN(tb) ? a === b : ta === tb;
}

async function read(): Promise<PendingParse[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function write(items: PendingParse[]): Promise<void> {
  try {
    if (items.length === 0) await AsyncStorage.removeItem(KEY);
    else await AsyncStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Warteschlange ist Komfort — ein Schreibfehler darf das Speichern nicht kippen.
  }
}

export async function enqueuePendingParse(item: PendingParse): Promise<void> {
  const items = (await read()).filter((i) => i.noteId !== item.noteId);
  await write([...items, item]);
}

export const loadPendingParses = read;

export async function removePendingParse(noteId: string): Promise<void> {
  await write((await read()).filter((i) => i.noteId !== noteId));
}

/** Zaehlt einen Fehlversuch und liefert den neuen Stand. */
export async function recordFailedAttempt(noteId: string): Promise<number> {
  const items = await read();
  let attempts = 0;
  await write(items.map((i) => {
    if (i.noteId !== noteId) return i;
    attempts = (i.attempts ?? 0) + 1;
    return { ...i, attempts };
  }));
  return attempts;
}

export type AfterError = 'remove' | 'abort' | 'skip';

/**
 * Was passiert nach einem fehlgeschlagenen KI-Lauf mit der restlichen Schlange?
 * - kein Pro: Eintrag verwerfen, weiter
 * - Tageslimit: Eintrag behalten, Runde beenden (die uebrigen scheitern genauso)
 * - sonst, Netz weg: Runde beenden (alle warten)
 * - sonst, Netz da: der Eintrag selbst ist das Problem → weiter mit dem naechsten;
 *   nach MAX_ATTEMPTS Fehlversuchen verwerfen
 */
export function decideAfterError(
  error: 'limit_reached' | 'plan_required' | 'unavailable',
  online: boolean,
  attemptsAfterFailure: number,
): AfterError {
  if (error === 'plan_required') return 'remove';
  if (error === 'limit_reached') return 'abort';
  if (!online) return 'abort';
  return attemptsAfterFailure >= MAX_ATTEMPTS ? 'remove' : 'skip';
}

export async function clearPendingParses(): Promise<void> {
  await write([]);
}
