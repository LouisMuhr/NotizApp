/**
 * Erinnerungen, die auf einem anderen Gerät (z. B. in der Webapp) gesetzt werden, müssen auf dem Handy
 * klingeln — ohne dass die App erst kalt neu gestartet wird. Die App plant deshalb nach eingehenden
 * Änderungen (Start-Pull und Realtime) neu, sobald sich erinnerungsrelevante Felder ändern.
 */
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotesProvider, useNotes } from '../src/context/NotesContext';
import { Note } from '../src/models/Note';
import { makeNote, iso, DAY } from './helpers/notes';

jest.mock('../src/utils/notifications', () => ({
  scheduleReminder: jest.fn(async () => 'notif-id'),
  cancelReminder: jest.fn(async () => {}),
  cancelAllReminders: jest.fn(async () => {}),
}));
jest.mock('../src/utils/haptics', () => ({
  loadHapticsPref: jest.fn(async () => {}),
  success: jest.fn(), light: jest.fn(), medium: jest.fn(), tap: jest.fn(),
}));
jest.mock('../src/sync/subscriptionService', () => ({
  subscriptionService: { getStatus: jest.fn(async () => ({ tier: 'free', nextAllowedAt: null })) },
}));
jest.mock('../src/sync/supabaseClient', () => ({
  isSyncConfigured: () => true,
  getSupabase: () => null,
}));
jest.mock('../src/sync/userId', () => ({
  getUserId: jest.fn(async () => 'user-1'),
  clearUserIdCache: jest.fn(),
}));
jest.mock('../src/sync/remoteNotes', () => ({
  pullRemote: jest.fn(async () => []),
  upsertRemote: jest.fn(async () => {}),
  deleteRemote: jest.fn(async () => {}),
  subscribeRemote: jest.fn(() => () => {}),
}));

const notifications = require('../src/utils/notifications') as { scheduleReminder: jest.Mock; cancelAllReminders: jest.Mock };
const remoteNotes = require('../src/sync/remoteNotes') as { pullRemote: jest.Mock; subscribeRemote: jest.Mock };

const wrapper = ({ children }: { children: React.ReactNode }) => <NotesProvider>{children}</NotesProvider>;

type Handlers = { onUpsert: (n: Note) => void; onDelete: (id: string) => void };
async function mountSynced(): Promise<Handlers> {
  const hook = renderHook(() => useNotes(), { wrapper });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  await waitFor(() => expect(remoteNotes.subscribeRemote).toHaveBeenCalled());
  await act(async () => { await Promise.resolve(); });
  return remoteNotes.subscribeRemote.mock.calls.at(-1)![1] as Handlers;
}

const scheduledFor = (id: string) => notifications.scheduleReminder.mock.calls.filter(([a]) => a.noteId === id);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  remoteNotes.pullRemote.mockResolvedValue([]);
});

test('R1: Notiz mit Erinnerung kommt per Realtime an → Erinnerung wird sofort geplant', async () => {
  const handlers = await mountSynced();
  const n = makeNote({ id: 'web-1', reminderAt: iso(DAY), reminderRecurrence: 'once' });
  act(() => handlers.onUpsert(n));
  await waitFor(() => expect(scheduledFor('web-1')).toHaveLength(1));
});

test('R2: Erinnerung einer bestehenden Notiz wird per Realtime verschoben → neu geplant mit neuem Zeitpunkt', async () => {
  const handlers = await mountSynced();
  const first = makeNote({ id: 'web-2', reminderAt: iso(DAY), updatedAt: iso(-1000) });
  act(() => handlers.onUpsert(first));
  await waitFor(() => expect(scheduledFor('web-2')).toHaveLength(1));
  const later = iso(2 * DAY);
  act(() => handlers.onUpsert({ ...first, reminderAt: later, updatedAt: iso(0) }));
  await waitFor(() => expect(scheduledFor('web-2').at(-1)![0].triggerDate).toEqual(new Date(later)));
});

test('R3: Änderung ohne Bezug zur Erinnerung (z. B. Pin) plant nicht unnötig neu', async () => {
  const handlers = await mountSynced();
  const n = makeNote({ id: 'web-3', reminderAt: iso(DAY), updatedAt: iso(-1000) });
  act(() => handlers.onUpsert(n));
  await waitFor(() => expect(scheduledFor('web-3')).toHaveLength(1));
  act(() => handlers.onUpsert({ ...n, isPinned: true, updatedAt: iso(0) }));
  await act(async () => { await new Promise((r) => setTimeout(r, 800)); });
  expect(scheduledFor('web-3')).toHaveLength(1);
});

test('R4: Notiz mit Erinnerung wird remote gelöscht → alte Erinnerungen werden abgeräumt', async () => {
  const handlers = await mountSynced();
  const n = makeNote({ id: 'web-4', reminderAt: iso(DAY) });
  act(() => handlers.onUpsert(n));
  await waitFor(() => expect(scheduledFor('web-4')).toHaveLength(1));
  const cancelsBefore = notifications.cancelAllReminders.mock.calls.length;
  act(() => handlers.onDelete('web-4'));
  await waitFor(() => expect(notifications.cancelAllReminders.mock.calls.length).toBeGreaterThan(cancelsBefore));
  expect(scheduledFor('web-4')).toHaveLength(1);
});

test('R5: Erinnerung, die beim Start-Pull ankommt, wird geplant', async () => {
  remoteNotes.pullRemote.mockResolvedValue([makeNote({ id: 'web-5', reminderAt: iso(DAY) })]);
  await mountSynced();
  await waitFor(() => expect(scheduledFor('web-5').length).toBeGreaterThanOrEqual(1));
});
