/**
 * @jest-environment node
 *
 * Phase-2-Tests fuer den Synthese-Endpoint (Rate-Limit, Claim/Release, Fehlerpfade).
 * Entscheidung 2: Lauf wird zurueckgegeben, wenn der Fehler auf unserer Seite liegt
 * (Netz, DB, unbrauchbare KI-Antwort); NICHT bei "keine Notizen" (User-Seite).
 */
import handler from '../bridge/api/synthesize';

type Call = { url: string; method: string; body: any };

const SB = 'https://sb.test';
let calls: Call[] = [];
let profile: Record<string, any> | null;
let profileGetOk = true;
let claimMatches = true;
let feedNotes: any[] = [];
let anthropic: () => Promise<any> | any;

function jsonRes(status: number, body: any) {
  return { ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) };
}

beforeEach(() => {
  process.env.SUPABASE_URL = SB;
  process.env.SUPABASE_SERVICE_KEY = 'service';
  process.env.ANTHROPIC_API_KEY = 'anthropic';
  calls = [];
  profileGetOk = true;
  claimMatches = true;
  feedNotes = [{ id: 'n1', title: 'T', content: 'Inhalt', created_at: '', updated_at: '' }];
  profile = { id: 'u1', tier: 'free', ai_last_run: null, ai_runs_today: 0, ai_day_reset: null };
  anthropic = () => jsonRes(200, { content: [{ text: JSON.stringify({ new_threads: [], thread_updates: [], similarities: [] }) }] });

  (global as any).fetch = jest.fn(async (url: string, init: any = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });

    if (url.startsWith(`${SB}/auth/v1/user`)) return jsonRes(200, { id: 'u1' });
    if (url.startsWith(`${SB}/rest/v1/profiles`)) {
      if (method === 'GET') return profileGetOk ? jsonRes(200, profile ? [profile] : []) : jsonRes(500, { message: 'db down' });
      if (method === 'POST') return jsonRes(201, null);
      if (method === 'PATCH') {
        const isClaim = url.includes('ai_last_run=');
        if (isClaim) return jsonRes(200, claimMatches ? [{ ...profile, ...body }] : []);
        return jsonRes(204, null); // release
      }
    }
    if (url.startsWith(`${SB}/rest/v1/notes`)) return jsonRes(200, feedNotes);
    if (url.startsWith(`${SB}/rest/v1/threads`)) return jsonRes(200, []);
    if (url.startsWith(`${SB}/rest/v1/thread_similarities`)) return jsonRes(204, null);
    if (url.startsWith('https://api.anthropic.com')) return anthropic();
    throw new Error('unmocked url ' + url);
  });
});

function mockRes() {
  const res: any = { statusCode: 0, body: undefined, headers: {} };
  res.setHeader = (k: string, v: string) => { res.headers[k] = v; };
  res.status = (s: number) => { res.statusCode = s; return res; };
  res.json = (b: any) => { res.body = b; return res; };
  res.end = (b?: any) => { res.body = b; return res; };
  return res;
}

async function run() {
  const res = mockRes();
  await handler({ method: 'POST', headers: { authorization: 'Bearer jwt' } }, res);
  return res;
}

const claimCalls = () => calls.filter((c) => c.method === 'PATCH' && c.url.includes('ai_last_run='));
const releaseCalls = () => calls.filter((c) => c.method === 'PATCH' && c.url.includes('/profiles') && !c.url.includes('ai_last_run='));

test('Happy Path: Lauf wird vor dem KI-Call gebucht und nicht zurueckgegeben', async () => {
  const res = await run();
  expect(res.statusCode).toBe(200);
  expect(claimCalls()).toHaveLength(1);
  expect(releaseCalls()).toHaveLength(0);
  const anthropicIdx = calls.findIndex((c) => c.url.startsWith('https://api.anthropic.com'));
  const claimIdx = calls.indexOf(claimCalls()[0]);
  expect(claimIdx).toBeLessThan(anthropicIdx);
});

