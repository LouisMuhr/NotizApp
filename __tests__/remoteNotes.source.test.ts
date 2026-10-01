/**
 * notes.source: Die App schrieb fest 'app' und las die Spalte nicht zurueck.
 * Sprachnotizen landeten so als 'app', und ein Voll-Upload ueberschrieb
 * 'bookmarklet' mit 'app'. Soll: die Herkunft der Notiz geht unveraendert hin und zurueck.
 */
jest.mock('../src/sync/supabaseClient', () => ({ getSupabase: jest.fn() }));

const { getSupabase } = require('../src/sync/supabaseClient') as { getSupabase: jest.Mock };
const { pullRemote, upsertRemote } = require('../src/sync/remoteNotes') as typeof import('../src/sync/remoteNotes');
import type { Note } from '../src/models/Note';

const baseNote: Note = {
  id: 'n1', title: '', content: 'Hallo', category: 'Allgemein', isPinned: false, checklist: [],
  createdAt: '2026-09-24T10:00:00.000Z', updatedAt: '2026-09-24T10:00:00.000Z',
  reminderAt: null, reminderRecurrence: 'once', reminderWeekday: null, reminderDayOfMonth: null,
  notificationId: null, feedsThreads: false, archivedAt: null,
};

function upsertSpy() {
  const upsert = jest.fn().mockResolvedValue({ error: null });
  getSupabase.mockReturnValue({ from: () => ({ upsert }) });
  return upsert;
}

function pullFake(rows: Record<string, unknown>[]) {
  const chain: any = {
    select: () => chain, eq: () => chain, order: () => chain, range: () => chain,
    then: (resolve: (v: any) => void) => resolve({ data: rows, error: null }),
  };
  getSupabase.mockReturnValue({ from: () => chain });
}

test('Sprachnotiz wird mit source "voice" hochgeladen', async () => {
  const upsert = upsertSpy();
  await upsertRemote('u', { ...baseNote, source: 'voice' });
  expect(upsert.mock.calls[0][0].source).toBe('voice');
});

test('Notiz ohne Herkunft wird als "app" hochgeladen', async () => {
  const upsert = upsertSpy();
  await upsertRemote('u', baseNote);
  expect(upsert.mock.calls[0][0].source).toBe('app');
});

test('Pull liest source, erneuter Voll-Upload behaelt "bookmarklet"', async () => {
  pullFake([{
    id: 'n1', user_id: 'u', title: '', content: 'x', category: 'Allgemein', is_pinned: false,
    checklist: [], created_at: baseNote.createdAt, updated_at: baseNote.updatedAt,
    reminder_at: null, reminder_recurrence: 'once', reminder_weekday: null, reminder_day_of_month: null,
    source: 'bookmarklet',
  }]);
  const [pulled] = (await pullRemote('u'))!;
  expect(pulled.source).toBe('bookmarklet');

  const upsert = upsertSpy();
  await upsertRemote('u', pulled);
  expect(upsert.mock.calls[0][0].source).toBe('bookmarklet');
});
