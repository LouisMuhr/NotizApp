/**
 * Sprach-Sheet: Pro-Diktate strukturiert Claude beim Speichern. Schlaegt das
 * fehl (Limit, Netz), wird das Diktat trotzdem gespeichert — nie verworfen.
 * Ohne Pro, ohne Diktat oder mit ausgeschaltetem Schalter gibt es keinen KI-Call.
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react-native';

// Das erste Rendern des Sheets laedt viele Module (Kaltstart ~1–6 s je nach Last).
jest.setTimeout(20000);

const mockHandlers: Record<string, (e: any) => void> = {};
jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    start: jest.fn(),
    stop: jest.fn(),
    requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  },
  useSpeechRecognitionEvent: (name: string, handler: (e: any) => void) => {
    mockHandlers[name] = handler;
  },
  AVAudioSessionCategory: { playAndRecord: 'playAndRecord' },
}));
jest.mock('../src/context/NotesContext', () => ({ useNotes: jest.fn() }));
jest.mock('../src/context/LanguageContext', () => {
  const { t, setI18nLocale } = require('../src/i18n');
  setI18nLocale('de');
  return { useLanguage: () => ({ t, locale: 'de' }) };
});
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../src/utils/haptics', () => ({ medium: jest.fn(), success: jest.fn(), tap: jest.fn() }));
jest.mock('../src/sync/parseNote', () => ({ parseNoteRemote: jest.fn() }));
jest.mock('../src/sync/accountState', () => ({ resolveAccountState: jest.fn() }));
jest.mock('../src/sync/pendingParse', () => ({
  ...jest.requireActual('../src/sync/pendingParse'),
  enqueuePendingParse: jest.fn(async () => {}),
}));
jest.mock('../src/sync/supabaseClient', () => ({ isSyncConfigured: () => true, getSupabase: () => null }));
jest.mock('../src/utils/voiceAiPref', () => ({ isVoiceAiEnabled: jest.fn(() => true) }));

const { useNotes } = require('../src/context/NotesContext') as { useNotes: jest.Mock };
const { parseNoteRemote } = require('../src/sync/parseNote') as { parseNoteRemote: jest.Mock };
const { resolveAccountState } = require('../src/sync/accountState') as { resolveAccountState: jest.Mock };
const { enqueuePendingParse } = require('../src/sync/pendingParse') as { enqueuePendingParse: jest.Mock };
const { isVoiceAiEnabled } = require('../src/utils/voiceAiPref') as { isVoiceAiEnabled: jest.Mock };
const VoiceCaptureSheet = require('../src/components/VoiceCaptureSheet').default;

const addNote = jest.fn(async () => ({ id: 'n1', updatedAt: '2026-10-01T10:00:00.000Z' }));
const onClose = jest.fn();
const DICTATION = 'Einkaufen Milch und Eier morgen um 18 Uhr erinnern';

beforeEach(() => {
  jest.clearAllMocks();
  useNotes.mockReturnValue({ addNote, tier: 'pro', categories: ['Allgemein', 'Einkauf'] });
  resolveAccountState.mockResolvedValue({ state: 'secured', userId: 'u1', email: 'a@b.c' });
  isVoiceAiEnabled.mockReturnValue(true);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

function dictate(text: string) {
  act(() => {
    mockHandlers.result({ isFinal: true, results: [{ transcript: text }] });
  });
}

async function save() {
  fireEvent.press(screen.getByText('Speichern'));
  await waitFor(() => expect(addNote).toHaveBeenCalled());
}

test('Pro + Diktat: strukturierte Notiz wird gespeichert', async () => {
  parseNoteRemote.mockResolvedValue({
    result: {
      title: 'Einkauf', content: '', checklist: ['Milch', 'Eier'], category: 'Einkauf',
      reminder: { at: '2099-01-01T18:00', recurrence: 'once', weekday: null, dayOfMonth: null },
    },
  });
  render(<VoiceCaptureSheet visible onClose={onClose} />);
  dictate(DICTATION);
  await save();

  expect(parseNoteRemote).toHaveBeenCalledWith(
    expect.objectContaining({ transcript: DICTATION, title: '', categories: ['Allgemein', 'Einkauf'] }),
  );
  const note = (addNote.mock.calls[0] as any[])[0];
  expect(note.title).toBe('Einkauf');
  expect(note.category).toBe('Einkauf');
  expect(note.checklist.map((c: any) => c.text)).toEqual(['Milch', 'Eier']);
  expect(note.reminderAt).not.toBeNull();
  expect(note.feedsThreads).toBe(false);
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(screen.queryByText('Als normale Notiz gespeichert')).toBeNull();
  expect(onClose).toHaveBeenCalled();
});

const LIMIT_MESSAGE =
  'Das Tageslimit für KI-Sprachnotizen ist erreicht. Deine Notiz ist gespeichert, Claude überarbeitet sie automatisch, sobald das Limit zurückgesetzt ist.';
const QUEUED_MESSAGE =
  'Deine Notiz ist gespeichert. Sobald du wieder online bist, ergänzt Claude Checkliste, Kategorie und Erinnerung automatisch.';

test.each([
  ['Bridge nicht erreichbar', () => parseNoteRemote.mockResolvedValue({ error: 'unavailable' })],
  ['Kontostatus nicht lesbar (offline)', () => resolveAccountState.mockRejectedValue(new Error('offline'))],
])('%s: Diktat gespeichert und KI-Strukturierung vorgemerkt', async (_label, setup) => {
  setup();
  render(<VoiceCaptureSheet visible onClose={onClose} />);
  dictate(DICTATION);
  await save();

  const note = (addNote.mock.calls[0] as any[])[0];
  expect(note.content).toBe(DICTATION);
  expect(note.source).toBe('voice');
  await waitFor(() => expect(enqueuePendingParse).toHaveBeenCalledTimes(1));
  expect(enqueuePendingParse).toHaveBeenCalledWith(
    expect.objectContaining({
      noteId: 'n1', transcript: DICTATION, title: '', locale: 'de',
      noteUpdatedAt: '2026-10-01T10:00:00.000Z',
    }),
  );
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(screen.getByText(QUEUED_MESSAGE)).toBeTruthy();
});

const SWITCH_LABEL = 'KI darf diese Notiz überarbeiten';

// Dialog-Buttons: der Dialog liegt nach dem Sheet im Baum, also der letzte Treffer.
function pressDialogButton(label: string) {
  fireEvent.press(screen.getAllByText(label).at(-1)!);
}

test('Pro-Schalter pro Aufnahme: Standard an, Ausschalten fragt nach, OK → kein KI-Call, nichts vorgemerkt', async () => {
  parseNoteRemote.mockResolvedValue({ error: 'unavailable' });
  render(<VoiceCaptureSheet visible onClose={onClose} />);
  const sw = screen.getByLabelText(SWITCH_LABEL);
  expect(sw.props.value).toBe(true);

  fireEvent(sw, 'valueChange', false);
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(screen.getByText('KI-Überarbeitung ausschalten?')).toBeTruthy();
  expect(screen.getByLabelText(SWITCH_LABEL).props.value).toBe(true); // erst nach OK aus
  pressDialogButton('OK');
  expect(screen.getByLabelText(SWITCH_LABEL).props.value).toBe(false);

  dictate(DICTATION);
  await save();
  expect(parseNoteRemote).not.toHaveBeenCalled();
  expect(enqueuePendingParse).not.toHaveBeenCalled();
  expect((addNote.mock.calls[0] as any[])[0].content).toBe(DICTATION);
});

test('Pro-Schalter: Abbrechen im Hinweis laesst die KI an', async () => {
  parseNoteRemote.mockResolvedValue({
    result: { title: 'T', content: DICTATION, checklist: [], category: 'Allgemein', reminder: null },
  });
  render(<VoiceCaptureSheet visible onClose={onClose} />);
  fireEvent(screen.getByLabelText(SWITCH_LABEL), 'valueChange', false);
  pressDialogButton('Abbrechen');
  expect(screen.getByLabelText(SWITCH_LABEL).props.value).toBe(true);

  dictate(DICTATION);
  await save();
  expect(parseNoteRemote).toHaveBeenCalledTimes(1);
});

test('Pro-Schalter ist ohne Pro nicht sichtbar', () => {
  useNotes.mockReturnValue({ addNote, tier: 'basic', categories: ['Allgemein'] });
  render(<VoiceCaptureSheet visible onClose={onClose} />);
  expect(screen.queryByLabelText(SWITCH_LABEL)).toBeNull();
});

test.each([
  ['Basic', () => useNotes.mockReturnValue({ addNote, tier: 'basic', categories: ['Allgemein'] })],
  ['Schalter aus', () => isVoiceAiEnabled.mockReturnValue(false)],
  ['Konto unbestaetigt', () => resolveAccountState.mockResolvedValue({ state: 'pending-confirmation', userId: null, email: 'a@b.c' })],
])('%s: kein KI-Call, normale Notiz', async (_label, setup) => {
  setup();
  render(<VoiceCaptureSheet visible onClose={onClose} />);
  dictate(DICTATION);
  await save();

  expect(parseNoteRemote).not.toHaveBeenCalled();
  expect((addNote.mock.calls[0] as any[])[0].content).toBe(DICTATION);
});

test('Getippte Notiz geht nie an die KI', async () => {
  render(<VoiceCaptureSheet visible initialMode="text" onClose={onClose} />);
  fireEvent.changeText(screen.getByPlaceholderText('Notiz eingeben…'), 'Getippter Text');
  await save();

  expect(parseNoteRemote).not.toHaveBeenCalled();
  expect((addNote.mock.calls[0] as any[])[0]).toEqual(expect.objectContaining({ content: 'Getippter Text', source: 'app' }));
});

test('Titel-Knopf: diktierter Titel landet im Titel, nicht im Inhalt', async () => {
  useNotes.mockReturnValue({ addNote, tier: 'free', categories: ['Allgemein'] });
  render(<VoiceCaptureSheet visible onClose={onClose} />);

  fireEvent.press(screen.getByText('Titel diktieren'));
  await waitFor(() => expect(screen.getByText('Titel wird diktiert')).toBeTruthy());
  dictate('Wochenendplan');
  act(() => mockHandlers.end({}));   // Sitzung endet, Neustart ins Inhaltsziel
  dictate('Samstag wandern');
  await save();

  expect((addNote.mock.calls[0] as any[])[0]).toEqual(
    expect.objectContaining({ title: 'Wochenendplan', content: 'Samstag wandern' }),
  );
});

// Tageslimit: Notiz wird roh gespeichert UND vorgemerkt, Claude holt es nach dem Reset nach.
test('Tageslimit erreicht: Diktat gespeichert, vorgemerkt, Hinweis nennt die automatische Nachbearbeitung', async () => {
  parseNoteRemote.mockResolvedValue({ error: 'limit_reached' });
  render(<VoiceCaptureSheet visible onClose={onClose} />);
  dictate(DICTATION);
  await save();

  const note = (addNote.mock.calls[0] as any[])[0];
  expect(note.content).toBe(DICTATION);
  expect(note.source).toBe('voice');
  await waitFor(() => expect(enqueuePendingParse).toHaveBeenCalledTimes(1));
  expect(enqueuePendingParse).toHaveBeenCalledWith(expect.objectContaining({ noteId: 'n1', transcript: DICTATION }));
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(screen.getByText('Als normale Notiz gespeichert')).toBeTruthy();
  expect(screen.getByText(LIMIT_MESSAGE)).toBeTruthy();
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('OK'));
  expect(onClose).toHaveBeenCalled();
});

test('Zu langes Diktat (> 4000 Zeichen): kein KI-Call, nicht vorgemerkt, Hinweis', async () => {
  render(<VoiceCaptureSheet visible onClose={onClose} />);
  dictate('a '.repeat(2001));
  await save();

  expect(parseNoteRemote).not.toHaveBeenCalled();
  expect(enqueuePendingParse).not.toHaveBeenCalled();
  expect(await screen.findByText('Dieses Diktat ist zu lang für die KI-Überarbeitung und wurde als normale Notiz gespeichert.')).toBeTruthy();
});
