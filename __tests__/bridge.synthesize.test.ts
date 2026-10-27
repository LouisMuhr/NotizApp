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
const NOTE1 = '22222222-2222-4222-8222-222222222222'; // erscheint fuer die KI als "n1"
let calls: Call[] = [];
let profile: Record<string, any> | null;
let profileGetOk = true;
let claimMatches = true;
let feedNotes: any[] = [];
let activeThreads: any[] = [];
let insertedThreads: any[] = [];
let archivedThreads: any[] = [];
let existingSims: any[] = [];
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
  feedNotes = [{ id: NOTE1, title: 'T', content: 'Inhalt', created_at: '', updated_at: '' }];
  activeThreads = [];
  insertedThreads = [];
  archivedThreads = [];
  existingSims = [];
  profile = { id: 'u1', tier: 'free', ai_last_run: null, ai_runs_today: 0, ai_day_reset: null };
  anthropic = () => jsonRes(200, { content: [{ type: 'text', text: JSON.stringify({ new_threads: [], thread_updates: [], similarities: [] }) }] });

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
    if (url.startsWith(`${SB}/rest/v1/threads`)) {
      if (method === 'POST') insertedThreads.push(...body);
      if (method !== 'GET') return jsonRes(204, null);
      const active = [...activeThreads, ...insertedThreads];
      return jsonRes(200, url.includes('status=eq.active') ? active : [...active, ...archivedThreads]);
    }
    if (url.startsWith(`${SB}/rest/v1/thread_similarities`)) return method === 'GET' ? jsonRes(200, existingSims) : jsonRes(204, null);
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
  anthropic = () => jsonRes(200, { content: [{ type: 'text', text: 'Entschuldigung, ich kann das nicht.' }] });
  const res = await run();
  expect(res.body?.message).not.toBe('no_feed_notes'); // darf nicht wie "keine Notizen" aussehen
  expect(releaseCalls()).toHaveLength(1);
});

