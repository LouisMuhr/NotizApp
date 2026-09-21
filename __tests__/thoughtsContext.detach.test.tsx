/**
 * Threads werden beim Trennen vom Konto wie Notizen behandelt: der lokale
 * Bestand bleibt auf dem Geraet.
 *
 * Die App sagt beim Trennen zu, dass die Daten erhalten bleiben. Frueher leerte
 * detachSync `@brainstorm_threads` — der Nutzer verlor stillschweigend etwas,
 * das er vor Augen hatte.
 */
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThoughtsProvider, useThoughts } from '../src/context/ThoughtsContext';
import { Thread } from '../src/models/Thought';

jest.mock('../src/sync/supabaseClient', () => ({ isSyncConfigured: () => true }));
jest.mock('../src/sync/userId', () => ({ getUserId: jest.fn(async () => null) }));
jest.mock('../src/sync/remoteThoughts', () => ({
  pullThreads: jest.fn(async () => []),
  archiveThread: jest.fn(),
  restoreThread: jest.fn(),
  deleteThreadPermanently: jest.fn(),
  pinThread: jest.fn(),
  unpinThread: jest.fn(),
  subscribeThreads: jest.fn(() => () => {}),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThoughtsProvider>{children}</ThoughtsProvider>
);

const makeThread = (id: string, title: string): Thread => ({
  id,
  title,
  summary: '',
  status: 'active',
  isPinned: false,
  noteCount: 0,
  noteIds: [],
  lastSynthesizedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

test('detachSync behaelt den lokalen Thread-Bestand', async () => {
  await AsyncStorage.setItem(
    '@brainstorm_threads',
    JSON.stringify([makeThread('t1', 'Mein Thread')]),
  );

  const hook = renderHook(() => useThoughts(), { wrapper });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.threads).toHaveLength(1);

  await act(async () => { await hook.result.current.detachSync(); });

  // Weder aus der Anzeige noch von der Platte verschwunden.
  expect(hook.result.current.threads.map((t) => t.title)).toEqual(['Mein Thread']);
  const stored = JSON.parse((await AsyncStorage.getItem('@brainstorm_threads')) ?? '[]');
  expect(stored).toHaveLength(1);
});
