// "Nicht mehr anzeigen" fuer den Hinweis "Claude ergaenzt die Notiz, sobald du online bist".
// Nur dieser Hinweis ist ausblendbar; Limit- und Fehlerhinweise kommen immer.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@notizapp/hide_ai_queued_notice';

export async function isQueuedNoticeHidden(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function hideQueuedNotice(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Komfort-Einstellung — darf nichts kippen.
  }
}
