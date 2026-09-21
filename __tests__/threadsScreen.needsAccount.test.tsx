/**
 * Synthese-Button ohne bestaetigtes Konto.
 *
 * Die Synthese laeuft serverseitig und braucht ein Konto. Der Button wird
 * deshalb NICHT versteckt (sonst waere die Funktion unsichtbar), sondern
 * ausgegraut mit dem Grund beschriftet. Ein Tap fuehrt zum Konto-Screen statt
 * in die Fehlermeldung "nicht angemeldet".
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../src/context/NotesContext', () => ({ useNotes: jest.fn() }));
jest.mock('../src/context/ThoughtsContext', () => ({
  useThoughts: () => ({ threads: [], loading: false, archiveThread: jest.fn(), pinThread: jest.fn(), unpinThread: jest.fn() }),
}));
jest.mock('../src/context/LanguageContext', () => {
  const { t, setI18nLocale } = require('../src/i18n');
  setI18nLocale('de');
  return { useLanguage: () => ({ t, locale: 'de' }) };
});
jest.mock('../src/sync/supabaseClient', () => ({ getSupabase: () => null, isSyncConfigured: () => true }));
jest.mock('../src/sync/accountState', () => ({
  resolveAccountState: jest.fn(),
}));
// Banner sind hier nicht Testgegenstand und wuerden eigene Async-Ladepfade
// mitbringen (AsyncStorage, Konto-Zustand).
jest.mock('../src/components/UnsecuredBanner', () => () => null);
jest.mock('../src/components/ProBanner', () => () => null);
jest.mock('../src/utils/haptics', () => ({ light: jest.fn(), medium: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-native-gesture-handler', () => ({ Swipeable: ({ children }: any) => children }));

const { useNotes } = require('../src/context/NotesContext') as { useNotes: jest.Mock };
const accountState = require('../src/sync/accountState') as { resolveAccountState: jest.Mock };
const ThreadsScreen = require('../src/screens/ThreadsScreen').default;
const { t } = require('../src/i18n');

beforeEach(() => {
  jest.clearAllMocks();
  useNotes.mockReturnValue({
    tier: 'free',
    nextAllowedAt: null,
    refreshSubscription: jest.fn(),
    setServerNextAllowedAt: jest.fn(),
  });
});

test('ohne Konto bleibt der Button sichtbar und nennt den Grund', async () => {
  accountState.resolveAccountState.mockResolvedValue({ state: 'local', userId: null, email: null });

  render(<ThreadsScreen navigation={{ navigate: jest.fn() }} />);

  // Button ist da (nicht versteckt) und erklaert, warum er gesperrt ist.
  expect(screen.getByText(t('threads.synthesize'))).toBeTruthy();
  await waitFor(() => expect(screen.getByText(t('threads.needsAccount'))).toBeTruthy());
});

test('ohne Konto fuehrt ein Tap zum Konto-Screen, nicht in die Synthese', async () => {
  accountState.resolveAccountState.mockResolvedValue({ state: 'local', userId: null, email: null });
  const navigate = jest.fn();

  render(<ThreadsScreen navigation={{ navigate }} />);
  await waitFor(() => expect(screen.getByText(t('threads.needsAccount'))).toBeTruthy());

  fireEvent.press(screen.getByText(t('threads.synthesize')));

  expect(navigate).toHaveBeenCalledWith('SettingsKonto');
});

test('mit bestaetigtem Konto ist der Button normal beschriftet', async () => {
  accountState.resolveAccountState.mockResolvedValue({ state: 'secured', userId: 'u1', email: 'a@b.de' });

  render(<ThreadsScreen navigation={{ navigate: jest.fn() }} />);

  await waitFor(() => expect(screen.queryByText(t('threads.needsAccount'))).toBeNull());
  expect(screen.getByText(t('threads.synthesize'))).toBeTruthy();
});
