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
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
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

/** Alert ist in jest-expo kein echter Dialog — die Auswahl wird direkt gedrueckt. */
function answerAlert(choice: 'confirm' | 'cancel') {
  jest.spyOn(Alert, 'alert').mockImplementation(((_title: string, _msg: string, buttons: any[]) => {
    const btn = choice === 'confirm'
      ? buttons.find((b) => b.style === 'destructive')
      : buttons.find((b) => b.style === 'cancel');
    btn?.onPress?.();
  }) as any);
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  await AsyncStorage.setItem('@notizapp_pending_email', 'louis@example.com');
  mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function pressCancel() {
  render(<SettingsKontoScreen />);
  await screen.findByText(t('settingsKonto.pendingTitle'));
  fireEvent.press(screen.getByText(t('settingsKonto.cancelRegistrationButton')));
}

test('bestaetigter Abbruch loescht den User und geht nach `local`', async () => {
  answerAlert('confirm');
  await pressCancel();

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

test('abgelehnter Alert aendert nichts', async () => {
  answerAlert('cancel');
  await pressCancel();

  await new Promise((r) => setTimeout(r, 50));
  expect(mockDeleteAccount).not.toHaveBeenCalled();
  expect(mockDetachNotes).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('@notizapp_pending_email')).toBe('louis@example.com');
  expect(screen.queryByText(t('settingsKonto.tabSecure'))).toBeNull();
});

test('scheiternde Loeschung laesst den Zustand pending — keine Waise erzeugen', async () => {
  answerAlert('confirm');
  mockDeleteAccount.mockRejectedValueOnce(new Error('offline'));
  await pressCancel();

  await screen.findByText(t('settingsKonto.toastCancelFailed'));
  expect(mockDetachNotes).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('@notizapp_pending_email')).toBe('louis@example.com');
  // Weiterhin pending: die Code-Eingabe steht noch.
  expect(screen.queryByText(t('settingsKonto.tabSecure'))).toBeNull();
});

test('ohne Session wird nur lokal abgeraeumt, mit Hinweis auf die alte Mail', async () => {
  answerAlert('confirm');
  // signUp() ohne Session: es gibt kein Token, mit dem sich der User selbst
  // loeschen koennte — ein Loeschpfad ohne Auth kommt nicht in Frage.
  mockGetSession.mockResolvedValue({ data: { session: null } });
  await pressCancel();

  await screen.findByText(t('settingsKonto.toastCancelNoSession'));
  expect(mockDeleteAccount).not.toHaveBeenCalled();
  await waitFor(async () => {
    expect(await AsyncStorage.getItem('@notizapp_pending_email')).toBeNull();
  });
  await waitFor(() => expect(screen.queryByText(t('settingsKonto.tabSecure'))).not.toBeNull());
});
