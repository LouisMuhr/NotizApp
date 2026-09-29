jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly' },
}));
jest.mock('expo-device', () => ({ isDevice: true }));

import * as Notifications from 'expo-notifications';
import { nextMonthlyOccurrences, scheduleReminder, cancelReminder } from '../src/utils/notifications';

const ymd = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

test('31. → letzter Tag jedes Monats (auch Februar, Schaltjahr)', () => {
  const dates = nextMonthlyOccurrences(new Date(2027, 0, 15, 8, 0), 31, 17, 30, 6);
  expect(dates.map(ymd)).toEqual(['2027-1-31', '2027-2-28', '2027-3-31', '2027-4-30', '2027-5-31', '2027-6-30']);
  const leap = nextMonthlyOccurrences(new Date(2028, 1, 1), 31, 9, 0, 1);
  expect(ymd(leap[0])).toBe('2028-2-29');
});

test('30. begrenzt nur im Februar; Uhrzeit bleibt', () => {
  const dates = nextMonthlyOccurrences(new Date(2027, 0, 15), 30, 17, 30, 3);
  expect(dates.map(ymd)).toEqual(['2027-1-30', '2027-2-28', '2027-3-30']);
  expect(dates[0].getHours()).toBe(17);
  expect(dates[0].getMinutes()).toBe(30);
});

test('heutiger Termin, dessen Uhrzeit schon vorbei ist, wird übersprungen', () => {
  const dates = nextMonthlyOccurrences(new Date(2027, 0, 31, 18, 0), 31, 17, 30, 2);
  expect(dates.map(ymd)).toEqual(['2027-2-28', '2027-3-31']);
});

const base = { noteId: 'n', title: 'T', body: 'B', triggerDate: new Date(2027, 0, 1, 17, 30), recurrence: 'monthly' as const, weekday: null };

test('Tag ≤ 28 nutzt weiter den nativen Monats-Trigger', async () => {
  (Notifications.scheduleNotificationAsync as jest.Mock).mockReset().mockResolvedValue('id1');
  const id = await scheduleReminder({ ...base, dayOfMonth: 28 });
  expect(id).toBe('id1');
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  expect((Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0].trigger).toMatchObject({ type: 'monthly', day: 28 });
});

test('Tag 31 plant 6 Einzeltermine, cancelReminder räumt alle ab', async () => {
  let n = 0;
  (Notifications.scheduleNotificationAsync as jest.Mock).mockReset().mockImplementation(async () => `id${++n}`);
  (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockClear();
  const id = await scheduleReminder({ ...base, dayOfMonth: 31 });
  expect(id).toBe('id1,id2,id3,id4,id5,id6');
  for (const [arg] of (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls) {
    expect(arg.trigger.type).toBe('date');
  }
  await cancelReminder(id);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(6);
});
