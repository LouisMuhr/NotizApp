/**
 * „Konto sichern" mit einer Adresse, die schon ein bestaetigtes Konto ist (z. B. im Web angelegt).
 *
 * Supabase meldet bei `signUp()` dann aus Enumeration-Schutz keinen Fehler, verschickt aber auch
 * keinen Code (`identities: []`). Frueher zeigte die App „Bestaetigungs-E-Mail gesendet" und wartete
 * auf eine Mail, die nie kam. Erwartung: Hinweis + Wechsel in die Anmeldung, Adresse bleibt stehen.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Provider as PaperProvider } from 'react-native-paper';

const mockSignUp = jest.fn();

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('../src/context/NotesContext', () => ({
  useNotes: () => ({
    resyncForUser: jest.fn(async () => {}),
    syncAfterSignIn: jest.fn(async () => 'replaced'),
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
      signUp: mockSignUp,
    },
  }),
}));

const SettingsKontoScreen = require('../src/screens/SettingsKontoScreen').default;
const { t } = require('../src/i18n');

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

test('bereits bestaetigte Adresse: kein falsches „Mail gesendet", sondern ab in die Anmeldung', async () => {
  mockSignUp.mockResolvedValue({
    data: { user: { id: 'obfuscated', email: 'web@example.com', identities: [] }, session: null },
    error: null,
  });

  render(<PaperProvider><SettingsKontoScreen /></PaperProvider>);
  fireEvent.changeText(await screen.findByPlaceholderText(t('settingsKonto.emailPlaceholder')), 'web@example.com');
  fireEvent.changeText(screen.getByPlaceholderText(t('settingsKonto.passwordPlaceholder')), 'geheim123');
  fireEvent.changeText(screen.getByPlaceholderText(t('settingsKonto.confirmPasswordPlaceholder')), 'geheim123');
  fireEvent.press(screen.getByText(t('settingsKonto.secureNowButton')));

  await screen.findByText(t('settingsKonto.toastAccountExists'));
  // Anmelde-Formular mit vorausgefuellter Adresse, kein Warten auf einen Code
  expect(screen.getByText(t('settingsKonto.forgotPassword'))).toBeTruthy(); // gibt es nur im Anmelden-Tab
  expect(screen.getByDisplayValue('web@example.com')).toBeTruthy();
  expect(screen.queryByText(t('settingsKonto.pendingTitle'))).toBeNull();
  expect(await AsyncStorage.getItem('@notizapp_pending_email')).toBeNull();
});
