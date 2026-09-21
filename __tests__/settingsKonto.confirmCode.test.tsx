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

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
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

test('pending-confirmation zeigt die Code-Eingabe', async () => {
  render(<SettingsKontoScreen />);
  await screen.findByText(t('settingsKonto.pendingTitle'));

  expect(screen.getByPlaceholderText(t('settingsKonto.confirmCodePlaceholder'))).toBeTruthy();
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

test('kein Passwort-Fallback mehr: der Code ist der einzige Weg', async () => {
  render(<SettingsKontoScreen />);
  await screen.findByText(t('settingsKonto.pendingTitle'));

  // Die Templates enthalten keinen Link mehr — ein "Bestaetigung pruefen"
  // haette nichts zu pruefen und liefe ins Leere.
  expect(screen.queryByPlaceholderText(t('settingsKonto.passwordPlaceholderGeneric'))).toBeNull();
  expect(mockSignInWithPassword).not.toHaveBeenCalled();
  // Erneut senden bleibt erreichbar, falls die Mail nicht ankam.
  expect(screen.getByText(t('settingsKonto.resendConfirmation'))).toBeTruthy();
});

test('nach dem Sichern geht es in den Notes-Screen', async () => {
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

  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('Home', { screen: 'Threads' }));
});

test('scheitert der Erstupload, bleibt der Nutzer beim Retry-Button', async () => {
  mockVerifyOtp.mockResolvedValue({
    data: {
      session: {
        access_token: 'tok',
        user: { id: 'u1', email: 'louis@example.com', email_confirmed_at: '2026-01-01T00:00:00.000Z' },
      },
    },
    error: null,
  });
  mockUploadLocalNotes.mockRejectedValueOnce(new Error('offline'));

  render(<SettingsKontoScreen />);
  await screen.findByText(t('settingsKonto.pendingTitle'));

  fireEvent.changeText(screen.getByPlaceholderText(t('settingsKonto.confirmCodePlaceholder')), '123456');
  fireEvent.press(screen.getByText(t('settingsKonto.confirmCodeButton')));

  // Der Retry lebt in diesem Screen — wegnavigieren wuerde ihn verstecken.
  await screen.findByText(t('settingsKonto.retryUploadButton'));
  expect(mockNavigate).not.toHaveBeenCalled();
});
