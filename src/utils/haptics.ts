import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@notizapp/haptics_enabled';
let enabledCache = true;

export async function loadHapticsPref(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(STORAGE_KEY);
    enabledCache = v === null ? true : v === '1';
  } catch {
    enabledCache = true;
  }
  return enabledCache;
}

export async function setHapticsEnabled(enabled: boolean): Promise<void> {
  enabledCache = enabled;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // ignore
  }
}

export function isHapticsEnabled(): boolean {
  return enabledCache;
}

export function tap() {
  if (!enabledCache) return;
  Haptics.selectionAsync().catch(() => {});
}

export function light() {
  if (!enabledCache) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function medium() {
  if (!enabledCache) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function heavy() {
  if (!enabledCache) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}

export function success() {
  if (!enabledCache) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function warning() {
  if (!enabledCache) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}
