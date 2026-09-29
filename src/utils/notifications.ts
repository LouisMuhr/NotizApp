import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Linking } from 'react-native';
import { ReminderRecurrence } from '../models/Note';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Erinnerungen',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

interface ScheduleOptions {
  noteId: string;
  title: string;
  body: string;
  triggerDate: Date;
  recurrence: ReminderRecurrence;
  weekday: number | null; // Expo weekday: 1=Sun ... 7=Sat
  dayOfMonth: number | null;
}

export async function scheduleReminder(opts: ScheduleOptions): Promise<string> {
  const { noteId, title, body, triggerDate, recurrence, weekday, dayOfMonth } = opts;

  const notifContent: Notifications.NotificationContentInput = {
    title: `Erinnerung: ${title}`,
    body: body.substring(0, 100) || 'Notiz-Erinnerung',
    data: { noteId },
    ...(Platform.OS === 'android' && { channelId: 'reminders' }),
  };

  const hour = triggerDate.getHours();
  const minute = triggerDate.getMinutes();

  let trigger: Notifications.NotificationTriggerInput;

  switch (recurrence) {
    case 'daily':
      trigger = {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      };
      break;

    case 'weekly':
      trigger = {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: weekday ?? 2, // Default Montag
        hour,
        minute,
      };
      break;

    case 'monthly':
      trigger = {
        type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
        day: dayOfMonth ?? 1,
        hour,
        minute,
      };
      break;

    default: {
      // once — absolute DATE trigger so the alarm survives device restarts;
      // TIME_INTERVAL would recalculate from reboot time and fire at the wrong moment.
      trigger = {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      };
      break;
    }
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: notifContent,
    trigger,
  });

  return id;
}

export async function cancelReminder(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function scheduleTestNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Test-Erinnerung',
      body: 'Benachrichtigungen funktionieren!',
      ...(Platform.OS === 'android' && { channelId: 'reminders' }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + 15_000),
    },
  });
}

// Fires the given recurrence trigger as if it were "now + delaySeconds".
// Useful for testing daily/weekly/monthly reminders without waiting.
export async function scheduleTestRecurring(
  recurrence: ReminderRecurrence,
  weekday: number | null,
  dayOfMonth: number | null,
  delaySeconds = 10,
): Promise<string> {
  const triggerDate = new Date(Date.now() + delaySeconds * 1000);
  return scheduleReminder({
    noteId: 'test',
    title: `Test (${recurrence})`,
    body: `Wiederkehrende Erinnerung – ${recurrence}`,
    triggerDate,
    recurrence,
    weekday,
    dayOfMonth,
  });
}

export interface ScheduledReminderInfo {
  id: string;
  title: string;
  /** Nächster Auslösezeitpunkt laut OS; null wenn nicht ermittelbar. */
  nextAt: Date | null;
}

// Was das OS tatsächlich eingeplant hat — prüft, ob eine Erinnerung (z. B. für
// in 3 Tagen) wirklich registriert ist, ohne bis zum Auslösen zu warten.
export async function getScheduledReminders(): Promise<ScheduledReminderInfo[]> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const infos = await Promise.all(
    all.map(async (n): Promise<ScheduledReminderInfo> => {
      let nextAt: Date | null = null;
      try {
        const trigger = n.trigger as any;
        if (trigger?.type === 'date' && typeof trigger.value === 'number') {
          nextAt = new Date(trigger.value);
        } else {
          const ms = await Notifications.getNextTriggerDateAsync(trigger);
          nextAt = ms ? new Date(ms) : null;
        }
      } catch {
        nextAt = null;
      }
      return { id: n.identifier, title: n.content.title ?? '', nextAt };
    }),
  );
  return infos.sort((a, b) => (a.nextAt?.getTime() ?? Infinity) - (b.nextAt?.getTime() ?? Infinity));
}

export async function openExactAlarmSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Linking.sendIntent('android.settings.REQUEST_SCHEDULE_EXACT_ALARM', [
      { key: 'android.provider.Settings.EXTRA_APP_PACKAGE', value: 'com.velm.app' },
    ]);
  } catch {
    await Linking.openSettings();
  }
}

export async function openBatteryOptimizationSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
  } catch {
    await Linking.openSettings();
  }
}
