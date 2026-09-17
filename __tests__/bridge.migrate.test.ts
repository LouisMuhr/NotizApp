/**
 * @jest-environment node
 *
 * A1: Migration anonym → Konto darf den anonymen User nur loeschen, wenn
 * die Migration vollstaendig erfolgreich war (sonst Cascade-Datenverlust).
 */
import migrateHandler from '../bridge/api/migrate-user';

function mockRes() {
  const res: any = { statusCode: 0, body: undefined };
  res.setHeader = () => {};
  res.status = (s: number) => { res.statusCode = s; return res; };
  res.json = (b: any) => { res.body = b; return res; };
  res.end = () => res;
  return res;
}

describe('A1 Client: migrateAndDeleteAnonUser', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    process.env.EXPO_PUBLIC_BRIDGE_URL = 'https://bridge.test';
    process.env.EXPO_PUBLIC_BRIDGE_BEARER = 'token';
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });

  test('Migration antwortet 500 → delete-user darf NICHT aufgerufen werden', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/api/migrate-user')) return { ok: false, status: 500, text: async () => 'db down', json: async () => ({}) };
      if (url.endsWith('/api/delete-user')) return { ok: true, status: 200, text: async () => '', json: async () => ({ ok: true }) };
      throw new Error('unexpected ' + url);
    });
    const { migrateAndDeleteAnonUser } = require('../src/sync/deleteAnonUser') as typeof import('../src/sync/deleteAnonUser');

    await migrateAndDeleteAnonUser('anon-uid', 'account-uid');

    const deleted = fetchMock.mock.calls.some(([url]) => String(url).endsWith('/api/delete-user'));
    expect(deleted).toBe(false);
  });

  test('Migration antwortet 200, aber mit Teilfehler (results.notes = 0) → delete-user darf NICHT aufgerufen werden', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/api/migrate-user')) return { ok: true, status: 200, text: async () => '', json: async () => ({ ok: true, results: { notes: 0, thoughts: 1, threads: 1 } }) };
      if (url.endsWith('/api/delete-user')) return { ok: true, status: 200, text: async () => '', json: async () => ({ ok: true }) };
      throw new Error('unexpected ' + url);
    });
    const { migrateAndDeleteAnonUser } = require('../src/sync/deleteAnonUser') as typeof import('../src/sync/deleteAnonUser');

    await migrateAndDeleteAnonUser('anon-uid', 'account-uid');

    const deleted = fetchMock.mock.calls.some(([url]) => String(url).endsWith('/api/delete-user'));
    expect(deleted).toBe(false);
  });
});

describe('A1 Server: /api/migrate-user', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://sb.test';
    process.env.SUPABASE_SERVICE_KEY = 'service';
    process.env.MCP_BEARER_TOKEN = 'admin';
  });

  test('schlaegt eine Tabelle fehl, antwortet der Endpoint nicht mit 200/ok:true', async () => {
    (global as any).fetch = jest.fn(async (url: string) => {
      if (url.includes('/rest/v1/notes')) return { ok: false, status: 500, text: async () => 'boom' };
      return { ok: true, status: 204, text: async () => '' };
    });
    const res = mockRes();
    await migrateHandler(
      { method: 'POST', headers: { authorization: 'Bearer admin' }, body: { fromUid: 'a', toUid: 'b' } },
      res,
    );
    expect(res.statusCode).not.toBe(200);
    expect(res.body?.ok).not.toBe(true);
  });

  test('X1: Endpoint akzeptiert beliebige fromUid/toUid mit dem statischen Token (kein Bezug zum Aufrufer)', async () => {
    (global as any).fetch = jest.fn(async () => ({ ok: true, status: 204, text: async () => '' }));
    const res = mockRes();
    await migrateHandler(
      { method: 'POST', headers: { authorization: 'Bearer admin' }, body: { fromUid: 'opfer-uid', toUid: 'angreifer-uid' } },
      res,
    );
    // Erwartung: ohne Nachweis, dass der Aufrufer "fromUid" besitzt, darf nichts umgehaengt werden
    expect(res.statusCode).not.toBe(200);
  });
});
