/**
 * S4 (Ursache): pullRemote fragt ohne Pagination ab. PostgREST liefert per
 * Default hoechstens 1000 Zeilen (max_rows). Der Test prueft, ob der Client
 * ueber die erste Seite hinaus liest.
 */
jest.mock('../src/sync/supabaseClient', () => ({ getSupabase: jest.fn() }));

const { getSupabase } = require('../src/sync/supabaseClient') as { getSupabase: jest.Mock };
const { pullRemote } = require('../src/sync/remoteNotes') as typeof import('../src/sync/remoteNotes');

function fakeSupabase(totalRows: number, cap = 1000) {
  const calls = { range: [] as Array<[number, number]>, limit: [] as number[] };
  const rows = Array.from({ length: totalRows }, (_, i) => ({
    id: `id-${i}`, user_id: 'u', title: '', content: '', category: 'Allgemein', is_pinned: false,
    checklist: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    reminder_at: null, reminder_recurrence: 'once', reminder_weekday: null, reminder_day_of_month: null,
  }));
  let from = 0;
  let to = cap - 1;
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    range: (a: number, b: number) => { calls.range.push([a, b]); from = a; to = b; return chain; },
    limit: (n: number) => { calls.limit.push(n); to = from + n - 1; return chain; },
    then: (resolve: (v: any) => void) => resolve({ data: rows.slice(from, Math.min(to + 1, from + cap)), error: null }),
  };
  return { client: { from: () => chain }, calls };
}

test('S4: pullRemote liest alle 1200 Notizen eines Users (Pagination ueber das 1000-Zeilen-Limit)', async () => {
  const { client, calls } = fakeSupabase(1200);
  getSupabase.mockReturnValue(client);

  const notes = await pullRemote('u');

  expect(calls.range.length + calls.limit.length).toBeGreaterThan(0); // irgendeine Form von Pagination
  expect(notes).toHaveLength(1200);
});
