import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  enqueuePendingParse, loadPendingParses, removePendingParse, clearPendingParses,
  recordFailedAttempt, decideAfterError, MAX_ATTEMPTS,
  type PendingParse,
} from '../src/sync/pendingParse';

const item = (noteId: string): PendingParse => ({
  noteId, title: '', transcript: 'Milch kaufen', locale: 'de',
  noteUpdatedAt: '2026-10-01T10:00:00.000Z', recordedAt: '2026-10-01T10:00:00.000Z',
});

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('Eintraege werden gemerkt und pro Notiz nur einmal gehalten', async () => {
  await enqueuePendingParse(item('a'));
  await enqueuePendingParse(item('b'));
  await enqueuePendingParse({ ...item('a'), transcript: 'neu' });
  const items = await loadPendingParses();
  expect(items.map((i) => i.noteId)).toEqual(['b', 'a']);
  expect(items.find((i) => i.noteId === 'a')?.transcript).toBe('neu');
});

test('entfernen und leeren', async () => {
  await enqueuePendingParse(item('a'));
  await enqueuePendingParse(item('b'));
  await removePendingParse('a');
  expect((await loadPendingParses()).map((i) => i.noteId)).toEqual(['b']);
  await clearPendingParses();
  expect(await loadPendingParses()).toEqual([]);
  expect(await AsyncStorage.getItem('@notizapp_pending_parse')).toBeNull();
});

test('kaputter Speicherinhalt wird ignoriert', async () => {
  await AsyncStorage.setItem('@notizapp_pending_parse', '{kaputt');
  expect(await loadPendingParses()).toEqual([]);
});

describe('sameTimestamp', () => {
  const { sameTimestamp } = require('../src/sync/pendingParse');
  test('gleicher Zeitpunkt in Postgres-Schreibweise nach dem Sync-Roundtrip', () => {
    expect(sameTimestamp('2026-10-01T09:23:00.123Z', '2026-10-01T09:23:00.123+00:00')).toBe(true);
  });
  test('anderer Zeitpunkt (Nutzer hat bearbeitet)', () => {
    expect(sameTimestamp('2026-10-01T09:23:00.124Z', '2026-10-01T09:23:00.123Z')).toBe(false);
  });
});

test('Fehlversuche werden pro Eintrag gezaehlt', async () => {
  await enqueuePendingParse(item('a'));
  await enqueuePendingParse(item('b'));
  expect(await recordFailedAttempt('a')).toBe(1);
  expect(await recordFailedAttempt('a')).toBe(2);
  const items = await loadPendingParses();
  expect(items.find((i) => i.noteId === 'a')?.attempts).toBe(2);
  expect(items.find((i) => i.noteId === 'b')?.attempts).toBeUndefined();
});

describe('decideAfterError: was passiert mit dem Rest der Schlange?', () => {
  test('kein Pro: Eintrag verwerfen, weiter', () => {
    expect(decideAfterError('plan_required', true, 0)).toBe('remove');
  });
  test('Tageslimit: Runde beenden, Eintrag bleibt', () => {
    expect(decideAfterError('limit_reached', true, 0)).toBe('abort');
  });
  test('Netz weg: Runde beenden', () => {
    expect(decideAfterError('unavailable', false, 0)).toBe('abort');
  });
  test('Netz da, Eintrag scheitert: weiter mit dem naechsten (blockiert die Schlange nicht)', () => {
    expect(decideAfterError('unavailable', true, 1)).toBe('skip');
  });
  test('Netz da, zu viele Fehlversuche: Eintrag verwerfen', () => {
    expect(decideAfterError('unavailable', true, MAX_ATTEMPTS)).toBe('remove');
  });
});
