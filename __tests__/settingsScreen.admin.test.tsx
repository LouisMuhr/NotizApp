/**
 * Admin-Bereich in den Settings: Onboarding zuruecksetzen und Test-Benachrichtigungen
 * erscheinen nur fuer das bestaetigte Admin-Konto, nie fuer andere Nutzer.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Provider as PaperProvider } from 'react-native-paper';

const mockNavigate = jest.fn();
let mockEmail: string | null = null;

jest.mock('../src/context/NotesContext', () => ({ useNotes: () => ({ tier: 'pro' }) }));
jest.mock('../src/context/LanguageContext', () => {
  const { t, setI18nLocale } = require('../src/i18n');
  setI18nLocale('de');
  return { useLanguage: () => ({ t, locale: 'de' }) };
});
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
jest.mock('../src/sync/supabaseClient', () => {
  const sessionUser = () =>
    mockEmail ? { id: 'u1', email: mockEmail, email_confirmed_at: '2026-01-01T00:00:00Z' } : null;
  return {
    getSupabase: () => ({
      auth: {
        getUser: async () => ({ data: { user: sessionUser() }, error: null }),
        getSession: async () => ({ data: { session: sessionUser() ? { user: sessionUser() } : null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
      },
    }),
  };
});

const SettingsScreen = require('../src/screens/SettingsScreen').default;
const { ONBOARDING_KEY } = require('../src/screens/onboarding/shared');

const renderScreen = () => render(<PaperProvider><SettingsScreen /></PaperProvider>);

beforeEach(() => {
  mockNavigate.mockClear();
  mockEmail = null;
});

test('Admin sieht den Admin-Bereich und kann das Onboarding zuruecksetzen', async () => {
  mockEmail = 'louismuhr8@gmail.com';
  await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
  renderScreen();

  fireEvent.press(await screen.findByText('Onboarding zurücksetzen'));
  await waitFor(() => expect(screen.getByText('Onboarding zurückgesetzt')).toBeTruthy());
  expect(await AsyncStorage.getItem(ONBOARDING_KEY)).toBeNull();
});

test('Admin gelangt zu den Test-Benachrichtigungen', async () => {
  mockEmail = 'louismuhr8@gmail.com';
  renderScreen();

  fireEvent.press(await screen.findByText('Test-Benachrichtigungen'));
  expect(mockNavigate).toHaveBeenCalledWith('SettingsTestBenachrichtigungen');
});

test('anderes Konto sieht keinen Admin-Bereich', async () => {
  mockEmail = 'jemand@example.com';
  renderScreen();

  await waitFor(() => expect(screen.getByText('Konto & Sicherheit')).toBeTruthy());
  expect(screen.queryByText('Admin')).toBeNull();
  expect(screen.queryByText('Onboarding zurücksetzen')).toBeNull();
  expect(screen.queryByText('Test-Benachrichtigungen')).toBeNull();
});

test('ohne Konto sieht niemand den Admin-Bereich', async () => {
  renderScreen();

  await waitFor(() => expect(screen.getByText('Konto & Sicherheit')).toBeTruthy());
  expect(screen.queryByText('Admin')).toBeNull();
});
