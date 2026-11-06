// Rückkehr-Benachrichtigungen: Einplanen/Stornieren beim OS trifft nie Notiz-Erinnerungen.
const scheduled: { identifier: string; content: { data?: Record<string, unknown> } }[] = [];

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(async () => scheduled.slice()),
  cancelScheduledNotificationAsync: jest.fn(async (id: string) => {
    const i = scheduled.findIndex((n) => n.identifier === id);
    if (i !== -1) scheduled.splice(i, 1);
  }),
  scheduleNotificationAsync: jest.fn(async (req: { identifier?: string; content: { data?: Record<string, unknown> } }) => {
    const identifier = req.identifier ?? `os-${scheduled.length + 1}`;
    const i = scheduled.findIndex((n) => n.identifier === identifier);
    if (i !== -1) scheduled.splice(i, 1);
    scheduled.push({ identifier, content: req.content });
    return identifier;
  }),
  setNotificationChannelAsync: jest.fn(async () => {}),
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly' },
}));
jest.mock('expo-device', () => ({ isDevice: true }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { cancelAllReminders } from '../src/utils/notifications';
import {
  refreshReengagement,
  saveReengagementEnabled,
  loadReengagementEnabled,
  clearReengagement,
  markAppOpened,
  REENGAGEMENT_ENABLED_KEY,
  REENGAGEMENT_TEST_UNTIL_KEY,
  isReengagementTestActive,
  endReengagementTest,
} from '../src/utils/reengagementScheduler';

const t = (k: string, o?: Record<string, unknown>) => `${k}:${o?.count ?? ''}`;
const NOW = new Date(2027, 2, 10, 14, 30);

beforeEach(async () => {
  scheduled.length = 0;
  await AsyncStorage.clear();
  jest.clearAllMocks();
  // Eine Notiz-Erinnerung, die das OS schon hat
  scheduled.push({ identifier: 'reminder-abc', content: { data: { noteId: 'n1' } } });
});

test('Default an: plant Stufe 1 mit Prefix + data-Kennung', async () => {
  expect(await loadReengagementEnabled()).toBe(true);
  await markAppOpened(NOW);
  await refreshReengagement({ notes: [], threads: [], t, threadsAvailable: true, now: NOW });
  const ours = scheduled.filter((n) => n.identifier.startsWith('velm-reengagement-'));
  expect(ours.map((n) => n.identifier)).toEqual(['velm-reengagement-1']);
  expect(ours[0].content.data).toMatchObject({ kind: 'reengagement', stage: 1 });
});

test('Neuplanen storniert nur Rückkehr-Benachrichtigungen, Erinnerung bleibt', async () => {
  await refreshReengagement({ notes: [], threads: [], t, threadsAvailable: true, now: NOW });
  await refreshReengagement({ notes: [], threads: [], t, threadsAvailable: true, now: NOW });
  expect(scheduled.map((n) => n.identifier).sort()).toEqual(['reminder-abc', 'velm-reengagement-1']);
  expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('reminder-abc');
});

test('Schalter aus → alle Rückkehr-Benachrichtigungen storniert, nichts neu geplant', async () => {
  await refreshReengagement({ notes: [], threads: [], t, threadsAvailable: true, now: NOW });
  await saveReengagementEnabled(false);
  expect(await AsyncStorage.getItem(REENGAGEMENT_ENABLED_KEY)).toBe('false');
  expect(scheduled.map((n) => n.identifier)).toEqual(['reminder-abc']);
  (Notifications.scheduleNotificationAsync as jest.Mock).mockClear();
  await refreshReengagement({ notes: [], threads: [], t, threadsAvailable: true, now: NOW });
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(scheduled.map((n) => n.identifier)).toEqual(['reminder-abc']);
});

test('cancelAllReminders (Erinnerungen neu planen) lässt Rückkehr-Benachrichtigungen stehen', async () => {
  await refreshReengagement({ notes: [], threads: [], t, threadsAvailable: true, now: NOW });
  await cancelAllReminders();
  expect(scheduled.map((n) => n.identifier)).toEqual(['velm-reengagement-1']);
});

test('Alles löschen: storniert und räumt alle Keys ab', async () => {
  await markAppOpened(NOW);
  await saveReengagementEnabled(true);
  await refreshReengagement({ notes: [], threads: [], t, threadsAvailable: true, now: NOW });
  await clearReengagement();
  expect(scheduled.map((n) => n.identifier)).toEqual(['reminder-abc']);
  const keys = await AsyncStorage.getAllKeys();
  expect(keys.filter((k) => k.startsWith('@notizapp_reengagement'))).toEqual([]);
});

test('Erneutes Öffnen plant exakt ab dem neuen Öffnen (kein Mindestabstand zu früheren)', async () => {
  await markAppOpened(NOW);
  await refreshReengagement({ notes: [], threads: [], t, threadsAvailable: true, now: NOW });
  // Stufe 1 ging am 13.3. raus, am 14.3. um 12:00 wird die App wieder geöffnet
  const later = new Date(2027, 2, 14, 12, 0);
  await markAppOpened(later);
  await refreshReengagement({ notes: [], threads: [], t, threadsAvailable: true, now: later });
  const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.at(-1)[0];
  expect(call.identifier).toBe('velm-reengagement-1');
  expect(call.trigger.date).toEqual(new Date(2027, 2, 17, 12, 0));
  expect(scheduled.filter((n) => n.identifier.startsWith('velm-reengagement-')).length).toBe(1);
});

describe('Admin-Testmodus', () => {
  test('plant drei Stufen nach 3/7/14 min über denselben Pfad (Prefix, data, Kanal)', async () => {
    await refreshReengagement({ notes: [], threads: [], t, threadsAvailable: true, now: NOW, test: true });
    const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.map((c) => c[0]);
    expect(calls.map((c) => c.identifier)).toEqual(['velm-reengagement-1', 'velm-reengagement-2', 'velm-reengagement-3']);
    expect(calls.map((c) => (c.trigger.date.getTime() - NOW.getTime()) / 60_000)).toEqual([3, 7, 14]);
    for (const c of calls) expect(c.content.data).toMatchObject({ kind: 'reengagement' });
    expect(await isReengagementTestActive(NOW)).toBe(true);
  });

  test('während des Tests überspringt normales Neuplanen (Öffnen/Vordergrund) und storniert nichts', async () => {
    await refreshReengagement({ notes: [], threads: [], t, threadsAvailable: true, now: NOW, test: true });
    jest.clearAllMocks();
    const during = new Date(NOW.getTime() + 5 * 60_000);
    await markAppOpened(during);
    await refreshReengagement({ notes: [], threads: [], t, threadsAvailable: true, now: during });
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(scheduled.filter((n) => n.identifier.startsWith('velm-reengagement-')).length).toBe(3);
  });

  test('nach der letzten Test-Stufe wird wieder normal geplant', async () => {
    await refreshReengagement({ notes: [], threads: [], t, threadsAvailable: true, now: NOW, test: true });
    const after = new Date(NOW.getTime() + 15 * 60_000);
    await markAppOpened(after);
    await refreshReengagement({ notes: [], threads: [], t, threadsAvailable: true, now: after });
    expect(await isReengagementTestActive(after)).toBe(false);
    const last = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.at(-1)[0];
    expect(last.trigger.date.getTime() - after.getTime()).toBe(3 * 24 * 3600 * 1000);
  });

  test('Test beenden storniert die Test-Hinweise, danach plant refresh normal', async () => {
    await refreshReengagement({ notes: [], threads: [], t, threadsAvailable: true, now: NOW, test: true });
    await endReengagementTest();
    expect(scheduled.map((n) => n.identifier)).toEqual(['reminder-abc']);
    await markAppOpened(NOW);
    await refreshReengagement({ notes: [], threads: [], t, threadsAvailable: true, now: NOW });
    expect(scheduled.map((n) => n.identifier).sort()).toEqual(['reminder-abc', 'velm-reengagement-1']);
  });

  test('Alles löschen räumt auch das Test-Flag ab', async () => {
    await refreshReengagement({ notes: [], threads: [], t, threadsAvailable: true, now: NOW, test: true });
    await clearReengagement();
    expect(await AsyncStorage.getItem(REENGAGEMENT_TEST_UNTIL_KEY)).toBeNull();
  });
});
