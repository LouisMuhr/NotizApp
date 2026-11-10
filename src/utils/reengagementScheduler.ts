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
/** Admin-Testmodus: ISO-Zeitpunkt der letzten Test-Stufe. Bis dahin wird nicht normal neu geplant. */
export const REENGAGEMENT_TEST_UNTIL_KEY = '@notizapp_reengagement_test_until';
export const REENGAGEMENT_KEYS = [
  REENGAGEMENT_ENABLED_KEY,
  REENGAGEMENT_LAST_OPENED_KEY,
  REENGAGEMENT_TEST_UNTIL_KEY,
];
/** Testmodus-Zeitraffer: 1 Tag = 1 Minute (Stufen nach 3, 7, 14 Minuten). */
export const TEST_MS_PER_DAY = 60_000;

/** Läuft gerade ein Admin-Test (letzte Test-Stufe noch nicht vorbei)? */
export async function isReengagementTestActive(now: Date = new Date()): Promise<boolean> {
  const raw = await AsyncStorage.getItem(REENGAGEMENT_TEST_UNTIL_KEY).catch(() => null);
  if (!raw) return false;
  const until = new Date(raw).getTime();
  if (Number.isFinite(until) && until > now.getTime()) return true;
  await AsyncStorage.removeItem(REENGAGEMENT_TEST_UNTIL_KEY).catch(() => {});
  return false;
}
/**
 * Android-Kanal. Die Wichtigkeit eines angelegten Kanals lässt Android nicht mehr ändern —
 * deshalb neue ID statt 'reengagement' (war DEFAULT: kein Banner, nur in der Leiste).
 */
export const REENGAGEMENT_CHANNEL_ID = 'velm-reengagement-v2';
const LEGACY_CHANNEL_IDS = ['reengagement'];
const CHANNEL_ID = REENGAGEMENT_CHANNEL_ID;

/**
 * Alle Planungs-/Stornierschritte laufen nacheinander. Sonst kann eine schon laufende normale
 * Neuplanung (z. B. vom App-Start, die auf den Kontostatus wartet) ihre Stufe 1 NACH einem
 * Teststart einplanen — gleicher Identifier, der 3-Minuten-Test-Hinweis wäre ersetzt.
 */
let chain: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}

export async function loadReengagementEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(REENGAGEMENT_ENABLED_KEY).catch(() => null);
  return v !== 'false'; // Default an
}

export function saveReengagementEnabled(enabled: boolean): Promise<void> {
  return serialized(async () => {
    await AsyncStorage.setItem(REENGAGEMENT_ENABLED_KEY, enabled ? 'true' : 'false');
    if (!enabled) await cancelReengagement();
  });
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
export function clearReengagement(): Promise<void> {
  return serialized(async () => {
    await cancelReengagement().catch(() => {});
    await AsyncStorage.multiRemove(REENGAGEMENT_KEYS).catch(() => {});
  });
}

export interface RefreshOptions {
  notes: Note[];
  threads: Thread[];
  t: (key: string, options?: Record<string, unknown>) => string;
  threadsAvailable: boolean;
  now?: Date;
  /** Admin-Testmodus: Zeitraffer, alle drei Stufen, Ruhezeit/2-h-Abstand ignoriert. */
  test?: boolean;
}

/**
 * Storniert alle Rückkehr-Benachrichtigungen und plant sie aus dem aktuellen Stand neu.
 * Ist der Schalter aus, wird nur storniert. Läuft ein Admin-Test, passiert nichts — sonst
 * würde jedes Öffnen/Vordergrund (Bootstrap) die Testplanung durch die echte ersetzen.
 */
export function refreshReengagement(opts: RefreshOptions): Promise<void> {
  return serialized(() => refreshNow(opts));
}

async function refreshNow(opts: RefreshOptions): Promise<void> {
  const now = opts.now ?? new Date();
  if (opts.test) return startTest(opts, now);
  if (await isReengagementTestActive(now)) return;
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
  await schedulePlan(plan, opts.t);
}

/** Admin-Test: echte Textauswahl/Kennung/Kanal, Stufen nach 3, 7, 14 Minuten ab jetzt. */
async function startTest(opts: RefreshOptions, now: Date): Promise<void> {
  await cancelReengagement();
  const plan = planReengagement({
    enabled: true,
    now,
    lastOpenedAt: now,
    notes: opts.notes,
    threads: opts.threads,
    threadsAvailable: opts.threadsAvailable,
    msPerDay: TEST_MS_PER_DAY,
    test: true,
  });
  const last = plan[plan.length - 1];
  if (last) await AsyncStorage.setItem(REENGAGEMENT_TEST_UNTIL_KEY, last.date.toISOString());
  await schedulePlan(plan, opts.t);
}

/** Admin-Test beenden: Test-Hinweise stornieren, danach wieder normal planen (Aufrufer). */
export function endReengagementTest(): Promise<void> {
  return serialized(async () => {
    await AsyncStorage.removeItem(REENGAGEMENT_TEST_UNTIL_KEY);
    await cancelReengagement();
  });
}

async function schedulePlan(
  plan: ReturnType<typeof planReengagement>,
  t: RefreshOptions['t'],
): Promise<void> {
  if (Platform.OS === 'android' && plan.length > 0) {
    for (const old of LEGACY_CHANNEL_IDS) await Notifications.deleteNotificationChannelAsync(old).catch(() => {});
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: t('reengagement.channelName'),
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    }).catch(() => {});
  }

  for (const p of plan) {
    const { title, body } = renderText(p, t);
    await Notifications.scheduleNotificationAsync({
      identifier: p.identifier,
      content: {
        title,
        body,
        data: { kind: REENGAGEMENT_DATA_KIND, stage: p.stage, target: p.target },
      },
      // SDK 54: channelId gehört in den Trigger — im content wird er ignoriert (Fallback-Kanal).
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: p.date,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
    });
  }
}
