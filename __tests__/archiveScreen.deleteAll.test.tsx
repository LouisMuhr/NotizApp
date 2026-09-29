/**
 * Archiv → "Alle löschen" (oben rechts): Rückfrage, dann Notizen und archivierte Threads weg.
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { Provider as PaperProvider } from 'react-native-paper';

const mockDeleteAllNotes = jest.fn(async () => {});
const mockDeleteThread = jest.fn();
let mockArchivedNotes: any[] = [];
let mockThreads: any[] = [];

jest.mock('../src/context/NotesContext', () => ({
  useNotes: () => ({
    archivedNotes: mockArchivedNotes,
    restoreNote: jest.fn(),
    deleteNotePermanently: jest.fn(),
    deleteAllArchivedNotes: mockDeleteAllNotes,
  }),
}));
jest.mock('../src/context/ThoughtsContext', () => ({
  useThoughts: () => ({ threads: mockThreads, restoreThread: jest.fn(), deleteThreadPermanently: mockDeleteThread }),
}));
jest.mock('../src/context/LanguageContext', () => {
  const { t, setI18nLocale } = require('../src/i18n');
  setI18nLocale('de');
  return { useLanguage: () => ({ t, locale: 'de' }) };
});
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../src/utils/haptics', () => ({ light: jest.fn(), medium: jest.fn(), tap: jest.fn() }));

const ArchiveScreen = require('../src/screens/ArchiveScreen').default;

const note = (id: string) => ({ id, title: `Notiz ${id}`, content: '', category: 'Allgemein', updatedAt: '2026-09-29T10:00:00.000Z' });
const thread = (id: string, status: string) => ({ id, title: `Thread ${id}`, status, summary: '', noteCount: 1, updatedAt: '2026-09-29T10:00:00.000Z' });

const setup = () => render(<PaperProvider><ArchiveScreen /></PaperProvider>);
const press = async (text: string) => { await act(async () => { fireEvent.press(screen.getByText(text)); }); };

beforeEach(() => {
  jest.clearAllMocks();
  mockArchivedNotes = [note('n1'), note('n2')];
  mockThreads = [thread('t1', 'archived'), thread('t2', 'active')];
});

test('leeres Archiv: kein "Alle löschen"', () => {
  mockArchivedNotes = [];
  mockThreads = [thread('t2', 'active')];
  setup();
  expect(screen.queryByText('Alle löschen')).toBeNull();
});

test('erst Rückfrage, nichts gelöscht bevor bestätigt', async () => {
  setup();
  await press('Alle löschen');
  expect(screen.getByText('Archiv leeren?')).toBeTruthy();
  expect(screen.getByText('Alle 3 Elemente werden unwiderruflich gelöscht.')).toBeTruthy();
  expect(mockDeleteAllNotes).not.toHaveBeenCalled();
  expect(mockDeleteThread).not.toHaveBeenCalled();
});

test('Abbrechen löscht nichts', async () => {
  setup();
  await press('Alle löschen');
  await press('Abbrechen');
  expect(mockDeleteAllNotes).not.toHaveBeenCalled();
  expect(mockDeleteThread).not.toHaveBeenCalled();
});

test('Bestätigen löscht alle archivierten Notizen und nur die archivierten Threads', async () => {
  setup();
  await press('Alle löschen');
  const buttons = screen.getAllByText('Alle löschen');
  await act(async () => { fireEvent.press(buttons[buttons.length - 1]); });
  expect(mockDeleteAllNotes).toHaveBeenCalledTimes(1);
  expect(mockDeleteThread).toHaveBeenCalledTimes(1);
  expect(mockDeleteThread).toHaveBeenCalledWith('t1');
});
