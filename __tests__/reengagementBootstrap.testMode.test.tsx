// Rückkehr-Hinweise: Läuft der Admin-Test, darf der Bootstrap (Start/Vordergrund) ihn nicht durch
// die echte Planung ersetzen; nach dem Test wird wieder normal geplant.
const scheduled: { identifier: string; content: { data?: Record<string, unknown> } }[] = [];

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(async () => scheduled.slice()),
  cancelScheduledNotificationAsync: jest.fn(async (id: string) => {
    const i = scheduled.findIndex((n) => n.identifier === id);
    if (i !== -1) scheduled.splice(i, 1);
  }),
  scheduleNotificationAsync: jest.fn(async (req: { identifier: string; content: { data?: Record<string, unknown> } }) => {
    const i = scheduled.findIndex((n) => n.identifier === req.identifier);
    if (i !== -1) scheduled.splice(i, 1);
    scheduled.push({ identifier: req.identifier, content: req.content });
    return req.identifier;
  }),
  setNotificationChannelAsync: jest.fn(async () => {}),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));
jest.mock('../src/context/NotesContext', () => ({ useNotes: () => ({ notes: [], loading: false }) }));
jest.mock('../src/context/ThoughtsContext', () => ({ useThoughts: () => ({ threads: [], loading: false }) }));
jest.mock('../src/context/LanguageContext', () => ({
  useLanguage: () => ({ locale: 'de', t: (k: string) => k }),
}));
jest.mock('../src/sync/accountState', () => ({ getSyncUserId: async () => null }));

import React from 'react';
import { AppState } from 'react-native';
import { render, act, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReengagementBootstrap from '../src/components/ReengagementBootstrap';
import { refreshReengagement, REENGAGEMENT_TEST_UNTIL_KEY } from '../src/utils/reengagementScheduler';

let appStateHandler: ((s: string) => void) | null = null;

beforeEach(async () => {
  scheduled.length = 0;
  await AsyncStorage.clear();
  jest.clearAllMocks();
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (s: string) => void) => {
    appStateHandler = h;
    return { remove: () => {} };
  }) as never);
});

const tf = (k: string) => k;

test('Start und Vordergrund während des Tests planen nicht neu', async () => {
  await refreshReengagement({ notes: [], threads: [], t: tf, threadsAvailable: true, test: true });
  const testIds = scheduled.map((n) => n.identifier);
  expect(testIds).toHaveLength(3);
  jest.clearAllMocks();

  render(<ReengagementBootstrap />);
  await waitFor(() => expect(AsyncStorage.getItem('@notizapp_reengagement_last_opened')).resolves.not.toBeNull());
  await act(async () => { appStateHandler?.('background'); appStateHandler?.('active'); });
  await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  expect(scheduled.map((n) => n.identifier)).toEqual(testIds);
});

test('nach Ablauf des Tests plant der Vordergrund wieder normal', async () => {
  await AsyncStorage.setItem(REENGAGEMENT_TEST_UNTIL_KEY, new Date(Date.now() - 1000).toISOString());
  render(<ReengagementBootstrap />);
  await waitFor(() => expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled());
  expect(scheduled.map((n) => n.identifier)).toEqual(['velm-reengagement-1']);
  expect(await AsyncStorage.getItem(REENGAGEMENT_TEST_UNTIL_KEY)).toBeNull();
});
