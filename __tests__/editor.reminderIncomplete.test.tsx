/**
 * Startzustand: keine Erinnerungsart gewählt (= keine Erinnerung). Ist eine Art gewählt
 * (auch "Einmalig"), aber kein Zeitpunkt: "Speichern" darf nicht still eine Notiz ohne
 * Erinnerung anlegen. Es wird nicht gespeichert, der Nutzer bekommt einen Toast.
 *
 * Geprüft wird das Verhalten (addNote/goBack), nicht der Toast-Text: <Toast> bleibt
 * immer gemountet und blendet sich per Opacity aus, der Text steht also auch unsichtbar im Baum.
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { Provider as PaperProvider } from 'react-native-paper';

const mockAddNote = jest.fn(async (n: any) => ({ ...n, id: 'new' }));
jest.mock('../src/context/NotesContext', () => ({
  useNotes: () => ({
    notes: [], categories: ['Allgemein'], addNote: mockAddNote, updateNote: jest.fn(), addCategory: jest.fn(),
  }),
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
jest.mock('@react-native-community/datetimepicker', () => () => null);
jest.mock('../src/utils/haptics', () => ({ tap: jest.fn(), light: jest.fn(), medium: jest.fn(), success: jest.fn() }));

const EditorScreen = require('../src/screens/EditorScreen').default;

const navigation = { setOptions: jest.fn(), goBack: jest.fn(), canGoBack: jest.fn(() => true), addListener: jest.fn(() => () => {}), dispatch: jest.fn() };

/** Mit Titel, damit ein gültiges Speichern tatsächlich addNote() aufriefe. */
function setup() {
  render(<PaperProvider><EditorScreen navigation={navigation} route={{ params: {} }} /></PaperProvider>);
  fireEvent.changeText(screen.getAllByDisplayValue('')[0] /* Titel-Feld ist das erste */, 'Zahnarzt');
}

beforeEach(() => {
  jest.useFakeTimers();
  mockAddNote.mockClear();
  navigation.goBack.mockClear();
});
afterEach(() => jest.useRealTimers());

const press = async (text: string) => { await act(async () => { fireEvent.press(screen.getByText(text)); }); };

test('Täglich ohne Uhrzeit → nicht gespeichert, Editor bleibt offen', async () => {
  setup();
  await press('Täglich');
  await press('Speichern');
  expect(mockAddNote).not.toHaveBeenCalled();
  act(() => { jest.advanceTimersByTime(1000); });
  expect(navigation.goBack).not.toHaveBeenCalled();
});

test('Einmalig gewählt, aber keine Zeit → nicht gespeichert', async () => {
  setup();
  await press('Einmalig');
  await press('Speichern');
  expect(mockAddNote).not.toHaveBeenCalled();
});

test('Startzustand: nichts gewählt → keine Zeit-Schaltfläche, Speichern läuft normal', async () => {
  setup();
  expect(screen.queryByText('Erinnerung setzen')).toBeNull();
  await press('Speichern');
  expect(mockAddNote).toHaveBeenCalledTimes(1);
  expect(mockAddNote.mock.calls[0][0]).toMatchObject({ reminderAt: null, reminderRecurrence: 'once' });
});

test('Art gewählt → Zeit-Schaltfläche erscheint', async () => {
  setup();
  await press('Einmalig');
  expect(screen.getByText('Erinnerung setzen')).toBeTruthy();
});

// Regression: "The action 'GO_BACK' was not handled by any navigator"
test('Doppeltipp auf Speichern navigiert nur einmal zurück', async () => {
  setup();
  await press('Speichern');
  await press('Speichern');
  act(() => { jest.advanceTimersByTime(1000); });
  expect(mockAddNote).toHaveBeenCalledTimes(1);
  expect(navigation.goBack).toHaveBeenCalledTimes(1);
});

test('kein goBack, wenn es nichts gibt, wohin man zurück kann', async () => {
  navigation.canGoBack.mockReturnValueOnce(false);
  setup();
  await press('Speichern');
  act(() => { jest.advanceTimersByTime(1000); });
  expect(navigation.goBack).not.toHaveBeenCalled();
});

test('Editor wird im 800-ms-Fenster geschlossen → kein spätes goBack', async () => {
  const { unmount } = render(<PaperProvider><EditorScreen navigation={navigation} route={{ params: {} }} /></PaperProvider>);
  fireEvent.changeText(screen.getAllByDisplayValue('')[0], 'Zahnarzt');
  await press('Speichern');
  unmount();
  act(() => { jest.advanceTimersByTime(1000); });
  expect(navigation.goBack).not.toHaveBeenCalled();
});

test('Gewählte Art erneut antippen wählt sie ab → Sperre weg, Speichern läuft', async () => {
  setup();
  await press('Täglich');
  await press('Täglich');
  expect(screen.queryByText('Erinnerung setzen')).toBeNull();
  await press('Speichern');
  expect(mockAddNote).toHaveBeenCalledTimes(1);
});
