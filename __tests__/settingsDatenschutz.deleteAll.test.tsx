/**
 * „Alle Daten löschen" (DSGVO Art. 17) löscht zuerst das Konto auf dem Server, dann lokal.
 *
 * Vorher lief es umgekehrt: lokal war schon alles weg, wenn der Server-Delete scheiterte
 * (Netzfehler, fehlende Cascade) — Notizen und E-Mail blieben auf dem Server, der Nutzer
 * hatte keine Kopie mehr und keinen Weg, es erneut zu versuchen.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider as PaperProvider } from 'react-native-paper';

const mockDeleteAccount = jest.fn(async () => {});
const mockDeleteAllData = jest.fn(async () => {});
const mockClearAllThreads = jest.fn();
const mockDetachThreads = jest.fn(async () => {});
const mockSignOut = jest.fn(async () => ({ error: null }));
let mockUser: { id: string } | null = { id: 'user-1' };

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('../src/context/NotesContext', () => ({
  useNotes: () => ({ notes: [], archivedNotes: [], deleteAllData: mockDeleteAllData }),
}));
jest.mock('../src/context/ThoughtsContext', () => ({
  useThoughts: () => ({ threads: [], clearAllThreads: mockClearAllThreads, detachSync: mockDetachThreads }),
}));
jest.mock('../src/context/LanguageContext', () => {
  const { t } = require('../src/i18n');
  return { useLanguage: () => ({ t, locale: 'de' }) };
});
jest.mock('../src/sync/userId', () => ({ clearUserIdCache: jest.fn() }));
jest.mock('../src/sync/deleteAccount', () => ({ deleteAccountCompletely: mockDeleteAccount }));
jest.mock('../src/sync/supabaseClient', () => ({
  getSupabase: () => ({
    auth: {
      getUser: async () => ({ data: { user: mockUser } }),
      signOut: mockSignOut,
    },
  }),
}));

const SettingsDatenschutzScreen = require('../src/screens/SettingsDatenschutzScreen').default;
const { t } = require('../src/i18n');

function renderScreen() {
  return render(
    <PaperProvider>
      <SettingsDatenschutzScreen />
    </PaperProvider>,
  );
}

async function confirmDeleteAll() {
  fireEvent.press(screen.getByText(t('settingsDatenschutz.deleteAccountButton')));
  fireEvent.press(await screen.findByText(t('settingsDatenschutz.confirmDelete')));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'user-1' };
});

test('scheitert die Server-Löschung, bleiben die lokalen Daten erhalten', async () => {
  mockDeleteAccount.mockRejectedValueOnce(new Error('Account-Löschung fehlgeschlagen (500)'));
  renderScreen();

  await confirmDeleteAll();

  await waitFor(() => expect(mockDeleteAccount).toHaveBeenCalled());
  expect(mockDeleteAllData).not.toHaveBeenCalled();
  expect(mockClearAllThreads).not.toHaveBeenCalled();
});

test('erst Server-Konto löschen, dann lokal', async () => {
  const order: string[] = [];
  mockDeleteAccount.mockImplementationOnce(async () => { order.push('server'); });
  mockDeleteAllData.mockImplementationOnce(async () => { order.push('lokal'); });
  renderScreen();

  await confirmDeleteAll();

  await waitFor(() => expect(mockDeleteAllData).toHaveBeenCalled());
  expect(order).toEqual(['server', 'lokal']);
});

test('ohne Konto wird nur lokal gelöscht', async () => {
  mockUser = null;
  renderScreen();

  await confirmDeleteAll();

  await waitFor(() => expect(mockDeleteAllData).toHaveBeenCalled());
  expect(mockDeleteAccount).not.toHaveBeenCalled();
});
