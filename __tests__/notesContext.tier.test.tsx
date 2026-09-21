/**
 * Abo-Status im NotesContext: Startwert, Cache und Offline-Verhalten.
 *
 * Der Kern: `tier` startet als `null` ("noch nicht bekannt"), nicht als 'free'.
 * Der Cache liefert beim naechsten Kaltstart sofort den zuletzt bestaetigten
 * Wert, und ein Netzfehler degradiert einen Pro-Nutzer NICHT auf Free.
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotesProvider, useNotes } from '../src/context/NotesContext';
import { saveTierCache } from '../src/storage/noteStorage';

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
  subscriptionService: { getStatus: jest.fn() },
}));
// Sync abgeschaltet: dieser Test interessiert sich nur fuer den Abo-Pfad.
jest.mock('../src/sync/supabaseClient', () => ({
  isSyncConfigured: () => false,
  getSupabase: () => null,
}));
jest.mock('../src/sync/userId', () => ({ getUserId: jest.fn(), clearUserIdCache: jest.fn() }));
jest.mock('../src/sync/remoteNotes', () => ({
  pullRemote: jest.fn(), upsertRemote: jest.fn(), deleteRemote: jest.fn(),
  subscribeRemote: jest.fn(() => () => {}),
}));

const { subscriptionService } = require('../src/sync/subscriptionService') as {
  subscriptionService: { getStatus: jest.Mock };
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <NotesProvider>{children}</NotesProvider>
);

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

test('Startwert ist null ("unbekannt"), nicht free', async () => {
  // Server antwortet nie — genau das Fenster, in dem der Banner aufblitzte.
  subscriptionService.getStatus.mockImplementation(() => new Promise(() => {}));

  const { result } = renderHook(() => useNotes(), { wrapper });

  expect(result.current.tier).toBeNull();
  expect(result.current.tierKnown).toBe(false);
});

test('Server-Antwort setzt den Tier und markiert ihn als bekannt', async () => {
  subscriptionService.getStatus.mockResolvedValue({ tier: 'pro', nextAllowedAt: null });

  const { result } = renderHook(() => useNotes(), { wrapper });

  await waitFor(() => expect(result.current.tier).toBe('pro'));
  expect(result.current.tierKnown).toBe(true);
});

test('gecachter Pro-Tier steht vor der Server-Antwort zur Verfuegung', async () => {
  await AsyncStorage.setItem('@notizapp_sync_uid', 'u1');
  await saveTierCache({ uid: 'u1', tier: 'pro' });
  // Server haengt: nur der Cache kann hier antworten.
  subscriptionService.getStatus.mockImplementation(() => new Promise(() => {}));

  const { result } = renderHook(() => useNotes(), { wrapper });

  await waitFor(() => expect(result.current.tier).toBe('pro'));
});

test('Cache eines fremden Kontos wird nicht uebernommen', async () => {
  await AsyncStorage.setItem('@notizapp_sync_uid', 'u2');
  await saveTierCache({ uid: 'u1', tier: 'pro' });
  subscriptionService.getStatus.mockImplementation(() => new Promise(() => {}));

  const { result } = renderHook(() => useNotes(), { wrapper });

  // Kurz warten, damit ein faelschlicher Cache-Treffer sichtbar wuerde.
  await new Promise((r) => setTimeout(r, 20));
  expect(result.current.tier).toBeNull();
});

test('Netzfehler degradiert einen gecachten Pro-Tier NICHT auf free', async () => {
  await AsyncStorage.setItem('@notizapp_sync_uid', 'u1');
  await saveTierCache({ uid: 'u1', tier: 'pro' });
  subscriptionService.getStatus.mockRejectedValue(new Error('network request failed'));

  const { result } = renderHook(() => useNotes(), { wrapper });

  await waitFor(() => expect(result.current.tier).toBe('pro'));
  // Auch nachdem der Fehler durch ist, bleibt es bei Pro.
  await new Promise((r) => setTimeout(r, 20));
  expect(result.current.tier).toBe('pro');
});

test('erfolgreicher Abruf schreibt den Tier in den Cache', async () => {
  await AsyncStorage.setItem('@notizapp_sync_uid', 'u1');
  subscriptionService.getStatus.mockResolvedValue({ tier: 'basic', nextAllowedAt: null });

  const { result } = renderHook(() => useNotes(), { wrapper });
  await waitFor(() => expect(result.current.tier).toBe('basic'));

  await waitFor(async () => {
    const raw = await AsyncStorage.getItem('@notizapp_tier_cache');
    expect(raw && JSON.parse(raw)).toEqual({ uid: 'u1', tier: 'basic' });
  });
});
