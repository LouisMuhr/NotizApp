// Rückkehr-Benachrichtigungen — Seiteneffekte (AsyncStorage + expo-notifications).
// Die Planung selbst ist rein und liegt in `reengagement.ts`.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Note } from '../models/Note';
import type { Thread } from '../models/Thought';
import {
  planReengagement,
  renderText,
  isReengagementNotification,
  REENGAGEMENT_DATA_KIND,
} from './reengagement';

export const REENGAGEMENT_ENABLED_KEY = '@notizapp_reengagement_enabled';
export const REENGAGEMENT_LAST_OPENED_KEY = '@notizapp_reengagement_last_opened';
export const REENGAGEMENT_KEYS = [
  REENGAGEMENT_ENABLED_KEY,
  REENGAGEMENT_LAST_OPENED_KEY,
];
const CHANNEL_ID = 'reengagement';

export async function loadReengagementEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(REENGAGEMENT_ENABLED_KEY).catch(() => null);
  return v !== 'false'; // Default an
}

export async function saveReengagementEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(REENGAGEMENT_ENABLED_KEY, enabled ? 'true' : 'false');
  if (!enabled) await cancelReengagement();
}

export async function markAppOpened(now: Date = new Date()): Promise<void> {
  await AsyncStorage.setItem(REENGAGEMENT_LAST_OPENED_KEY, now.toISOString());
}

export async function hasOpenedBefore(): Promise<boolean> {
  return (await AsyncStorage.getItem(REENGAGEMENT_LAST_OPENED_KEY).catch(() => null)) !== null;
}

/** Storniert nur Rückkehr-Benachrichtigungen; Notiz-Erinnerungen bleiben unberührt. */
export async function cancelReengagement(): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter((n) => isReengagementNotification(n.identifier, n.content?.data))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/** Für "Alles löschen": stornieren und alle Keys entfernen (Schalter fällt auf Default zurück). */
export async function clearReengagement(): Promise<void> {
  await cancelReengagement().catch(() => {});
  await AsyncStorage.multiRemove(REENGAGEMENT_KEYS).catch(() => {});
}

export interface RefreshOptions {
  notes: Note[];
  threads: Thread[];
  t: (key: string, options?: Record<string, unknown>) => string;
  threadsAvailable: boolean;
  now?: Date;
}

/**
 * Storniert alle Rückkehr-Benachrichtigungen und plant sie aus dem aktuellen Stand neu.
 * Ist der Schalter aus, wird nur storniert.
 */
export async function refreshReengagement(opts: RefreshOptions): Promise<void> {
  const now = opts.now ?? new Date();
  const [enabled, lastOpenedRaw] = await Promise.all([
    loadReengagementEnabled(),
    AsyncStorage.getItem(REENGAGEMENT_LAST_OPENED_KEY),
  ]);
  await cancelReengagement();
  const lastOpened = lastOpenedRaw ? new Date(lastOpenedRaw) : null;
  const plan = planReengagement({
    enabled,
    now,
    lastOpenedAt: lastOpened && Number.isFinite(lastOpened.getTime()) ? lastOpened : null,
    notes: opts.notes,
    threads: opts.threads,
    threadsAvailable: opts.threadsAvailable,
  });

  if (Platform.OS === 'android' && plan.length > 0) {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: opts.t('reengagement.channelName'),
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => {});
  }

  for (const p of plan) {
    const { title, body } = renderText(p, opts.t);
    await Notifications.scheduleNotificationAsync({
      identifier: p.identifier,
      content: {
        title,
        body,
        data: { kind: REENGAGEMENT_DATA_KIND, stage: p.stage, target: p.target },
        ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.date },
    });
  }
}
