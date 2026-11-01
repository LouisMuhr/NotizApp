/**
 * Anmeldung mit einem Konto, das noch nicht bestaetigt ist.
 *
 * Typischer Weg: im Web registriert, den Code dort nicht eingegeben, dann in
 * der App angemeldet. Supabase lehnt `signInWithPassword` dann mit
 * `email_not_confirmed` ab und liefert keinen User. Erwartung: kein toter
 * Fehler-Toast, sondern direkt die Code-Eingabe — bestaetigt wird per
 * `verifyOtp({type:'signup'})`, das ohne Session auskommt.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Provider as PaperProvider } from 'react-native-paper';

const mockSignInWithPassword = jest.fn();
const mockSyncAfterSignIn = jest.fn(async () => 'replaced');

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('../src/context/NotesContext', () => ({
  useNotes: () => ({
    resyncForUser: jest.fn(async () => {}),
    syncAfterSignIn: mockSyncAfterSignIn,
    refreshSubscription: jest.fn(async () => {}),
    flushPending: jest.fn(async () => {}),
    uploadLocalNotes: jest.fn(async () => {}),
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
      getUser: async () => ({ data: { user: null } }),
      getSession: async () => ({ data: { session: null } }),
      signInWithPassword: mockSignInWithPassword,
      updateUser: jest.fn(async () => ({ error: null })),
      resend: jest.fn(async () => ({ error: null })),
    },
  }),
}));

const SettingsKontoScreen = require('../src/screens/SettingsKontoScreen').default;
const { t } = require('../src/i18n');

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

async function signIn() {
  render(<PaperProvider><SettingsKontoScreen /></PaperProvider>);
  fireEvent.press(await screen.findByText(t('settingsKonto.tabSignIn')));
  fireEvent.changeText(screen.getByPlaceholderText(t('settingsKonto.emailPlaceholder')), 'web@example.com');
  fireEvent.changeText(screen.getByPlaceholderText(t('settingsKonto.passwordPlaceholderGeneric')), 'geheim123');
  // Tab und Button koennen gleich heissen — der Button steht unter dem Tab.
  const buttons = screen.getAllByText(t('settingsKonto.signInButton'));
  fireEvent.press(buttons[buttons.length - 1]);
}

test('unbestaetigtes Konto fuehrt direkt in die Code-Eingabe', async () => {
  mockSignInWithPassword.mockResolvedValue({
    data: { user: null, session: null },
    error: { code: 'email_not_confirmed', message: 'Email not confirmed' },
  });

  await signIn();

  await screen.findByText(t('settingsKonto.pendingTitle'));
  expect(screen.getByPlaceholderText(t('settingsKonto.confirmCodePlaceholder'))).toBeTruthy();
  // Ohne Session haelt nur die gemerkte Adresse den Zustand ueber einen Neustart.
  expect(await AsyncStorage.getItem('@notizapp_pending_email')).toBe('web@example.com');
  expect(mockSyncAfterSignIn).not.toHaveBeenCalled();
});

test('falsches Passwort bleibt ein normaler Fehler', async () => {
  mockSignInWithPassword.mockResolvedValue({
    data: { user: null, session: null },
    error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
  });

  await signIn();

  await screen.findByText(t('settingsKonto.toastSignInFailed') + 'Invalid login credentials');
  expect(screen.queryByText(t('settingsKonto.pendingTitle'))).toBeNull();
  expect(await AsyncStorage.getItem('@notizapp_pending_email')).toBeNull();
});

test('bestaetigtes Konto synchronisiert ueber syncAfterSignIn', async () => {
  mockSignInWithPassword.mockResolvedValue({
    data: { user: { id: 'u1', email: 'web@example.com', email_confirmed_at: '2026-01-01T00:00:00.000Z' } },
    error: null,
  });

  await signIn();

  await waitFor(() => expect(mockSyncAfterSignIn).toHaveBeenCalledWith('u1'));
});
