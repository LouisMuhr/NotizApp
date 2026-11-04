/**
 * @jest-environment node
 *
 * Notiz anlegen in der Webapp: Jeder Fehlerfall hat eine eigene, übersetzte Meldung, und der Server
 * schreibt die Erinnerung in die Spalten, die die App liest (reminder_at, reminder_recurrence, …) —
 * klingeln tut sie auf dem Handy.
 */
import { buildReminder, validateDraft, type NoteDraft, type NoteError, type ReminderInput } from '../webapp/lib/noteDraft';
import { createNote, type NotesDb } from '../webapp/lib/createNote';

jest.mock('../webapp/lib/supabase', () => ({ supabase: {} }));

// Mi, 4. Nov 2026, 10:00 Ortszeit
const NOW = new Date(2026, 10, 4, 10, 0, 0);
const input = (o: Partial<ReminderInput>): ReminderInput => ({ recurrence: null, dateTime: '', time: '', weekday: 2, dayOfMonth: 1, ...o });
const draft = (o: Partial<NoteDraft> = {}): NoteDraft => ({ title: 'Titel', content: '', category: 'Arbeit', threadId: '', includeInThreads: true, reminder: null, ...o });

describe('buildReminder', () => {
  test('keine Erinnerung gewählt → null', () => {
    expect(buildReminder(input({}), NOW)).toEqual({ reminder: null });
  });
  test('Einmalig ohne Datum → reminder_incomplete_once', () => {
    expect(buildReminder(input({ recurrence: 'once' }), NOW)).toEqual({ error: 'reminder_incomplete_once' });
  });
  test('Einmalig in der Vergangenheit → reminder_past', () => {
    expect(buildReminder(input({ recurrence: 'once', dateTime: '2026-11-04T09:59' }), NOW)).toEqual({ error: 'reminder_past' });
  });
  test('Einmalig in der Zukunft → reminder_at als ISO, keine Wiederholungsfelder', () => {
    const r = buildReminder(input({ recurrence: 'once', dateTime: '2026-11-05T09:00' }), NOW);
    expect(r).toEqual({ reminder: { reminder_at: new Date(2026, 10, 5, 9, 0).toISOString(), reminder_recurrence: 'once', reminder_weekday: null, reminder_day_of_month: null } });
  });
  test('Wiederholung ohne Uhrzeit → reminder_incomplete_recurring', () => {
    for (const recurrence of ['daily', 'weekly', 'monthly'] as const) {
      expect(buildReminder(input({ recurrence, time: '' }), NOW)).toEqual({ error: 'reminder_incomplete_recurring' });
    }
  });
  test('Täglich, Uhrzeit heute schon vorbei → nächster Termin morgen', () => {
    const r = buildReminder(input({ recurrence: 'daily', time: '08:30' }), NOW);
    expect('reminder' in r && r.reminder!.reminder_at).toBe(new Date(2026, 10, 5, 8, 30).toISOString());
  });
  test('Wöchentlich: Expo-Wochentag bleibt erhalten, Termin fällt auf diesen Tag', () => {
    // 2 = Montag (Expo: 1 = Sonntag)
    const r = buildReminder(input({ recurrence: 'weekly', time: '07:00', weekday: 2 }), NOW);
    if (!('reminder' in r) || !r.reminder) throw new Error('erwartet Erinnerung');
    expect(r.reminder.reminder_weekday).toBe(2);
    expect(new Date(r.reminder.reminder_at).getDay()).toBe(1);
    expect(new Date(r.reminder.reminder_at) > NOW).toBe(true);
  });
  test('Monatlich am 31.: Monatstag bleibt 31, im November wird auf den 30. gekürzt', () => {
    const r = buildReminder(input({ recurrence: 'monthly', time: '09:00', dayOfMonth: 31 }), NOW);
    if (!('reminder' in r) || !r.reminder) throw new Error('erwartet Erinnerung');
    expect(r.reminder.reminder_day_of_month).toBe(31);
    expect(r.reminder.reminder_at).toBe(new Date(2026, 10, 30, 9, 0).toISOString());
  });
});

describe('validateDraft', () => {
  test('weder Titel noch Inhalt → empty; nur Inhalt reicht (wie in der App)', () => {
    expect(validateDraft(draft({ title: '  ', content: '' }), NOW)).toBe('empty');
    expect(validateDraft(draft({ title: '', content: 'nur Inhalt' }), NOW)).toBeNull();
  });
  test('zu lang → title_too_long / content_too_long', () => {
    expect(validateDraft(draft({ title: 'x'.repeat(501) }), NOW)).toBe('title_too_long');
    expect(validateDraft(draft({ content: 'x'.repeat(50_001) }), NOW)).toBe('content_too_long');
  });
  test('kaputte Erinnerung vom Client → reminder_invalid', () => {
    const bad = { reminder_at: 'morgen', reminder_recurrence: 'once' as const, reminder_weekday: null, reminder_day_of_month: null };
    expect(validateDraft(draft({ reminder: bad }), NOW)).toBe('reminder_invalid');
    const badWeekday = { reminder_at: NOW.toISOString(), reminder_recurrence: 'weekly' as const, reminder_weekday: 9, reminder_day_of_month: null };
    expect(validateDraft(draft({ reminder: badWeekday }), NOW)).toBe('reminder_invalid');
  });
});

