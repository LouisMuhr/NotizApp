/**
 * Passwort-Reset per Code (OTP) statt per Deep Link.
 *
 * Der Link in der Reset-Mail legt die Recovery-Session im BROWSER an — die App
 * kommt nicht daran, `updateUser()` scheiterte dort mangels Session. Ein Deep
 * Link zurueck in die App braeuchte ein `scheme` in app.json und einen neuen
 * Native Build. Erwartung: der 6-stellige Code aus derselben Mail wird per
 * `verifyOtp({type:'recovery'})` eingeloest, und ERST die daraus entstehende
 * Session traegt das neue Passwort.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockResetPasswordForEmail = jest.fn(async () => ({ error: null }));
const mockVerifyOtp = jest.fn();
const mockUpdateUser = jest.fn(async () => ({ error: null }));
const mockSignOut = jest.fn(async () => ({ error: null }));
const mockResyncForUser = jest.fn(async () => {});

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('../src/context/NotesContext', () => ({
  useNotes: () => ({
    resyncForUser: mockResyncForUser,
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

// Der User ist ausgesperrt: kein User, keine Session — genau die Lage, in der
// ein Reset ueberhaupt angefordert wird.
let mockCurrentUser: any = null;
jest.mock('../src/sync/supabaseClient', () => ({
  getSupabase: () => ({
    auth: {
      getUser: async () => ({ data: { user: mockCurrentUser } }),
      getSession: async () => ({ data: { session: null } }),
      resetPasswordForEmail: mockResetPasswordForEmail,
      verifyOtp: mockVerifyOtp,
      updateUser: mockUpdateUser,
      signInWithPassword: jest.fn(),
      signOut: mockSignOut,
    },
  }),
}));

const SettingsKontoScreen = require('../src/screens/SettingsKontoScreen').default;
const { t } = require('../src/i18n');

const CONFIRMED_USER = {
  id: 'u1',
  email: 'louis@example.com',
  email_confirmed_at: '2026-01-01T00:00:00.000Z',
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mockCurrentUser = null;
});

/** Vom lokalen Zustand bis zum abgeschickten Reset-Code. */
async function requestResetCode() {
  render(<SettingsKontoScreen />);
  fireEvent.press(await screen.findByText(t('settingsKonto.tabSignIn')));
  fireEvent.changeText(
    screen.getByPlaceholderText(t('settingsKonto.emailPlaceholder')),
    'louis@example.com',
  );
  fireEvent.press(screen.getByText(t('settingsKonto.forgotPassword')));
  await screen.findByText(t('settingsKonto.resetCodeTitle'));
}

test('Reset-Anfrage oeffnet das Code-Formular fuer die eingegebene Adresse', async () => {
  await requestResetCode();
  expect(mockResetPasswordForEmail).toHaveBeenCalledWith('louis@example.com');
  expect(screen.getByPlaceholderText(t('settingsKonto.resetCodePlaceholder'))).toBeTruthy();
});

test('Code wird per verifyOtp eingeloest, bevor updateUser das Passwort setzt', async () => {
  mockVerifyOtp.mockResolvedValue({
    data: { session: { access_token: 'tok', user: CONFIRMED_USER } },
    error: null,
  });
  await requestResetCode();

  fireEvent.changeText(screen.getByPlaceholderText(t('settingsKonto.resetCodePlaceholder')), '123456');
  fireEvent.changeText(screen.getByPlaceholderText(t('settingsKonto.newPasswordPlaceholder')), 'neuesPw123');
  fireEvent.changeText(screen.getByPlaceholderText(t('settingsKonto.confirmPasswordPlaceholder')), 'neuesPw123');
  // Ab hier gilt der User als bestaetigt — resolveAccountState() liest ihn neu.
  mockCurrentUser = CONFIRMED_USER;
  fireEvent.press(screen.getByText(t('settingsKonto.resetSubmitButton')));

  await waitFor(() => expect(mockVerifyOtp).toHaveBeenCalledWith({
    email: 'louis@example.com',
    token: '123456',
    type: 'recovery',
  }));
  await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'neuesPw123' }));
  // Reihenfolge ist der Kern: ohne Session aus verifyOtp hat updateUser keine.
  expect(mockVerifyOtp.mock.invocationCallOrder[0])
    .toBeLessThan(mockUpdateUser.mock.invocationCallOrder[0]);
});

test('ungueltiger Code setzt kein Passwort', async () => {
  mockVerifyOtp.mockResolvedValue({ data: { session: null }, error: { message: 'Token has expired' } });
  await requestResetCode();

  fireEvent.changeText(screen.getByPlaceholderText(t('settingsKonto.resetCodePlaceholder')), '000000');
  fireEvent.changeText(screen.getByPlaceholderText(t('settingsKonto.newPasswordPlaceholder')), 'neuesPw123');
  fireEvent.changeText(screen.getByPlaceholderText(t('settingsKonto.confirmPasswordPlaceholder')), 'neuesPw123');
  fireEvent.press(screen.getByText(t('settingsKonto.resetSubmitButton')));

  await screen.findByText(t('settingsKonto.toastResetCodeInvalid'));
  expect(mockUpdateUser).not.toHaveBeenCalled();
});

test('abweichende Passwort-Wiederholung loest den Code gar nicht erst ein', async () => {
  await requestResetCode();

  fireEvent.changeText(screen.getByPlaceholderText(t('settingsKonto.resetCodePlaceholder')), '123456');
  fireEvent.changeText(screen.getByPlaceholderText(t('settingsKonto.newPasswordPlaceholder')), 'neuesPw123');
  fireEvent.changeText(screen.getByPlaceholderText(t('settingsKonto.confirmPasswordPlaceholder')), 'vertippt');
  fireEvent.press(screen.getByText(t('settingsKonto.resetSubmitButton')));

  await screen.findByText(t('settingsKonto.toastPasswordsMismatch'));
  expect(mockVerifyOtp).not.toHaveBeenCalled();
});

test('laufende Registrierung: der Reset ersetzt die Bestaetigung nicht', async () => {
  // Kein pending-Screen: der Nutzer ist im Anmelden-Tab (Neustart, zweites
  // Geraet). Der Merker verraet aber, dass die Bestaetigung noch aussteht.
  mockVerifyOtp.mockResolvedValue({
    data: { session: { access_token: 'tok', user: CONFIRMED_USER } },
    error: null,
  });
  await requestResetCode();
  await AsyncStorage.setItem('@notizapp_pending_email', 'louis@example.com');

  fireEvent.changeText(screen.getByPlaceholderText(t('settingsKonto.resetCodePlaceholder')), '123456');
  fireEvent.changeText(screen.getByPlaceholderText(t('settingsKonto.newPasswordPlaceholder')), 'neuesPw123');
  fireEvent.changeText(screen.getByPlaceholderText(t('settingsKonto.confirmPasswordPlaceholder')), 'neuesPw123');
  fireEvent.press(screen.getByText(t('settingsKonto.resetSubmitButton')));

  await screen.findByText(t('settingsKonto.toastResetNeedsConfirmed'));
  // verifyOtp() haette die Adresse als Nebeneffekt bestaetigt — das Passwort
  // darf trotzdem nicht gesetzt werden, und die Session wird verworfen.
  expect(mockUpdateUser).not.toHaveBeenCalled();
  expect(mockSignOut).toHaveBeenCalled();
});
