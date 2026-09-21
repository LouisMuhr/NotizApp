import AsyncStorage from '@react-native-async-storage/async-storage';
import { Note } from '../models/Note';
import { Tier } from '../sync/subscriptionService';

const NOTES_KEY = '@notizapp_notes';
const CATEGORIES_KEY = '@notizapp_categories';
const ARCHIVE_KEY = '@notizapp_archive';
const TOMBSTONES_KEY = '@notizapp_tombstones';

export async function loadNotes(): Promise<Note[]> {
  const json = await AsyncStorage.getItem(NOTES_KEY);
  return json ? JSON.parse(json) : [];
}

export async function saveNotes(notes: Note[]): Promise<void> {
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

export async function loadCategories(): Promise<string[]> {
  const json = await AsyncStorage.getItem(CATEGORIES_KEY);
  return json ? JSON.parse(json) : [];
}

export async function saveCategories(categories: string[]): Promise<void> {
  await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
}

export async function loadArchive(): Promise<Note[]> {
  const json = await AsyncStorage.getItem(ARCHIVE_KEY);
  return json ? JSON.parse(json) : [];
}

export async function saveArchive(notes: Note[]): Promise<void> {
  await AsyncStorage.setItem(ARCHIVE_KEY, JSON.stringify(notes));
}

export async function loadTombstones(): Promise<string[]> {
  const json = await AsyncStorage.getItem(TOMBSTONES_KEY);
  return json ? JSON.parse(json) : [];
}

export async function saveTombstones(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(TOMBSTONES_KEY, JSON.stringify(ids));
}

// ---------------------------------------------------------------------------
// Sync-Metadaten
// ---------------------------------------------------------------------------

const PENDING_KEY = '@notizapp_pending_sync';
const SYNC_UID_KEY = '@notizapp_sync_uid';

/** IDs von Notizen mit lokalen Aenderungen, die noch nicht remote bestaetigt sind. */
export async function loadPendingSync(): Promise<string[]> {
  const json = await AsyncStorage.getItem(PENDING_KEY);
  return json ? JSON.parse(json) : [];
}

export async function savePendingSync(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(ids));
}

/** User-ID, mit der der lokale Bestand zuletzt erfolgreich abgeglichen wurde. */
export async function loadSyncUid(): Promise<string | null> {
  return AsyncStorage.getItem(SYNC_UID_KEY);
}

export async function saveSyncUid(uid: string): Promise<void> {
  await AsyncStorage.setItem(SYNC_UID_KEY, uid);
}

/** Beim Abmelden: die zuletzt gesyncte UID vergessen. */
export async function clearSyncUid(): Promise<void> {
  await AsyncStorage.removeItem(SYNC_UID_KEY);
}

// ---------------------------------------------------------------------------
// Abo-Cache
// ---------------------------------------------------------------------------

const TIER_CACHE_KEY = '@notizapp_tier_cache';

/**
 * Zuletzt vom Server bestaetigter Tier, an die UID gebunden.
 *
 * Ohne diesen Cache startet jeder Kaltstart ohne Wissen ueber das Abo und die
 * UI muesste sich bis zur Server-Antwort zurueckhalten. Die UID gehoert dazu,
 * damit ein Pro-Status nicht ins naechste Konto leckt.
 *
 * `nextAllowedAt` wird bewusst NICHT gecacht: der Wert ist zeitkritisch und
 * endgueltig entscheidet immer der Server (Entscheidung 14).
 */
export interface TierCache {
  uid: string;
  tier: Tier;
}

/**
 * Liefert den Cache nur, wenn er zur uebergebenen UID passt. `null` heisst
 * "nichts Verlaessliches bekannt" — der Aufrufer wartet dann auf den Server.
 */
export async function loadTierCache(uid: string | null): Promise<TierCache | null> {
  if (!uid) return null;
  const json = await AsyncStorage.getItem(TIER_CACHE_KEY);
  if (!json) return null;
  try {
    const cache = JSON.parse(json) as TierCache;
    if (cache.uid !== uid) return null; // anderes Konto → wertlos
    return cache;
  } catch {
    return null;
  }
}

export async function saveTierCache(cache: TierCache): Promise<void> {
  await AsyncStorage.setItem(TIER_CACHE_KEY, JSON.stringify(cache));
}

/** Beim Abmelden/Trennen: der Tier des alten Kontos darf nicht stehen bleiben. */
export async function clearTierCache(): Promise<void> {
  await AsyncStorage.removeItem(TIER_CACHE_KEY);
}
