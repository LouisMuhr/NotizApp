// Schalter „KI-Strukturierung für Sprachnotizen“ (Pro). Default an.
// Gleiches Muster wie haptics.ts: synchron lesbarer Cache, beim Start geladen.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@notizapp/voice_ai_enabled';
let enabledCache = true;

export async function loadVoiceAiPref(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(STORAGE_KEY);
    enabledCache = v === null ? true : v === '1';
  } catch {
    enabledCache = true;
  }
  return enabledCache;
}

export async function setVoiceAiEnabled(enabled: boolean): Promise<void> {
  enabledCache = enabled;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // ignore
  }
}

export function isVoiceAiEnabled(): boolean {
  return enabledCache;
}
