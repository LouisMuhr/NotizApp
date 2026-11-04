/**
 * @jest-environment node
 *
 * Notiz löschen in der Webapp (DELETE /api/notes/[id]): jede Abfrage nach user_id gefiltert
 * (Defense-in-Depth neben RLS), Fehler als Code statt roher DB-Meldung, Netzfehler ≠ Anmeldefehler.
 */
import { deleteNote } from '../webapp/lib/deleteNote';
import type { NotesDb } from '../webapp/lib/createNote';

type Op = { table: string; op: string; payload?: unknown; filters: Array<[string, unknown]> };
function fakeDb(opts: { user?: { id: string } | null; userErr?: unknown; deleted?: number; deleteErr?: unknown; threads?: Array<{ id: string; note_ids: string[] }> } = {}) {
  const ops: Op[] = [];
  const db: NotesDb = {
    auth: { getUser: async () => ({ data: { user: opts.user === undefined ? { id: 'u1' } : opts.user }, error: opts.userErr ?? null }) },
    from: (table: string) => {
      const op: Op = { table, op: '', filters: [] };
      ops.push(op);
      const result = () => {
        if (op.op === 'delete') return opts.deleteErr ? { data: null, error: opts.deleteErr } : { data: Array.from({ length: opts.deleted ?? 1 }, () => ({ id: 'n1' })), error: null };
        if (op.op === 'select') return { data: opts.threads ?? [], error: null };
        return { data: null, error: null };
      };
      const chain: any = {
        delete: () => { op.op = 'delete'; return chain; },
        update: (p: unknown) => { op.op = 'update'; op.payload = p; return chain; },
        select: () => { if (!op.op) op.op = 'select'; return chain; },
        eq: (k: string, v: unknown) => { op.filters.push([k, v]); return chain; },
        contains: (k: string, v: unknown) => { op.filters.push([`${k}⊇`, v]); return chain; },
        then: (res: (v: unknown) => void, rej?: (e: unknown) => void) => Promise.resolve(result()).then(res, rej),
      };
      return chain;
    },
  };
  return { db, ops };
}

beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { (console.error as jest.Mock).mockRestore(); });

test('D1: löscht nur die eigene Notiz und räumt nur eigene Threads auf (user_id-Filter überall)', async () => {
  const { db, ops } = fakeDb({ threads: [{ id: 't1', note_ids: ['a', 'n1', 'b'] }] });
  expect(await deleteNote(db, 'n1')).toEqual({ status: 200 });
  const del = ops.find(o => o.table === 'notes' && o.op === 'delete')!;
  expect(del.filters).toEqual([['id', 'n1'], ['user_id', 'u1']]);
  const read = ops.find(o => o.table === 'threads' && o.op === 'select')!;
  expect(read.filters).toEqual([['user_id', 'u1'], ['note_ids⊇', ['n1']]]);
  const upd = ops.find(o => o.table === 'threads' && o.op === 'update')!;
  expect(upd.filters).toEqual([['id', 't1'], ['user_id', 'u1']]);
  expect((upd.payload as { note_ids: string[] }).note_ids).toEqual(['a', 'b']);
});

test('D2: erst die Notiz, dann die Thread-Verweise', async () => {
  const { db, ops } = fakeDb({ threads: [{ id: 't1', note_ids: ['n1'] }] });
  await deleteNote(db, 'n1');
  expect(ops.map(o => `${o.table}:${o.op}`)).toEqual(['notes:delete', 'threads:select', 'threads:update']);
});

test('D3: fremde oder schon gelöschte Notiz → 404, Threads bleiben unangetastet', async () => {
  const { db, ops } = fakeDb({ deleted: 0 });
  expect(await deleteNote(db, 'n1')).toEqual({ status: 404, error: 'not_found' });
  expect(ops.filter(o => o.table === 'threads')).toHaveLength(0);
});

test('D4: DB-Fehler → 500 internal, ohne rohe Meldung', async () => {
  const { db } = fakeDb({ deleteErr: { message: 'permission denied for table notes' } });
  expect(await deleteNote(db, 'n1')).toEqual({ status: 500, error: 'internal' });
});

test('D5: Supabase nicht erreichbar → 503 network, nicht unauthorized', async () => {
  const { db } = fakeDb({ user: null, userErr: { name: 'AuthRetryableFetchError', status: 0, message: 'fetch failed' } });
  expect(await deleteNote(db, 'n1')).toEqual({ status: 503, error: 'network' });
  const { db: db2 } = fakeDb({ deleteErr: { message: 'TypeError: fetch failed' } });
  expect(await deleteNote(db2, 'n1')).toEqual({ status: 503, error: 'network' });
});

test('D6: ungültige Anmeldung → 401, ohne ID → 400', async () => {
  expect(await deleteNote(fakeDb({ user: null }).db, 'n1')).toEqual({ status: 401, error: 'unauthorized' });
  expect(await deleteNote(fakeDb().db, '')).toEqual({ status: 400, error: 'invalid' });
});
