import AsyncStorage from '@react-native-async-storage/async-storage';
import { Note } from '../models/Note';

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
