/**
 * Regression: bei einem Limit, das erst an einem spaeteren Tag endet, war das
 * Button-Label ein einziger langer String ("Ab Do., 23. Sep., 15:27 verfuegbar")
 * und lief in einer Zeile ueber. Erwartung: zwei Textknoten ("Verfügbar ab" +
 * Datum), damit der Button umbrechen kann.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('../src/context/NotesContext', () => ({ useNotes: jest.fn() }));
jest.mock('../src/context/ThoughtsContext', () => ({
  useThoughts: () => ({ threads: [], loading: false, archiveThread: jest.fn(), pinThread: jest.fn(), unpinThread: jest.fn() }),
}));
jest.mock('../src/context/LanguageContext', () => {
  const { t, setI18nLocale } = require('../src/i18n');
  setI18nLocale('de');
  return { useLanguage: () => ({ t, locale: 'de' }) };
});
jest.mock('../src/sync/supabaseClient', () => ({ getSupabase: () => null, isSyncConfigured: () => false }));
jest.mock('../src/utils/haptics', () => ({ light: jest.fn(), medium: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-native-gesture-handler', () => ({ Swipeable: ({ children }: any) => children }));

const { useNotes } = require('../src/context/NotesContext') as { useNotes: jest.Mock };
const ThreadsScreen = require('../src/screens/ThreadsScreen').default;

afterEach(() => jest.useRealTimers());

test('Limit an einem spaeteren Tag: Label steht in zwei Zeilen, nicht in einer', () => {
  jest.useFakeTimers({ now: Date.parse('2026-09-16T12:00:00Z') });
  useNotes.mockReturnValue({
    tier: 'free',
    nextAllowedAt: new Date('2026-09-23T13:27:00Z'),
    refreshSubscription: jest.fn(),
  });

  render(<ThreadsScreen navigation={{ navigate: jest.fn() }} />);

  // Zeile 1: nur der Einleitungstext, ohne Datum
  const lead = screen.getByText('Verfügbar ab');
  expect(lead).toBeTruthy();

  // Zeile 2: das Datum mit Uhrzeit, als eigener Textknoten
  const detail = screen.getByText(/\d{1,2}:\d{2}/);
  expect(detail).not.toBe(lead);
  expect(detail.props.children).toMatch(/Sep/);
});