// ── Server: createNote mit nachgebautem Supabase-Client ──────────────────────────
type Op = { table: string; op: string; payload?: unknown; filters: Array<[string, unknown]> };
function fakeDb(opts: { user?: { id: string } | null; insertError?: unknown; thread?: { note_ids: string[] } | null } = {}) {
  const ops: Op[] = [];
  const db: NotesDb = {
    auth: { getUser: async () => ({ data: { user: opts.user === undefined ? { id: 'u1' } : opts.user }, error: null }) },
    from: (table: string) => {
      const op: Op = { table, op: '', filters: [] };
      ops.push(op);
      const chain: any = {
        insert: (p: unknown) => { op.op = 'insert'; op.payload = p; return chain; },
        update: (p: unknown) => { op.op = 'update'; op.payload = p; return chain; },
        select: () => { if (!op.op) op.op = 'select'; return chain; },
        eq: (k: string, v: unknown) => { op.filters.push([k, v]); return chain; },
        single: async () => opts.insertError ? { data: null, error: opts.insertError } : { data: { id: (op.payload as any).id }, error: null },
        maybeSingle: async () => ({ data: opts.thread ?? null, error: null }),
        then: (res: (v: unknown) => void) => res({ error: null }),
      };
      return chain;
    },
  };
  return { db, ops };
}

describe('createNote (POST /api/notes)', () => {
  test('ohne gültige Anmeldung → 401 unauthorized', async () => {
    const { db } = fakeDb({ user: null });
    expect(await createNote(db, draft(), NOW)).toEqual({ status: 401, error: 'unauthorized' });
  });
  test('Server erreicht Supabase nicht (offline) → 503 network, nicht „Anmeldung abgelaufen"', async () => {
    const { db } = fakeDb();
    db.auth.getUser = async () => ({ data: { user: null }, error: { name: 'AuthRetryableFetchError', status: 0, message: 'fetch failed' } });
    expect(await createNote(db, draft(), NOW)).toEqual({ status: 503, error: 'network' });
  });
  test('Insert scheitert am Netz → 503 network statt internal', async () => {
    const { db } = fakeDb({ insertError: { message: 'TypeError: fetch failed', details: 'getaddrinfo ENOTFOUND' } });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(await createNote(db, draft(), NOW)).toEqual({ status: 503, error: 'network' });
    spy.mockRestore();
  });
  test('ungültiger Entwurf → 400 mit Code, nichts wird geschrieben', async () => {
    const { db, ops } = fakeDb();
    expect(await createNote(db, draft({ title: '', content: '' }), NOW)).toEqual({ status: 400, error: 'empty' });
    expect(await createNote(db, null, NOW)).toEqual({ status: 400, error: 'empty' });
    expect(ops).toHaveLength(0);
  });
  test('Erinnerung landet in den Spalten der App (keine Spalte „reminder")', async () => {
    const { db, ops } = fakeDb();
    const reminder = { reminder_at: new Date(2026, 10, 9, 7, 0).toISOString(), reminder_recurrence: 'weekly' as const, reminder_weekday: 2, reminder_day_of_month: null };
    const r = await createNote(db, draft({ reminder }), NOW);
    expect(r.status).toBe(201);
    const row = ops.find(o => o.op === 'insert')!.payload as Record<string, unknown>;
    expect(row).not.toHaveProperty('reminder');
    expect(row).toMatchObject({ user_id: 'u1', reminder_at: reminder.reminder_at, reminder_recurrence: 'weekly', reminder_weekday: 2, reminder_day_of_month: null, feeds_threads: true });
  });
  test('ohne Erinnerung: reminder_at null, Kategorie fällt auf „Allgemein" zurück', async () => {
    const { db, ops } = fakeDb();
    await createNote(db, draft({ category: '' }), NOW);
    const row = ops.find(o => o.op === 'insert')!.payload as Record<string, unknown>;
    expect(row).toMatchObject({ reminder_at: null, reminder_recurrence: 'once', category: 'Allgemein' });
  });
  test('DB-Fehler → 500 internal, ohne die rohe Meldung nach außen zu geben', async () => {
    const { db } = fakeDb({ insertError: { message: 'column "reminder" does not exist' } });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(await createNote(db, draft(), NOW)).toEqual({ status: 500, error: 'internal' });
    spy.mockRestore();
  });
  test('fester Thread: Notiz wird angehängt, Lesen und Schreiben nach user_id gefiltert', async () => {
    const { db, ops } = fakeDb({ thread: { note_ids: ['alt'] } });
    const r = await createNote(db, draft({ threadId: 't1' }), NOW);
    const id = (r as { id: string }).id;
    const read = ops.find(o => o.table === 'threads' && o.op === 'select')!;
    const write = ops.find(o => o.table === 'threads' && o.op === 'update')!;
    expect(read.filters).toEqual([['id', 't1'], ['user_id', 'u1']]);
    expect(write.filters).toEqual([['id', 't1'], ['user_id', 'u1']]);
    expect((write.payload as { note_ids: string[] }).note_ids).toEqual(['alt', id]);
  });
});

describe('Meldungen', () => {
  const { __dicts } = jest.requireActual('../webapp/lib/i18n') as { __dicts: Record<'de' | 'en', any> };
  const codes: NoteError[] = ['empty', 'title_too_long', 'content_too_long', 'reminder_incomplete_once', 'reminder_incomplete_recurring',
    'reminder_past', 'reminder_invalid', 'unauthorized', 'network', 'internal'];
  test.each(['de', 'en'] as const)('jeder Fehler-Code hat eine Meldung (%s)', (loc) => {
    for (const c of codes) expect(typeof __dicts[loc].noteErrors[c]).toBe('string');
  });
  test('Deutsch und Englisch haben dieselben Schlüssel', () => {
    const keys = (o: any, p = ''): string[] => Object.entries(o).flatMap(([k, v]) =>
      v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`]);
    expect(keys(__dicts.en).sort()).toEqual(keys(__dicts.de).sort());
  });
});
