/**
 * Offline-Diktat (Erkennung auf dem Geraet): Titel ↔ Inhalt.
 * 1. "Titel diktieren" waehrend der Aufnahme: der Neustart darf nicht an einem leisen Fehler
 *    ("aborted") scheitern, den die Geraete-Erkennung beim Stoppen meldet.
 * 2. Die Geraete-Erkennung liefert keinen Satzschluss: nach Stille ist der Titel fertig.
 */
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react-native';

jest.setTimeout(20000);

const mockHandlers: Record<string, (e: any) => void> = {};
const mockStart = jest.fn();
const mockStop = jest.fn();
jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    start: (...a: any[]) => mockStart(...a),
    stop: (...a: any[]) => mockStop(...a),
    requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
    supportsOnDeviceRecognition: () => true,
  },
  useSpeechRecognitionEvent: (name: string, handler: (e: any) => void) => {
    mockHandlers[name] = handler;
  },
  AVAudioSessionCategory: { playAndRecord: 'playAndRecord' },
}));
jest.mock('../src/utils/connectivity', () => ({ isProbablyOnline: jest.fn(async () => false) }));
jest.mock('../src/context/NotesContext', () => ({
  useNotes: () => ({ addNote: jest.fn(), tier: 'free', categories: ['Allgemein'] }),
}));
jest.mock('../src/context/LanguageContext', () => {
  const { t, setI18nLocale } = require('../src/i18n');
  setI18nLocale('de');
  return { useLanguage: () => ({ t, locale: 'de' }) };
});
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../src/utils/haptics', () => ({ medium: jest.fn(), success: jest.fn(), tap: jest.fn() }));
jest.mock('../src/sync/supabaseClient', () => ({ isSyncConfigured: () => false, getSupabase: () => null }));

const VoiceCaptureSheet = require('../src/components/VoiceCaptureSheet').default;

const lastStartedOnDevice = () => (mockStart.mock.calls.at(-1)?.[0] as any)?.requiresOnDeviceRecognition;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

async function startRecording() {
  render(<VoiceCaptureSheet visible onClose={jest.fn()} />);
  await act(async () => { fireEvent.press(screen.getByTestId('voice-mic-button')); });
  expect(lastStartedOnDevice()).toBe(true);
  act(() => mockHandlers.start({}));
}

test('"Titel diktieren" waehrend der Aufnahme: leiser Fehler beim Stoppen verhindert den Neustart nicht', async () => {
  await startRecording();
  mockStart.mockClear();

  fireEvent.press(screen.getByText('Titel diktieren'));
  expect(mockStop).toHaveBeenCalled();
  // Geraete-Erkennung: erst Fehler "aborted", dann 'end'
  act(() => mockHandlers.error({ error: 'aborted', message: '' }));
  act(() => mockHandlers.end({}));
  await act(async () => { jest.advanceTimersByTime(400); });

  expect(mockStart).toHaveBeenCalledTimes(1);
  expect(lastStartedOnDevice()).toBe(true);
});

test('Titel: nach Stille beendet die App den Titel und diktiert den Inhalt weiter', async () => {
  await startRecording();
  // Titel-Modus ueber den Knopf
  fireEvent.press(screen.getByText('Titel diktieren'));
  act(() => mockHandlers.end({}));
  await act(async () => { jest.advanceTimersByTime(400); });
  act(() => mockHandlers.start({}));
  mockStart.mockClear();
  mockStop.mockClear();

  act(() => mockHandlers.result({ isFinal: false, results: [{ transcript: 'Wochenendplan' }] }));
  expect(mockStop).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(2000); }); // Stille
  expect(mockStop).toHaveBeenCalledTimes(1);

  // Es kam kein finales Ergebnis, nur 'end': der Zwischenstand wird als Titel uebernommen
  act(() => mockHandlers.end({}));
  await act(async () => { jest.advanceTimersByTime(400); });
  expect(screen.getByText('Wochenendplan')).toBeTruthy();
  expect(mockStart).toHaveBeenCalledTimes(1); // Inhalt laeuft ohne weiteren Tipp
});
