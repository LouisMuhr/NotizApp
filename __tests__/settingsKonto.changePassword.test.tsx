/**
 * Passwortwechsel verlangt einen Code aus der Mail.
 *
 * Vorher genuegte die bestehende Session: wer das entsperrte Geraet in die
 * Hand bekam, konnte in Einstellungen → Konto zweimal ein neues Passwort
 * tippen und das Konto uebernehmen — der rechtmaessige Besitzer war danach
 * ausgesperrt. Der Code ist der zweite Faktor: ohne Postfach-Zugriff kein
 * neues Passwort.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Portal-Host fuer den Abbruch-Dialog im Screen (in der App steht er in App.tsx).
import { Provider as PaperProvider } from 'react-native-paper';

const mockResetPasswordForEmail = jest.fn(async () => ({ error: null }));
const mockVerifyOtp = jest.fn();
const mockUpdateUser = jest.fn(async () => ({ error: null }));
const mockNavigate = jest.fn();

const CONFIRMED_USER = {
  id: 'u1',
  email: 'louis@example.com',
  email_confirmed_at: '2026-01-01T00:00:00.000Z',
};

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
jest.mock('../src/context/NotesContext', () => ({
  useNotes: () => ({
    resyncForUser: jest.fn(async () => {}),
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
      // Angemeldet und bestaetigt — der Konto-Screen zeigt den secured-Block.
      getUser: async () => ({ data: { user: CONFIRMED_USER } }),
      getSession: async () => ({ data: { session: { access_token: 'tok', user: CONFIRMED_USER } } }),
      resetPasswordForEmail: mockResetPasswordForEmail,
      verifyOtp: mockVerifyOtp,
      updateUser: mockUpdateUser,
    },
  }),
}));

const SettingsKontoScreen = require('../src/screens/SettingsKontoScreen').default;
const { t } = require('../src/i18n');

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

test('ohne Code gibt es kein Passwortfeld — nur den Anforderungs-Button', async () => {
  render(<PaperProvider><SettingsKontoScreen /></PaperProvider>);
  await screen.findByText(t('settingsKonto.requestPasswordTokenButton'));

  // Genau das war die Luecke: hier stand frueher direkt das Formular.
  expect(screen.queryByText(t('settingsKonto.updatePasswordButton'))).toBeNull();
});

test('Schritt 1 fordert einen Code fuer das bestehende Konto an', async () => {
  render(<PaperProvider><SettingsKontoScreen /></PaperProvider>);
  fireEvent.press(await screen.findByText(t('settingsKonto.requestPasswordTokenButton')));

  // resetPasswordForEmail zieht das Recovery-Template, das bereits im
  // Velm-Stil steht — signInWithOtp haette ein drittes Template verlangt.
  await waitFor(() => expect(mockResetPasswordForEmail).toHaveBeenCalledWith('louis@example.com'));
  await screen.findByText(t('settingsKonto.changePasswordCodeTitle'));
});

test('erst nach eingeloestem Code erscheint das Passwortfeld', async () => {
  mockVerifyOtp.mockResolvedValue({
    data: { session: { access_token: 'tok', user: CONFIRMED_USER } },
    error: null,
  });

  render(<PaperProvider><SettingsKontoScreen /></PaperProvider>);
  fireEvent.press(await screen.findByText(t('settingsKonto.requestPasswordTokenButton')));
  fireEvent.changeText(
    await screen.findByPlaceholderText(t('settingsKonto.confirmCodePlaceholder')),
    '123456',
  );
  fireEvent.press(screen.getByText(t('settingsKonto.changePasswordCodeButton')));

  await waitFor(() => expect(mockVerifyOtp).toHaveBeenCalledWith({
    email: 'louis@example.com',
    token: '123456',
    type: 'recovery',
  }));
  await screen.findByPlaceholderText(t('settingsKonto.passwordPlaceholder'));
});

test('falscher Code fuehrt nicht zum Passwortfeld', async () => {
  mockVerifyOtp.mockResolvedValue({ data: { session: null }, error: { message: 'expired' } });

  render(<PaperProvider><SettingsKontoScreen /></PaperProvider>);
  fireEvent.press(await screen.findByText(t('settingsKonto.requestPasswordTokenButton')));
  fireEvent.changeText(
    await screen.findByPlaceholderText(t('settingsKonto.confirmCodePlaceholder')),
    '000000',
  );
  fireEvent.press(screen.getByText(t('settingsKonto.changePasswordCodeButton')));

  await screen.findByText(t('settingsKonto.toastPasswordCodeInvalid'));
  expect(screen.queryByPlaceholderText(t('settingsKonto.passwordPlaceholder'))).toBeNull();
  expect(mockUpdateUser).not.toHaveBeenCalled();
});

test('nach dem Wechsel geht es zurueck in den Threads-Screen', async () => {
  mockVerifyOtp.mockResolvedValue({
    data: { session: { access_token: 'tok', user: CONFIRMED_USER } },
    error: null,
  });

  render(<PaperProvider><SettingsKontoScreen /></PaperProvider>);
  fireEvent.press(await screen.findByText(t('settingsKonto.requestPasswordTokenButton')));
  fireEvent.changeText(
    await screen.findByPlaceholderText(t('settingsKonto.confirmCodePlaceholder')),
    '123456',
  );
  fireEvent.press(screen.getByText(t('settingsKonto.changePasswordCodeButton')));

  await screen.findByPlaceholderText(t('settingsKonto.passwordPlaceholder'));
  fireEvent.changeText(
    screen.getByPlaceholderText(t('settingsKonto.passwordPlaceholder')),
    'neuesPw123',
  );
  fireEvent.changeText(
    screen.getByPlaceholderText(t('settingsKonto.confirmPasswordPlaceholder')),
    'neuesPw123',
  );
  fireEvent.press(screen.getByText(t('settingsKonto.updatePasswordButton')));

  await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'neuesPw123' }));
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('Home', { screen: 'Threads' }));
});
