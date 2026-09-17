/**
 * A3: Abmelden offline. supabase.auth.signOut() liefert bei Netzfehler ein
 * { error } zurueck (wirft nicht). Erwartung: die App darf dann weder den
 * lokalen Bestand ersetzen noch "abgemeldet" anzeigen, solange die Session lebt.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockResyncNotes = jest.fn(async () => {});
const mockResyncThreads = jest.fn(async () => {});
const mockSignOut = jest.fn();

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('../src/context/NotesContext', () => ({
  useNotes: () => ({ resyncForUser: mockResyncNotes, refreshSubscription: jest.fn(async () => {}), flushPending: jest.fn(async () => {}) }),
}));
jest.mock('../src/context/ThoughtsContext', () => ({ useThoughts: () => ({ resyncForUser: mockResyncThreads }) }));
jest.mock('../src/context/LanguageContext', () => {
  const { t } = require('../src/i18n');
  return { useLanguage: () => ({ t, locale: 'de' }) };
});
jest.mock('../src/sync/deleteAnonUser', () => ({ migrateAndDeleteAnonUser: jest.fn() }));
jest.mock('../src/sync/userId', () => ({
  getUserId: jest.fn(async () => 'account-user'), // Session lebt noch → gleiche UID
  clearUserIdCache: jest.fn(),
}));
jest.mock('../src/sync/supabaseClient', () => ({
  getSupabase: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'account-user', is_anonymous: false, email: 'louis@example.com' } } }),
      signOut: mockSignOut,
    },
  }),
}));

const SettingsKontoScreen = require('../src/screens/SettingsKontoScreen').default;
const { t } = require('../src/i18n');

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

test('A3: signOut() scheitert (offline) → kein Resync auf leeren Bestand, kein "abgemeldet"-Zustand', async () => {
  mockSignOut.mockResolvedValue({ error: { name: 'AuthRetryableFetchError', message: 'Network request failed', status: 0 } });

  render(<SettingsKontoScreen />);
  const btn = await screen.findByText(t('settingsKonto.signOutButton'));
  fireEvent.press(btn);

  await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  await new Promise((r) => setTimeout(r, 50));

  expect(mockResyncNotes).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('@notizapp_signed_out_uid')).toBeNull();
  expect(screen.queryByText(t('settingsKonto.signedOutBanner'))).toBeNull();
});
