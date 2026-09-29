/**
 * Archiv leeren: alle archivierten Notizen weg, aktive bleiben, IDs landen gebündelt
 * als Tombstones (verhindert, dass der Sync sie wieder einspielt).
 */
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotesProvider, useNotes } from '../src/context/NotesContext';

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
  subscriptionService: { getStatus: jest.fn(() => new Promise(() => {})) },
}));
jest.mock('../src/sync/supabaseClient', () => ({ isSyncConfigured: () => false, getSupabase: () => null }));
jest.mock('../src/sync/userId', () => ({ getUserId: jest.fn(), clearUserIdCache: jest.fn() }));
jest.mock('../src/sync/remoteNotes', () => ({
  pullRemote: jest.fn(), upsertRemote: jest.fn(), deleteRemote: jest.fn(),
  subscribeRemote: jest.fn(() => () => {}),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => <NotesProvider>{children}</NotesProvider>;

const draft = (title: string) => ({
  title, content: '', category: 'Allgemein', isPinned: false, checklist: [],
  reminderAt: null, reminderRecurrence: 'once' as const, reminderWeekday: null, reminderDayOfMonth: null,
  feedsThreads: false, source: 'app' as const,
});

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

test('löscht alle archivierten Notizen, aktive bleiben, Tombstones gesetzt', async () => {
  const { result } = renderHook(() => useNotes(), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));

  let a: any, b: any, c: any;
  await act(async () => {
    a = await result.current.addNote(draft('A'));
    b = await result.current.addNote(draft('B'));
    c = await result.current.addNote(draft('C'));
  });
  await act(async () => {
    await result.current.deleteNote(a.id);
    await result.current.deleteNote(b.id);
  });
  expect(result.current.archivedNotes).toHaveLength(2);

  await act(async () => { await result.current.deleteAllArchivedNotes(); });

  expect(result.current.archivedNotes).toHaveLength(0);
  expect(result.current.notes.map((n) => n.id)).toEqual([c.id]);
  const tombstones = JSON.parse((await AsyncStorage.getItem('@notizapp_tombstones')) ?? '[]');
  expect(tombstones.sort()).toEqual([a.id, b.id].sort());
});

test('leeres Archiv: nichts zu tun, keine Tombstones', async () => {
  const { result } = renderHook(() => useNotes(), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => { await result.current.deleteAllArchivedNotes(); });
  expect(await AsyncStorage.getItem('@notizapp_tombstones')).toBeNull();
});
