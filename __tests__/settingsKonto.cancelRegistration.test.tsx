/**
 * Registrierung abbrechen loescht den unbestaetigten Supabase-User.
 *
 * Ein blosses Abmelden liess den Eintrag mit `email_confirmed_at = null`
 * stehen. Die Adresse war damit belegt: ein erneutes `signUp()` liefert aus
 * Enumeration-Schutz keinen Fehler, faellt aber ins Mail-Rate-Limit — der
 * Nutzer bekam nie wieder eine Bestaetigungsmail, waehrend die App den Versand
 * behauptete. Deshalb gilt: geloescht oder gar nichts.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
// Portal-Host fuer den Dialog (in der App liefert ihn App.tsx).
import { Provider as PaperProvider } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockDeleteAccount = jest.fn(async () => {});
const mockGetSession = jest.fn();
const mockSignOut = jest.fn(async () => ({ error: null }));
const mockDetachNotes = jest.fn();
const mockDetachThreads = jest.fn(async () => {});

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
jest.mock('../src/sync/deleteAccount', () => ({ deleteAccountCompletely: mockDeleteAccount }));
jest.mock('../src/sync/supabaseClient', () => ({
  getSupabase: () => ({
    auth: {
      // Unbestaetigte Registrierung MIT Session → `pending-confirmation`.
      getUser: async () => ({
        data: { user: { id: 'pending-user', email: 'louis@example.com', email_confirmed_at: null } },
      }),
      getSession: mockGetSession,
      signOut: mockSignOut,
      resend: jest.fn(async () => ({ error: null })),
    },
  }),
}));

const SettingsKontoScreen = require('../src/screens/SettingsKontoScreen').default;
const { t } = require('../src/i18n');

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  await AsyncStorage.setItem('@notizapp_pending_email', 'louis@example.com');
  mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
});

/**
 * Der Abbruch-Button oeffnet nur den Dialog; erst dessen Aktion loescht. Beides
 * ist echtes UI (Paper-Dialog, kein `Alert.alert`) und wird auch so gedrueckt.
 */
async function openCancelDialog() {
  render(<PaperProvider><SettingsKontoScreen /></PaperProvider>);
  await screen.findByText(t('settingsKonto.pendingTitle'));
  fireEvent.press(screen.getByText(t('settingsKonto.cancelRegistrationButton')));
  await screen.findByText(t('settingsKonto.cancelRegistrationConfirmBody'));
}

async function answerDialog(choice: 'confirm' | 'cancel') {
  const label = choice === 'confirm'
    ? t('settingsKonto.cancelRegistrationConfirmOk')
    : t('settingsKonto.cancelRegistrationConfirmCancel');
  fireEvent.press(screen.getByText(label));
}

test('bestaetigter Abbruch loescht den User und geht nach `local`', async () => {
  await openCancelDialog();
  await answerDialog('confirm');

  await waitFor(() => expect(mockDeleteAccount).toHaveBeenCalled());
  await waitFor(() => expect(mockDetachNotes).toHaveBeenCalled());
  expect(mockDetachThreads).toHaveBeenCalled();
  // Der Merker muss weg sein, sonst startet die App wieder als pending.
  await waitFor(async () => {
    expect(await AsyncStorage.getItem('@notizapp_pending_email')).toBeNull();
  });
  // Zustand `local`: die Registrierungs-/Anmelde-Tabs sind wieder da.
  await waitFor(() => expect(screen.queryByText(t('settingsKonto.tabSecure'))).not.toBeNull());
});

test('abgelehnter Dialog aendert nichts', async () => {
  await openCancelDialog();
  await answerDialog('cancel');

  await new Promise((r) => setTimeout(r, 50));
  expect(mockDeleteAccount).not.toHaveBeenCalled();
  expect(mockDetachNotes).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('@notizapp_pending_email')).toBe('louis@example.com');
  expect(screen.queryByText(t('settingsKonto.tabSecure'))).toBeNull();
});

test('der Button allein loescht noch nichts — erst die Bestaetigung', async () => {
  await openCancelDialog();

  await new Promise((r) => setTimeout(r, 50));
  expect(mockDeleteAccount).not.toHaveBeenCalled();
  expect(mockDetachNotes).not.toHaveBeenCalled();
});

test('scheiternde Loeschung laesst den Zustand pending — keine Waise erzeugen', async () => {
  mockDeleteAccount.mockRejectedValueOnce(new Error('offline'));
  await openCancelDialog();
  await answerDialog('confirm');

  await screen.findByText(t('settingsKonto.toastCancelFailed'));
  expect(mockDetachNotes).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('@notizapp_pending_email')).toBe('louis@example.com');
  // Weiterhin pending: die Code-Eingabe steht noch.
  expect(screen.queryByText(t('settingsKonto.tabSecure'))).toBeNull();
});

test('ohne Session wird nur lokal abgeraeumt, mit Hinweis auf die alte Mail', async () => {
  // signUp() ohne Session: es gibt kein Token, mit dem sich der User selbst
  // loeschen koennte — ein Loeschpfad ohne Auth kommt nicht in Frage.
  mockGetSession.mockResolvedValue({ data: { session: null } });
  await openCancelDialog();
  await answerDialog('confirm');

  await screen.findByText(t('settingsKonto.toastCancelNoSession'));
  expect(mockDeleteAccount).not.toHaveBeenCalled();
  await waitFor(async () => {
    expect(await AsyncStorage.getItem('@notizapp_pending_email')).toBeNull();
  });
  await waitFor(() => expect(screen.queryByText(t('settingsKonto.tabSecure'))).not.toBeNull());
});
