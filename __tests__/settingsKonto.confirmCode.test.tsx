/**
 * Registrierung per Code (OTP) statt per Link.
 *
 * Der Bestaetigungslink fuehrt in den Browser und laesst den Nutzer dort
 * stehen — die App musste den Status danach per Anmeldung nachfragen. Mit
 * `verifyOtp({type:'signup'})` bestaetigt der Code die Adresse UND liefert die
 * Session, also beides in einem Schritt. Der Passwort-Weg bleibt als Fallback
 * erhalten, weil aeltere Mails im Postfach noch keinen Code zeigen.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockVerifyOtp = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockUploadLocalNotes = jest.fn(async () => {});

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
      // Kein User, keine Session: der Zustand kommt aus @notizapp_pending_email.
      getUser: async () => ({ data: { user: null } }),
      getSession: async () => ({ data: { session: null } }),
      verifyOtp: mockVerifyOtp,
      signInWithPassword: mockSignInWithPassword,
      resend: jest.fn(async () => ({ error: null })),
    },
  }),
}));

const SettingsKontoScreen = require('../src/screens/SettingsKontoScreen').default;
const { t } = require('../src/i18n');

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  // Laufende Registrierung, Bestaetigung steht aus.
  await AsyncStorage.setItem('@notizapp_pending_email', 'louis@example.com');
});

test('Code-Eingabe ist der Standard, nicht die Passwort-Abfrage', async () => {
  render(<SettingsKontoScreen />);
  await screen.findByText(t('settingsKonto.pendingTitle'));

  expect(screen.getByPlaceholderText(t('settingsKonto.confirmCodePlaceholder'))).toBeTruthy();
  expect(screen.queryByText(t('settingsKonto.checkConfirmationButton'))).toBeNull();
});

test('gueltiger Code bestaetigt das Konto und startet den Erstupload', async () => {
  mockVerifyOtp.mockResolvedValue({
    data: {
      session: {
        access_token: 'tok',
        user: { id: 'u1', email: 'louis@example.com', email_confirmed_at: '2026-01-01T00:00:00.000Z' },
      },
    },
    error: null,
  });

  render(<SettingsKontoScreen />);
  await screen.findByText(t('settingsKonto.pendingTitle'));

  fireEvent.changeText(screen.getByPlaceholderText(t('settingsKonto.confirmCodePlaceholder')), '123456');
  fireEvent.press(screen.getByText(t('settingsKonto.confirmCodeButton')));

  await waitFor(() => expect(mockVerifyOtp).toHaveBeenCalledWith({
    email: 'louis@example.com',
    token: '123456',
    type: 'signup',
  }));
  // finishSecuring() haengt am selben Abschluss wie der Link-Weg.
  await waitFor(() => expect(mockUploadLocalNotes).toHaveBeenCalledWith('u1'));
  // Die gemerkte Adresse ist weg — sonst bliebe der Screen beim Neustart pending.
  await waitFor(async () => {
    expect(await AsyncStorage.getItem('@notizapp_pending_email')).toBeNull();
  });
});

test('ungueltiger Code sichert das Konto nicht', async () => {
  mockVerifyOtp.mockResolvedValue({ data: { session: null }, error: { message: 'Token has expired' } });

  render(<SettingsKontoScreen />);
  await screen.findByText(t('settingsKonto.pendingTitle'));

  fireEvent.changeText(screen.getByPlaceholderText(t('settingsKonto.confirmCodePlaceholder')), '000000');
  fireEvent.press(screen.getByText(t('settingsKonto.confirmCodeButton')));

  await screen.findByText(t('settingsKonto.toastConfirmCodeInvalid'));
  expect(mockUploadLocalNotes).not.toHaveBeenCalled();
});

test('Fallback: der Passwort-Weg bleibt fuer Mails ohne Code erreichbar', async () => {
  mockSignInWithPassword.mockResolvedValue({
    data: {
      user: { id: 'u1', email: 'louis@example.com', email_confirmed_at: '2026-01-01T00:00:00.000Z' },
      session: { access_token: 'tok' },
    },
    error: null,
  });

  render(<SettingsKontoScreen />);
  await screen.findByText(t('settingsKonto.pendingTitle'));

  fireEvent.press(screen.getByText(t('settingsKonto.checkViaPasswordLink')));
  fireEvent.changeText(
    await screen.findByPlaceholderText(t('settingsKonto.passwordPlaceholderGeneric')),
    'geheim123',
  );
  fireEvent.press(screen.getByText(t('settingsKonto.checkConfirmationButton')));

  await waitFor(() => expect(mockSignInWithPassword).toHaveBeenCalled());
  expect(mockVerifyOtp).not.toHaveBeenCalled();
});
