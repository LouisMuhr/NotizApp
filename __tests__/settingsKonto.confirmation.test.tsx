/**
 * "Bestaetigung pruefen" ohne Session.
 *
 * Supabase gibt nach `signUp()` je nach Projekteinstellung KEINE Session aus.
 * Dann laesst sich `email_confirmed_at` nicht abfragen — `refreshSession()`
 * scheitert mangels Session und die App meldete faelschlich "noch nicht
 * bestaetigt", obwohl der Link laengst geklickt war. Erwartung: in diesem Fall
 * wird per Anmeldung geprueft.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockUploadLocalNotes = jest.fn(async () => {});
const mockSignInWithPassword = jest.fn();
const mockRefreshSession = jest.fn(async () => ({ data: {}, error: null }));

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('../src/context/NotesContext', () => ({
  useNotes: () => ({
    resyncForUser: jest.fn(async () => {}),
    refreshSubscription: jest.fn(async () => {}),
    flushPending: jest.fn(async () => {}),
    uploadLocalNotes: mockUploadLocalNotes,
    initialUploadPending: false,
    detachSync: jest.fn(),
  }),
}));
jest.mock('../src/context/ThoughtsContext', () => ({
  useThoughts: () => ({ resyncForUser: jest.fn(async () => {}), detachSync: jest.fn(async () => {}) }),
}));
jest.mock('../src/context/LanguageContext', () => {
  const { t } = require('../src/i18n');
  return { useLanguage: () => ({ t, locale: 'de' }) };
});
jest.mock('../src/sync/userId', () => ({ clearUserIdCache: jest.fn() }));
jest.mock('../src/sync/supabaseClient', () => ({
  getSupabase: () => ({
    auth: {
      // Kein User und keine Session — der Zustand kommt aus @notizapp_pending_email.
      getUser: async () => ({ data: { user: null } }),
      getSession: async () => ({ data: { session: null } }),
      refreshSession: mockRefreshSession,
      signInWithPassword: mockSignInWithPassword,
    },
  }),
}));

const SettingsKontoScreen = require('../src/screens/SettingsKontoScreen').default;
const { t } = require('../src/i18n');

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  // Laufende Registrierung ohne Session.
  await AsyncStorage.setItem('@notizapp_pending_email', 'louis@example.com');
});

test('ohne Session wird die Bestaetigung per Anmeldung geprueft, nicht per refreshSession', async () => {
  mockSignInWithPassword.mockResolvedValue({
    data: {
      user: { id: 'u1', email: 'louis@example.com', email_confirmed_at: '2026-01-01T00:00:00.000Z' },
      session: { access_token: 'tok' },
    },
    error: null,
  });

  render(<SettingsKontoScreen />);
  await screen.findByText(t('settingsKonto.pendingTitle'));

  fireEvent.changeText(screen.getByPlaceholderText(t('settingsKonto.passwordPlaceholderGeneric')), 'geheim123');
  fireEvent.press(screen.getByText(t('settingsKonto.checkConfirmationButton')));

  await waitFor(() => expect(mockSignInWithPassword).toHaveBeenCalledWith({
    email: 'louis@example.com',
    password: 'geheim123',
  }));
  // Bestaetigt → Erstupload laeuft an, der Merker ist weg.
  await waitFor(() => expect(mockUploadLocalNotes).toHaveBeenCalledWith('u1'));
  expect(await AsyncStorage.getItem('@notizapp_pending_email')).toBeNull();
});

test('noch nicht bestaetigt → Zustand bleibt pending, kein Upload', async () => {
  mockSignInWithPassword.mockResolvedValue({
    data: { user: null, session: null },
    error: { code: 'email_not_confirmed', message: 'Email not confirmed' },
  });

  render(<SettingsKontoScreen />);
  await screen.findByText(t('settingsKonto.pendingTitle'));

  fireEvent.changeText(screen.getByPlaceholderText(t('settingsKonto.passwordPlaceholderGeneric')), 'geheim123');
  fireEvent.press(screen.getByText(t('settingsKonto.checkConfirmationButton')));

  await waitFor(() => expect(mockSignInWithPassword).toHaveBeenCalled());
  expect(mockUploadLocalNotes).not.toHaveBeenCalled();
  // Merker bleibt stehen, damit der Zustand einen Neustart ueberlebt.
  expect(await AsyncStorage.getItem('@notizapp_pending_email')).toBe('louis@example.com');
});
