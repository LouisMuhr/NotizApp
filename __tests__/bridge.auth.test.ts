/**
 * @jest-environment node
 *
 * Umsetzung X1: Bridge-Endpunkte weisen den Aufrufer ueber Supabase-Tokens aus.
 * Positiv- und Negativpfade fuer delete-user, note und bookmarklet-token.
 */
import deleteHandler from '../bridge/api/delete-user';
import noteHandler from '../bridge/api/note';
import tokenHandler from '../bridge/api/bookmarklet-token';
import { createHash } from 'node:crypto';

const SB = 'https://sb.test';
type Call = { url: string; method: string; body: any; headers: any };
let calls: Call[] = [];

/** Tokens → User. 'anon-tok' ist anonym, 'acct-tok' ein Konto, alles andere ungueltig. */
const USERS: Record<string, { id: string; is_anonymous: boolean }> = {
  'anon-tok': { id: 'anon-uid', is_anonymous: true },
  'acct-tok': { id: 'acct-uid', is_anonymous: false },
  'other-acct-tok': { id: 'other-uid', is_anonymous: false },
};
let profiles: Record<string, { id: string; tier: string; bookmarklet_token_hash?: string | null }> = {};

function jsonRes(status: number, body: any) {
  return { ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) };
}

beforeEach(() => {
  process.env.SUPABASE_URL = SB;
  process.env.SUPABASE_SERVICE_KEY = 'service';
  delete process.env.BOOKMARKLET_MIN_TIER;
  calls = [];
  profiles = {
    'acct-uid': { id: 'acct-uid', tier: 'basic', bookmarklet_token_hash: createHash('sha256').update('a'.repeat(64)).digest('hex') },
    'other-uid': { id: 'other-uid', tier: 'free', bookmarklet_token_hash: null },
  };
  (global as any).fetch = jest.fn(async (url: string, init: any = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body, headers: init.headers ?? {} });
    if (url.startsWith(`${SB}/auth/v1/user`)) {
      const tok = String(init.headers?.Authorization ?? '').replace('Bearer ', '');
      return USERS[tok] ? jsonRes(200, USERS[tok]) : jsonRes(401, { error: 'invalid' });
    }
    if (url.startsWith(`${SB}/auth/v1/admin/users/`)) return jsonRes(200, {});
    if (url.startsWith(`${SB}/rest/v1/profiles`)) {
      if (method === 'GET') {
        const u = new URL(url);
        const idEq = u.searchParams.get('id');
        const hashEq = u.searchParams.get('bookmarklet_token_hash');
        const rows = Object.values(profiles).filter((p) =>
          (idEq ? p.id === idEq.replace('eq.', '') : true) &&
          (hashEq ? p.bookmarklet_token_hash === hashEq.replace('eq.', '') : true));
        return jsonRes(200, rows);
      }
      if (method === 'PATCH') return jsonRes(204, null);
    }
    if (url.startsWith(`${SB}/rest/v1/notes`) && method === 'POST') return jsonRes(201, null);
    throw new Error('unmocked ' + method + ' ' + url);
  });
});

function mockRes() {
  const res: any = { statusCode: 0, body: undefined };
  res.setHeader = () => {};
  res.status = (s: number) => { res.statusCode = s; return res; };
  res.json = (b: any) => { res.body = b; return res; };
  res.end = () => res;
  return res;
}
const req = (auth: string | null, body?: any, extra: any = {}) => ({
  method: 'POST', headers: auth ? { authorization: `Bearer ${auth}` } : {}, body, ...extra,
});

describe('/api/delete-user', () => {
  test('loescht nur den Aufrufer selbst — UID aus dem Token, nicht aus dem Body', async () => {
    const res = mockRes();
    await deleteHandler(req('anon-tok', { uid: 'acct-uid' }), res);
    expect(res.statusCode).toBe(200);
    const del = calls.find((c) => c.url.includes('/auth/v1/admin/users/'))!;
    expect(del.url.endsWith('/anon-uid')).toBe(true);
  });

  test('ungueltiges Token → 401, kein Admin-Call', async () => {
    const res = mockRes();
    await deleteHandler(req('nope', {}), res);
    expect(res.statusCode).toBe(401);
    expect(calls.some((c) => c.url.includes('/admin/users/'))).toBe(false);
  });
});

describe('/api/note (Bookmarklet)', () => {
  const KEY = 'a'.repeat(64);

  test('gueltiger Schluessel → Notiz landet beim Schluessel-Eigentuemer, user_id im Body wird ignoriert', async () => {
    const res = mockRes();
    await noteHandler(req(null, { title: 'T', content: 'C', user_id: 'other-uid' }, { query: { token: KEY } }), res);
    expect(res.statusCode).toBe(200);
    const ins = calls.find((c) => c.url.includes('/rest/v1/notes') && c.method === 'POST')!;
    expect(ins.body.user_id).toBe('acct-uid');
  });

  test('unbekannter Schluessel → 401, nichts geschrieben', async () => {
    const res = mockRes();
    await noteHandler(req(null, { title: 'T', content: 'C' }, { query: { token: 'b'.repeat(64) } }), res);
    expect(res.statusCode).toBe(401);
    expect(calls.some((c) => c.url.includes('/rest/v1/notes'))).toBe(false);
  });

  test('Tier unter BOOKMARKLET_MIN_TIER → 403 (Entscheidung 7: ab Basic)', async () => {
    profiles['acct-uid'].tier = 'free';
    const res = mockRes();
    await noteHandler(req(null, { title: 'T', content: 'C' }, { query: { token: KEY } }), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('tier_required');
  });
});

describe('/api/bookmarklet-token', () => {
  test('Konto ab Basic bekommt einen Schluessel, gespeichert wird nur der Hash', async () => {
    const res = mockRes();
    await tokenHandler(req('acct-tok'), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toMatch(/^[0-9a-f]{64}$/);
    const patch = calls.find((c) => c.url.includes('/rest/v1/profiles') && c.method === 'PATCH')!;
    expect(patch.body.bookmarklet_token_hash).toBe(createHash('sha256').update(res.body.token).digest('hex'));
    expect(patch.body.bookmarklet_token_hash).not.toBe(res.body.token);
  });

  test('anonymer User → 403 account_required', async () => {
    const res = mockRes();
    await tokenHandler(req('anon-tok'), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('account_required');
  });

  test('Free-Konto → 403 tier_required', async () => {
    const res = mockRes();
    await tokenHandler(req('other-acct-tok'), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('tier_required');
  });
});