test('E2e: DB-Schreibfehler nach der KI-Antwort → Lauf wird zurueckgegeben', async () => {
  anthropic = () => jsonRes(200, { content: [{ type: 'text', text: JSON.stringify({ new_threads: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Neu', summary: 's', note_ids: ['n1'] }], thread_updates: [], similarities: [] }) }] });
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

// ---------------------------------------------------------------------------
// Ergebnisse schreiben: keine Notiz darf verloren gehen
// ---------------------------------------------------------------------------

const T1 = '11111111-1111-4111-8111-111111111111';
const aiReturns = (synthesis: any) => {
  anthropic = () => jsonRes(200, { content: [{ type: 'text', text: JSON.stringify({ new_threads: [], thread_updates: [], similarities: [], ...synthesis }) }] });
};
const threadPosts = () => calls.filter((c) => c.method === 'POST' && c.url.startsWith(`${SB}/rest/v1/threads`));
const threadPatches = () => calls.filter((c) => c.method === 'PATCH' && c.url.startsWith(`${SB}/rest/v1/threads`));

test('Prompt enthaelt keine Dormant-/21-Tage-Regel (Modell kennt kein Datum)', async () => {
  await run();
  const ai = calls.find((c) => c.url.startsWith('https://api.anthropic.com'))!;
  expect(ai.body.system).not.toMatch(/dormant/i);
  expect(ai.body.system).not.toMatch(/21 Tag/);
});

test('Neuer Thread mit Titel eines aktiven Threads → Notizen landen im bestehenden Thread', async () => {
  activeThreads = [{ id: T1, title: 'App-Ideen', summary: 'alt', note_ids: ['old-1'], updated_at: '' }];
  aiReturns({ new_threads: [{ id: 'neu-1', title: 'App-Ideen', summary: 'neu', note_ids: ['n1'] }] });
  const res = await run();
  expect(res.statusCode).toBe(200);
  expect(threadPosts()).toHaveLength(0);
  expect(threadPatches()).toHaveLength(1);
  expect(threadPatches()[0].url).toContain(`id=eq.${T1}`);
  expect(threadPatches()[0].body.note_ids).toEqual(['old-1', NOTE1]);
  expect(threadPatches()[0].body.thought_count).toBe(2);
});

test('Update mit unvollstaendiger note_ids-Liste → bestehende Notizen bleiben im Thread', async () => {
  activeThreads = [{ id: T1, title: 'App-Ideen', summary: 'alt', note_ids: ['old-1', 'old-2'], updated_at: '' }];
  aiReturns({ thread_updates: [{ id: 't1', summary: 'neu', note_ids: ['n1'] }] });
  await run();
  expect(threadPatches()).toHaveLength(1);
  expect(threadPatches()[0].body.note_ids).toEqual(['old-1', 'old-2', NOTE1]);
  expect(threadPatches()[0].body.summary).toBe('neu');
});

test('Update setzt keinen Status (KI kann Threads nicht stilllegen)', async () => {
  activeThreads = [{ id: T1, title: 'App-Ideen', summary: 'alt', note_ids: ['old-1'], updated_at: '' }];
  aiReturns({ thread_updates: [{ id: 't1', status: 'dormant', summary: 'alt', note_ids: ['n1'] }] });
  await run();
  expect(threadPatches()).toHaveLength(1);
  expect(threadPatches()[0].body).not.toHaveProperty('status');
  expect(threadPatches()[0].url).toContain('status=eq.active');
});

test('Update fuer unbekannte Thread-ID (nicht in active_threads) wird ignoriert', async () => {
  aiReturns({ thread_updates: [{ id: 'erfunden', summary: 's', note_ids: ['n1'] }] });
  const res = await run();
  expect(res.statusCode).toBe(200);
  expect(threadPatches()).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Kurz-Referenzen statt UUIDs: das Modell sieht und erzeugt keine echten IDs
// ---------------------------------------------------------------------------

test('KI bekommt Kurz-Referenzen (n1, t1) statt UUIDs', async () => {
  activeThreads = [{ id: T1, title: 'App-Ideen', summary: 'alt', note_ids: ['old-1'], updated_at: '' }];
  await run();
  const ai = calls.find((c) => c.url.startsWith('https://api.anthropic.com'))!;
  const input = JSON.parse(ai.body.messages[0].content);
  expect(input.new_notes[0].id).toBe('n1');
  expect(input.active_threads).toEqual([{ id: 't1', title: 'App-Ideen', summary: 'alt', note_titles: [] }]);
  expect(ai.body.messages[0].content).not.toContain(NOTE1);
  expect(ai.body.messages[0].content).not.toContain(T1);
});

test('Neuer Thread bekommt eine Server-UUID, auch wenn das Modell eine ungueltige liefert', async () => {
  aiReturns({ new_threads: [{ id: 'g7b8c9da-ebfc-4345-g7b8-c9daebfcg7b8', title: 'Neu', summary: 's', note_ids: ['n1'] }] });
  const res = await run();
  expect(res.statusCode).toBe(200);
  const row = threadPosts()[0].body[0];
  expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(row.note_ids).toEqual([NOTE1]);
});

test('Verbindung zwischen neuem (neu-1) und bestehendem Thread (t1) wird auf echte IDs uebersetzt', async () => {
  activeThreads = [{ id: T1, title: 'App-Ideen', summary: 'alt', note_ids: ['old-1'], updated_at: '' }];
  aiReturns({
    new_threads: [{ id: 'neu-1', title: 'Rezepte', summary: 's', note_ids: ['n1'] }],
    similarities: [{ thread_id_1: 'neu-1', thread_id_2: 't1', label: 'App-Ideen' }],
  });
  await run();
  const newId = threadPosts()[0].body[0].id;
  const simPost = calls.find((c) => c.method === 'POST' && c.url.startsWith(`${SB}/rest/v1/thread_similarities`))!;
  expect(simPost.body).toEqual([{ user_id: 'u1', thread_id_1: newId, thread_id_2: T1, label: 'App-Ideen' }]);
});

test('Erfundene Notiz-Referenzen fallen weg; neuer Thread ohne gueltige Notiz wird nicht angelegt', async () => {
  aiReturns({ new_threads: [
    { id: 'neu-1', title: 'Gemischt', summary: 's', note_ids: ['n1', 'n99'] },
    { id: 'neu-2', title: 'Leer', summary: 's', note_ids: ['n42'] },
  ] });
  await run();
  expect(threadPosts()).toHaveLength(1);
  expect(threadPosts()[0].body).toHaveLength(1);
  expect(threadPosts()[0].body[0].title).toBe('Gemischt');
  expect(threadPosts()[0].body[0].note_ids).toEqual([NOTE1]);
});

// ---------------------------------------------------------------------------
// Nur neue Notizen an die KI, jede Notiz in hoechstens einem Thread
// ---------------------------------------------------------------------------

const NOTE2 = '33333333-3333-4333-8333-333333333333';
const NOTE3 = '44444444-4444-4444-8444-444444444444';

test('Bereits einsortierte Notizen (auch in archivierten Threads) gehen nicht an die KI', async () => {
  feedNotes = [
    { id: NOTE1, title: 'aktiv', content: 'x', created_at: '', updated_at: '' },
    { id: NOTE2, title: 'archiviert', content: 'x', created_at: '', updated_at: '' },
    { id: NOTE3, title: 'neu', content: 'x', created_at: '', updated_at: '' },
  ];
  activeThreads = [{ id: T1, title: 'A', summary: 's', note_ids: [NOTE1], updated_at: '' }];
  archivedThreads = [{ id: 'arch', title: 'B', summary: 's', note_ids: [NOTE2], status: 'archived' }];
  await run();
  const ai = calls.find((c) => c.url.startsWith('https://api.anthropic.com'))!;
  const input = JSON.parse(ai.body.messages[0].content);
  expect(input.new_notes.map((n: any) => n.title)).toEqual(['neu']);
});

test('Alle Notizen schon einsortiert → kein KI-Call, "keine neuen Notizen", Lauf wird zurueckgegeben', async () => {
  activeThreads = [{ id: T1, title: 'A', summary: 's', note_ids: [NOTE1], updated_at: '' }];
  const res = await run();
  expect(res.statusCode).toBe(200);
  expect(res.body.message).toBe('no_new_notes');
  expect(calls.some((c) => c.url.startsWith('https://api.anthropic.com'))).toBe(false);
  expect(releaseCalls()).toHaveLength(1);
});

test('Notiz in Update UND neuem Thread → nur im bestehenden; leerer neuer Thread entfaellt', async () => {
  activeThreads = [{ id: T1, title: 'App-Ideen', summary: 'alt', note_ids: ['old-1'], updated_at: '' }];
  aiReturns({
    thread_updates: [{ id: 't1', summary: 'neu', note_ids: ['n1'] }],
    new_threads: [{ id: 'neu-1', title: 'Duplikat', summary: 's', note_ids: ['n1'] }],
  });
  await run();
  expect(threadPosts()).toHaveLength(0);
  expect(threadPatches()).toHaveLength(1);
  expect(threadPatches()[0].body.note_ids).toEqual(['old-1', NOTE1]);
});

test('Notiz in zwei neuen Threads → nur im ersten', async () => {
  feedNotes = [
    { id: NOTE1, title: 'a', content: 'x', created_at: '', updated_at: '' },
    { id: NOTE2, title: 'b', content: 'x', created_at: '', updated_at: '' },
  ];
  aiReturns({ new_threads: [
    { id: 'neu-1', title: 'Erster', summary: 's', note_ids: ['n1'] },
    { id: 'neu-2', title: 'Zweiter', summary: 's', note_ids: ['n1', 'n2'] },
  ] });
  await run();
  const rows = threadPosts()[0].body;
  expect(rows.map((r: any) => [r.title, r.note_ids])).toEqual([['Erster', [NOTE1]], ['Zweiter', [NOTE2]]]);
});

test('Update ohne gueltige neue Notiz → Thread wird nicht angefasst', async () => {
  activeThreads = [{ id: T1, title: 'App-Ideen', summary: 'alt', note_ids: ['old-1'], updated_at: '' }];
  aiReturns({ thread_updates: [{ id: 't1', summary: 'umgeschrieben', note_ids: ['n99'] }] });
  await run();
  expect(threadPatches()).toHaveLength(0);
});

test('Bestehende Threads bekommen die Titel ihrer Notizen mit (Inhalt als Ersatz, gekuerzt)', async () => {
  const long = 'Für die Kühlschrank-App: Haltbarkeit mitschätzen, damit zuerst verbraucht wird, was bald schlecht wird.';
  feedNotes = [
    { id: 'old-1', title: 'Rezept-App', content: 'x', created_at: '', updated_at: '' },
    { id: 'old-2', title: '', content: long, created_at: '', updated_at: '' },
    { id: NOTE1, title: 'neu', content: 'x', created_at: '', updated_at: '' },
  ];
  activeThreads = [{ id: T1, title: 'Rezept-App', summary: 's', note_ids: ['old-1', 'old-2', 'geloescht'], updated_at: '' }];
  await run();
  const ai = calls.find((c) => c.url.startsWith('https://api.anthropic.com'))!;
  const input = JSON.parse(ai.body.messages[0].content);
  expect(input.active_threads[0].note_titles).toEqual(['Rezept-App', `${long.slice(0, 60)}…`]);
  expect(input.new_notes.map((n: any) => n.title)).toEqual(['neu']);
});

test('Antwort mit thinking-Block vor dem Text (Modelle mit Thinking) wird korrekt gelesen', async () => {
  anthropic = () => jsonRes(200, { content: [
    { type: 'thinking', thinking: '', signature: 'sig' },
    { type: 'text', text: JSON.stringify({ new_threads: [{ id: 'neu-1', title: 'Neu', summary: 's', note_ids: ['n1'] }], thread_updates: [], similarities: [] }) },
  ] });
  const res = await run();
  expect(res.statusCode).toBe(200);
  expect(threadPosts()[0].body[0].note_ids).toEqual([NOTE1]);
});

test('KI-Request erzwingt per Structured Outputs genau ein JSON-Objekt nach Schema', async () => {
  await run();
  const ai = calls.find((c) => c.url.startsWith('https://api.anthropic.com'))!;
  const format = ai.body.output_config?.format;
  expect(format?.type).toBe('json_schema');
  expect(format.schema.required).toEqual(['new_threads', 'thread_updates', 'similarities']);
  expect(format.schema.additionalProperties).toBe(false);
});

test('Bestehende Verbindungen gehen als Kurz-Referenzen an die KI (nur zwischen aktiven Threads)', async () => {
  const T2 = '55555555-5555-4555-8555-555555555555';
  activeThreads = [
    { id: T1, title: 'A', summary: 's', note_ids: [], updated_at: '' },
    { id: T2, title: 'B', summary: 's', note_ids: [], updated_at: '' },
  ];
  existingSims = [
    { thread_id_1: T1, thread_id_2: T2, label: 'App-Ideen' },
    { thread_id_1: T1, thread_id_2: 'archiviert', label: 'alt' },
  ];
  await run();
  const ai = calls.find((c) => c.url.startsWith('https://api.anthropic.com'))!;
  const input = JSON.parse(ai.body.messages[0].content);
  expect(input.existing_similarities).toEqual([{ thread_id_1: 't1', thread_id_2: 't2', label: 'App-Ideen' }]);
});
