/**
 * @jest-environment node
 *
 * Umsetzung X1: Bridge-Endpunkte weisen den Aufrufer ueber Supabase-Tokens aus.
 * Positiv- und Negativpfade fuer delete-user und note (Bookmarklet).
 */
import deleteHandler from '../bridge/api/delete-user';
import noteHandler from '../bridge/api/note';

const SB = 'https://sb.test';
type Call = { url: string; method: string; body: any; headers: any };
let calls: Call[] = [];

/** Tokens → User. 'anon-tok' ist anonym, 'acct-tok' ein Konto, alles andere ungueltig. */
const USERS: Record<string, { id: string; is_anonymous: boolean }> = {
  'anon-tok': { id: 'anon-uid', is_anonymous: true },
  'acct-tok': { id: 'acct-uid', is_anonymous: false },
  'other-acct-tok': { id: 'other-uid', is_anonymous: false },
};
let profiles: Record<string, { id: string; tier: string }> = {};
/** Anzahl der heute per Bookmarklet angelegten Notizen, die die Zaehl-Abfrage meldet. */
let notesToday = 0;

function jsonRes(status: number, body: any) {
  return { ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) };
}

beforeEach(() => {
  process.env.SUPABASE_URL = SB;
  process.env.SUPABASE_SERVICE_KEY = 'service';
  delete process.env.BOOKMARKLET_MIN_TIER;
  calls = [];
  notesToday = 0;
  profiles = {
    'acct-uid': { id: 'acct-uid', tier: 'basic' },
    'other-uid': { id: 'other-uid', tier: 'free' },
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
    if (url.startsWith(`${SB}/rest/v1/profiles`) && method === 'GET') {
      const idEq = new URL(url).searchParams.get('id')?.replace('eq.', '');
      return jsonRes(200, Object.values(profiles).filter((p) => p.id === idEq));
    }
    if (url.startsWith(`${SB}/rest/v1/notes`) && method === 'HEAD') {
      return { ok: true, status: 200, headers: { get: (h: string) => (h.toLowerCase() === 'content-range' ? `0-0/${notesToday}` : null) } };
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
const inserted = () => calls.find((c) => c.url.includes('/rest/v1/notes') && c.method === 'POST')?.body;

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
  describe('Auth', () => {
    test('gueltiges Login-Token → Notiz landet beim eingeloggten User, user_id im Body wird ignoriert', async () => {
      const res = mockRes();
      await noteHandler(req('acct-tok', { title: 'T', content: 'C', user_id: 'other-uid' }), res);
      expect(res.statusCode).toBe(200);
      expect(inserted().user_id).toBe('acct-uid');
      expect(inserted().source).toBe('bookmarklet');
    });

    test('alter Bookmarklet-Schluessel per ?token= wird nicht mehr akzeptiert', async () => {
      const res = mockRes();
      await noteHandler(req(null, { title: 'T', content: 'C' }, { query: { token: 'a'.repeat(64) } }), res);
      expect(res.statusCode).toBe(401);
      expect(calls.some((c) => c.url.includes('/rest/v1/notes'))).toBe(false);
    });

    test('ungueltiges Login-Token → 401, nichts geschrieben', async () => {
      const res = mockRes();
      await noteHandler(req('nope', { title: 'T', content: 'C' }), res);
      expect(res.statusCode).toBe(401);
      expect(calls.some((c) => c.url.includes('/rest/v1/notes'))).toBe(false);
    });

    test('anonymer User → 403 account_required, nichts geschrieben', async () => {
      const res = mockRes();
      await noteHandler(req('anon-tok', { title: 'T', content: 'C' }), res);
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe('account_required');
      expect(calls.some((c) => c.url.includes('/rest/v1/notes'))).toBe(false);
    });

    test('Free-Konto → 403 tier_required (Entscheidung 7: ab Basic)', async () => {
      const res = mockRes();
      await noteHandler(req('other-acct-tok', { title: 'T', content: 'C' }), res);
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe('tier_required');
    });
  });

  describe('Tageslimit', () => {
    test('zaehlt nur heutige Bookmarklet-Notizen des Aufrufers', async () => {
      await noteHandler(req('acct-tok', { title: 'T' }), mockRes());
      const count = calls.find((c) => c.url.includes('/rest/v1/notes') && c.method === 'HEAD')!;
      const q = new URL(count.url).searchParams;
      expect(q.get('user_id')).toBe('eq.acct-uid');
      expect(q.get('source')).toBe('eq.bookmarklet');
      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);
      expect(q.get('created_at')).toBe(`gte.${dayStart.toISOString()}`);
    });

    test('49 heute → die 50. Notiz geht noch durch', async () => {
      notesToday = 49;
      const res = mockRes();
      await noteHandler(req('acct-tok', { title: 'T' }), res);
      expect(res.statusCode).toBe(200);
    });

    test('50 heute → 429 rate_limited, nichts geschrieben', async () => {
      notesToday = 50;
      const res = mockRes();
      await noteHandler(req('acct-tok', { title: 'T' }), res);
      expect(res.statusCode).toBe(429);
      expect(res.body.error).toBe('rate_limited');
      expect(inserted()).toBeUndefined();
    });
  });

  describe('Eingabepruefung', () => {
    test('ohne Titel → Ersatztitel „Notiz aus Bookmarklet"', async () => {
      await noteHandler(req('acct-tok', { content: 'nur Inhalt' }), mockRes());
      expect(inserted().title).toBe('Notiz aus Bookmarklet');
    });

    test('Checkliste aus dem Body wird ignoriert', async () => {
      await noteHandler(req('acct-tok', { title: 'T', checklist: ['a', 'b'] }), mockRes());
      expect(inserted().checklist).toEqual([]);
    });

    test('Kategorie wird getrimmt und auf 50 Zeichen gekuerzt, fehlende → Allgemein', async () => {
      await noteHandler(req('acct-tok', { title: 'T', category: `  ${'x'.repeat(80)}  ` }), mockRes());
      expect(inserted().category).toBe('x'.repeat(50));
      calls = [];
      await noteHandler(req('acct-tok', { title: 'T', category: { evil: true } }), mockRes());
      expect(inserted().category).toBe('Allgemein');
    });

    test('Inhalt ueber 50.000 Zeichen → 413 content_too_long, nichts geschrieben', async () => {
      const res = mockRes();
      await noteHandler(req('acct-tok', { title: 'T', content: 'x'.repeat(50_001) }), res);
      expect(res.statusCode).toBe(413);
      expect(res.body.error).toBe('content_too_long');
      expect(inserted()).toBeUndefined();
    });

    test('ungueltiges Erinnerungsdatum → 400 invalid_reminder', async () => {
      const res = mockRes();
      await noteHandler(req('acct-tok', { title: 'T', reminder_at: 'morgen irgendwann' }), res);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('invalid_reminder');
      expect(inserted()).toBeUndefined();
    });

    test('gueltige Erinnerung wird als ISO-Zeit gespeichert, unbekannte Wiederholung → once', async () => {
      await noteHandler(req('acct-tok', { title: 'T', reminder_at: '2026-11-01T09:30:00+01:00', reminder_recurrence: 'hourly' }), mockRes());
      expect(inserted().reminder_at).toBe('2026-11-01T08:30:00.000Z');
      expect(inserted().reminder_recurrence).toBe('once');
    });
  });
});
