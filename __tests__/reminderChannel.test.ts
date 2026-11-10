// Notiz-Erinnerungen müssen auf Android im Kanal „reminders“ (hohe Wichtigkeit) landen.
// expo-notifications (SDK 54) liest channelId nur aus dem Trigger — im content wird er
// ignoriert, die Erinnerung landete im Fallback-Kanal ohne Banner.
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly' },
}));
jest.mock('expo-device', () => ({ isDevice: true }));

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { scheduleReminder, scheduleTestNotification } from '../src/utils/notifications';
import type { ReminderRecurrence } from '../src/models/Note';

const realOS = Platform.OS;
beforeEach(() => {
  (Platform as { OS: string }).OS = 'android';
  (Notifications.scheduleNotificationAsync as jest.Mock).mockClear();
});
afterEach(() => { (Platform as { OS: string }).OS = realOS; });

const base = { noteId: 'n', title: 'T', body: 'B', triggerDate: new Date(2030, 0, 1, 17, 30), weekday: 3, dayOfMonth: 15 };

test.each(['once', 'daily', 'weekly', 'monthly'] as ReminderRecurrence[])('%s: channelId im Trigger, nicht im content', async (recurrence) => {
  await scheduleReminder({ ...base, recurrence });
  const req = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
  expect(req.trigger.channelId).toBe('reminders');
  expect(req.content.channelId).toBeUndefined();
});

test('monatlich ab dem 29. (Einzeltermine): jeder Termin im Kanal reminders', async () => {
  await scheduleReminder({ ...base, recurrence: 'monthly', dayOfMonth: 31 });
  const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
  expect(calls.length).toBeGreaterThan(1);
  for (const [req] of calls) expect(req.trigger.channelId).toBe('reminders');
});

test('Test-Benachrichtigung ebenfalls im Kanal reminders', async () => {
  await scheduleTestNotification();
  const req = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
  expect(req.trigger.channelId).toBe('reminders');
});
