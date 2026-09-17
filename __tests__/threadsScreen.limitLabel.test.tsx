/**
 * E6 (UI): Pro-User um 23:30 UTC sieht auf dem Synthese-Button "In 1 Tag verfuegbar",
 * obwohl der Reset in 30 Minuten ist. Entscheidung 13: Uhrzeit anzeigen.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('../src/context/NotesContext', () => ({ useNotes: jest.fn() }));
jest.mock('../src/context/ThoughtsContext', () => ({
  useThoughts: () => ({ threads: [], loading: false, archiveThread: jest.fn(), pinThread: jest.fn(), unpinThread: jest.fn() }),
}));
jest.mock('../src/context/LanguageContext', () => {
  const { t } = require('../src/i18n');
  return { useLanguage: () => ({ t, locale: 'de' }) };
});
jest.mock('../src/sync/supabaseClient', () => ({ getSupabase: () => null }));
jest.mock('../src/utils/haptics', () => ({ light: jest.fn(), medium: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-native-gesture-handler', () => ({ Swipeable: ({ children }: any) => children }));

const { useNotes } = require('../src/context/NotesContext') as { useNotes: jest.Mock };
const ThreadsScreen = require('../src/screens/ThreadsScreen').default;

afterEach(() => jest.useRealTimers());

test('E6 (UI): 30 Minuten vor dem Pro-Reset zeigt der Button keine "1 Tag"-Angabe', () => {
  jest.useFakeTimers({ now: Date.parse('2026-09-16T23:30:00Z') });
  useNotes.mockReturnValue({
    tier: 'pro',
    nextAllowedAt: new Date('2026-09-17T00:00:00Z'),
    refreshSubscription: jest.fn(),
  });

  render(<ThreadsScreen navigation={{ navigate: jest.fn() }} />);

  // i18n faellt im Test-Env je nach Geraete-Locale auf DE oder EN zurueck — beide abdecken.
  const label = screen.getByText(/verfügbar|Available/).props.children as string;
  expect(label).not.toMatch(/1 Tag|1 day/);
  expect(label).toMatch(/\d{1,2}:\d{2}|Min/); // Uhrzeit oder Minuten
});
