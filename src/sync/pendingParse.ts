// Warteschlange fuer KI-Strukturierung diktierter Notizen, die beim Speichern nicht
// laufen konnte (offline, Bridge nicht erreichbar). Die Notiz ist dann schon als
// normales Diktat gespeichert; sobald es geht, ergaenzt Claude Checkliste, Kategorie
// und Erinnerung. Rein lokal (AsyncStorage), geht nie mit dem Sync raus.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@notizapp_pending_parse';
/** Aelter als das: nicht mehr nachholen (Zeitangaben im Diktat waeren ohnehin veraltet). */
export const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export interface PendingParse {
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

export async function clearPendingParses(): Promise<void> {
  await write([]);
}
