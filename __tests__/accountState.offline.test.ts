/**
 * Offline meldet supabase.auth.getUser() "kein Nutzer" samt Fehler (kein Wurf).
 * Ein angemeldeter Nutzer darf dadurch nicht zum lokalen werden.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

let mockGetUser: () => Promise<any>;
let mockSession: any;

jest.mock('../src/sync/supabaseClient', () => ({
  getSupabase: () => ({
    auth: {
      getUser: () => mockGetUser(),
      getSession: async () => ({ data: { session: mockSession } }),
    },
  }),
}));

const { resolveAccountState } = require('../src/sync/accountState') as typeof import('../src/sync/accountState');

const confirmed = { id: 'u1', email: 'a@b.de', email_confirmed_at: '2026-01-01T00:00:00.000Z' };

beforeEach(async () => {
  await AsyncStorage.clear();
  mockSession = { user: confirmed };
  mockGetUser = async () => ({ data: { user: null }, error: new Error('Network request failed') });
});

test('Offline mit lokaler Session: weiterhin secured', async () => {
  expect(await resolveAccountState()).toEqual({ state: 'secured', userId: 'u1', email: 'a@b.de' });
});

test('Offline ohne Session: local', async () => {
  mockSession = null;
  expect((await resolveAccountState()).state).toBe('local');
});

test('Online ohne Nutzer (kein Fehler): local, Session wird ignoriert', async () => {
  mockGetUser = async () => ({ data: { user: null }, error: null });
  expect((await resolveAccountState()).state).toBe('local');
});