test('Race: verliert der Claim (0 Zeilen), wird der Lauf nicht ausgefuehrt', async () => {
  claimMatches = false;
  const res = await run();
  expect(res.statusCode).toBe(429);
  expect(calls.some((c) => c.url.startsWith('https://api.anthropic.com'))).toBe(false);
});

test('E2c: Anthropic antwortet mit HTTP-Fehler → Lauf wird zurueckgegeben', async () => {
  anthropic = () => jsonRes(529, { error: 'overloaded' });
  const res = await run();
  expect(res.statusCode).toBe(500);
  expect(releaseCalls()).toHaveLength(1);
});

test('E2d: keine Feed-Notizen → Lauf gilt als verbraucht (User-Seite, Entscheidung 2)', async () => {
  feedNotes = [];
  const res = await run();
  expect(res.statusCode).toBe(200);
  expect(res.body.message).toBe('no_feed_notes');
  expect(claimCalls()).toHaveLength(1);
  expect(releaseCalls()).toHaveLength(0);
});

test('E2a: Netzwerkfehler beim KI-Call (fetch wirft) → Lauf wird zurueckgegeben', async () => {
  anthropic = () => { throw new Error('ECONNRESET'); };
  const res = await run();
  expect(res.statusCode).toBeGreaterThanOrEqual(500);
  expect(releaseCalls()).toHaveLength(1);
});

test('E2b: unbrauchbare KI-Antwort (kein JSON) → Lauf zurueckgegeben, ehrliche Fehlermeldung', async () => {
  anthropic = () => jsonRes(200, { content: [{ text: 'Entschuldigung, ich kann das nicht.' }] });
  const res = await run();
  expect(res.body?.message).not.toBe('no_feed_notes'); // darf nicht wie "keine Notizen" aussehen
  expect(releaseCalls()).toHaveLength(1);
});

test('E2e: DB-Schreibfehler nach der KI-Antwort → Lauf wird zurueckgegeben', async () => {
  anthropic = () => jsonRes(200, { content: [{ text: JSON.stringify({ new_threads: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Neu', summary: 's', note_ids: ['n1'] }], thread_updates: [], similarities: [] }) }] });
  const origFetch = (global as any).fetch;
  (global as any).fetch = jest.fn(async (url: string, init: any = {}) => {
    if (url.startsWith(`${SB}/rest/v1/threads`) && init.method === 'POST') { calls.push({ url, method: 'POST', body: null }); return jsonRes(500, { message: 'insert failed' }); }
    return origFetch(url, init);
  });
  const res = await run();
  expect(res.statusCode).toBe(500);
  expect(releaseCalls()).toHaveLength(1);
});

test('E8: Profil nicht ladbar (DB kurz weg) → kein 429 mit 7-Tage-Sperre', async () => {
  profileGetOk = false;
  claimMatches = false; // PATCH matcht nichts, weil das Fallback-Profil nicht existiert
  const res = await run();
  expect(res.statusCode).not.toBe(429);
  expect(res.body?.error).not.toBe('limit_reached');
});

test('A6: Pro-User verliert das Claim-Race → next_allowed_at darf nicht null sein, wenn 429 gesendet wird', async () => {
  profile = { id: 'u1', tier: 'pro', ai_last_run: '2026-09-16T08:00:00Z', ai_runs_today: 3, ai_day_reset: new Date().toISOString().slice(0, 10) };
  claimMatches = false;
  const res = await run();
  if (res.statusCode === 429) {
    expect(res.body.next_allowed_at).not.toBeNull();
  } else {
    expect(res.statusCode).toBe(200);
  }
});

test('E1 (Server-Seite): Tier wird ungeprueft aus profiles.tier uebernommen', async () => {
  // Dokumentiert: der Endpoint vertraut dem Wert in der Zeile. Wer die Zeile schreiben
  // darf (RLS "own update" ohne Spaltenfilter), bestimmt sein Limit selbst.
  profile = { id: 'u1', tier: 'pro', ai_last_run: new Date().toISOString(), ai_runs_today: 1, ai_day_reset: new Date().toISOString().slice(0, 10) };
  const res = await run();
  expect(res.statusCode).toBe(200); // ein "Free"-User mit selbst gesetztem tier=pro laeuft sofort erneut
});
