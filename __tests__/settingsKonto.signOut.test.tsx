/**
 * A3: Abmelden offline. supabase.auth.signOut() liefert bei Netzfehler ein
 * { error } zurueck (wirft nicht). Erwartung: die App darf dann weder den Sync
 * abschalten noch nach `local` wechseln, solange die Session lebt.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Portal-Host fuer den Abbruch-Dialog im Screen (in der App steht er in App.tsx).
import { Provider as PaperProvider } from 'react-native-paper';

const mockDetachNotes = jest.fn();
const mockDetachThreads = jest.fn(async () => {});
const mockSignOut = jest.fn();

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('../src/context/NotesContext', () => ({
  useNotes: () => ({
    resyncForUser: jest.fn(async () => {}),
    refreshSubscription: jest.fn(async () => {}),
    flushPending: jest.fn(async () => {}),
    uploadLocalNotes: jest.fn(async () => {}),
    initialUploadPending: false,
    detachSync: mockDetachNotes,
  }),
}));
jest.mock('../src/context/ThoughtsContext', () => ({
  useThoughts: () => ({ resyncForUser: jest.fn(async () => {}), detachSync: mockDetachThreads }),
}));
jest.mock('../src/context/LanguageContext', () => {
  const { t } = require('../src/i18n');
  return { useLanguage: () => ({ t, locale: 'de' }) };
});
jest.mock('../src/sync/userId', () => ({ clearUserIdCache: jest.fn() }));
jest.mock('../src/sync/supabaseClient', () => ({
  getSupabase: () => ({
    auth: {
      // Bestaetigtes Konto → Zustand `secured`, der Abmelden-Button ist sichtbar.
      getUser: async () => ({
        data: {
          user: {
            id: 'account-user',
            email: 'louis@example.com',
            email_confirmed_at: '2026-01-01T00:00:00.000Z',
          },
        },
      }),
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

test('A3: signOut() scheitert (offline) → Sync bleibt aktiv, kein Wechsel nach `local`', async () => {
  mockSignOut.mockResolvedValue({ error: { name: 'AuthRetryableFetchError', message: 'Network request failed', status: 0 } });

  render(<PaperProvider><SettingsKontoScreen /></PaperProvider>);
  const btn = await screen.findByText(t('settingsKonto.signOutButton'));
  fireEvent.press(btn);

  await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  await new Promise((r) => setTimeout(r, 50));

  expect(mockDetachNotes).not.toHaveBeenCalled();
  expect(mockDetachThreads).not.toHaveBeenCalled();
  // Der `local`-Zustand zeigt den Tab-Umschalter mit "Konto sichern".
  expect(screen.queryByText(t('settingsKonto.tabSecure'))).toBeNull();
});

test('signOut() erfolgreich → zurueck nach `local`, kein neuer anonymer User', async () => {
  mockSignOut.mockResolvedValue({ error: null });

  render(<PaperProvider><SettingsKontoScreen /></PaperProvider>);
  const btn = await screen.findByText(t('settingsKonto.signOutButton'));
  fireEvent.press(btn);

  await waitFor(() => expect(mockDetachNotes).toHaveBeenCalled());
  expect(mockDetachThreads).toHaveBeenCalled();
  // Zustand `local`: Registrierungs-/Anmelde-Tabs sind wieder da.
  await waitFor(() => expect(screen.queryByText(t('settingsKonto.tabSecure'))).not.toBeNull());
});
