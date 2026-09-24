/**
 * @jest-environment node
 *
 * KI-Sprachnotizen (/api/parse-note): nur Pro, 30 Laeufe pro UTC-Tag, Lauf wird
 * vor dem KI-Call gebucht und bei Fehlern auf unserer Seite zurueckgegeben. Die
 * Modellantwort wird geprueft statt geglaubt (Kategorie, Datum, Wochentag).
 */
jest.mock('../bridge/api/_lib/parseNoteAi', () => {
  const actual = jest.requireActual('../bridge/api/_lib/parseNoteAi');
  return { ...actual, structureWithClaude: jest.fn() };
});

import handler, { VOICE_AI_DAILY_LIMIT } from '../bridge/api/parse-note';
import { structureWithClaude, sanitizeStructured, ParseNoteAiError, buildCalendar } from '../bridge/api/_lib/parseNoteAi';

const ai = structureWithClaude as jest.Mock;

type Call = { url: string; method: string; body: any };
const SB = 'https://sb.test';
const TODAY = new Date().toISOString().slice(0, 10);
let calls: Call[] = [];
let profile: Record<string, any> | null;
let claimMatches = true;
let isAnonymous = false;

function jsonRes(status: number, body: any) {
  return { ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) };
}

const aiRaw = (over: Record<string, any> = {}) => ({
  title: 'Einkauf',
  content: '',
  checklist: ['Milch', 'Eier'],
  category: 'Einkauf',
  reminder: null,
  ...over,
});

beforeEach(() => {
  process.env.SUPABASE_URL = SB;
  process.env.SUPABASE_SERVICE_KEY = 'service';
  process.env.ANTHROPIC_API_KEY = 'anthropic';
  calls = [];
  claimMatches = true;
  isAnonymous = false;
  profile = { id: 'u1', tier: 'pro', voice_ai_runs_today: 0, voice_ai_day_reset: null };
  ai.mockReset();
  ai.mockResolvedValue(aiRaw());

  (global as any).fetch = jest.fn(async (url: string, init: any = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    if (url.startsWith(`${SB}/auth/v1/user`)) return jsonRes(200, { id: 'u1', is_anonymous: isAnonymous });
    if (url.startsWith(`${SB}/rest/v1/profiles`)) {
      if (method === 'GET') return jsonRes(200, profile ? [profile] : []);
      if (method === 'PATCH') {
        const isClaim = url.includes('voice_ai_runs_today=');
        if (isClaim) return jsonRes(200, claimMatches ? [{ ...profile, ...body }] : []);
        return jsonRes(204, null); // release
      }
    }
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

const validBody = {
  transcript: 'Einkaufen Milch und Eier',
  categories: ['Allgemein', 'Einkauf', 'Arbeit'],
  localNow: '2026-09-24T10:00',
  locale: 'de',
};

async function run(body: any = validBody, auth = 'Bearer jwt') {
  const res = mockRes();
  await handler({ method: 'POST', headers: auth ? { authorization: auth } : {}, body }, res);
  return res;
}

const claimCalls = () => calls.filter((c) => c.method === 'PATCH' && c.url.includes('voice_ai_runs_today='));
const releaseCalls = () => calls.filter((c) => c.method === 'PATCH' && !c.url.includes('voice_ai_runs_today='));

test('Pro: Lauf wird gebucht, strukturierte Notiz kommt zurueck', async () => {
  const res = await run();
  expect(res.statusCode).toBe(200);
  expect(res.body).toEqual({ title: 'Einkauf', content: '', checklist: ['Milch', 'Eier'], category: 'Einkauf', reminder: null });
  expect(claimCalls()).toHaveLength(1);
  expect(claimCalls()[0].body).toEqual({ voice_ai_runs_today: 1, voice_ai_day_reset: TODAY });
  expect(releaseCalls()).toHaveLength(0);
});

test('ohne Token → 401, kein KI-Call', async () => {
  const res = await run(validBody, '');
  expect(res.statusCode).toBe(401);
  expect(ai).not.toHaveBeenCalled();
});

test('anonymer User → 403 account_required', async () => {
  isAnonymous = true;
  const res = await run();
  expect(res.statusCode).toBe(403);
  expect(res.body.error).toBe('account_required');
});

test.each(['free', 'basic'])('%s → 403 plan_required, kein KI-Call', async (tier) => {
  profile!.tier = tier;
  const res = await run();
  expect(res.statusCode).toBe(403);
  expect(res.body.error).toBe('plan_required');
  expect(ai).not.toHaveBeenCalled();
  expect(claimCalls()).toHaveLength(0);
});

test(`Limit: Lauf ${VOICE_AI_DAILY_LIMIT + 1} am selben Tag → 429 mit naechster UTC-Mitternacht`, async () => {
  profile = { id: 'u1', tier: 'pro', voice_ai_runs_today: VOICE_AI_DAILY_LIMIT, voice_ai_day_reset: TODAY };
  const res = await run();
  expect(res.statusCode).toBe(429);
  expect(res.body.error).toBe('limit_reached');
  const midnight = new Date(`${TODAY}T00:00:00.000Z`);
  midnight.setUTCDate(midnight.getUTCDate() + 1);
  expect(res.body.next_allowed_at).toBe(midnight.toISOString());
  expect(ai).not.toHaveBeenCalled();
});

test('neuer Tag setzt den Zaehler zurueck', async () => {
  profile = { id: 'u1', tier: 'pro', voice_ai_runs_today: VOICE_AI_DAILY_LIMIT, voice_ai_day_reset: '2000-01-01' };
  const res = await run();
  expect(res.statusCode).toBe(200);
  expect(claimCalls()[0].body.voice_ai_runs_today).toBe(1);
});

test('Claim-Race zweimal verloren → 429 busy, kein KI-Call', async () => {
  claimMatches = false;
  const res = await run();
  expect(res.statusCode).toBe(429);
  expect(res.body.error).toBe('busy');
  expect(claimCalls()).toHaveLength(2);
  expect(ai).not.toHaveBeenCalled();
});

test('KI nicht erreichbar → 502 ai_unavailable, Lauf wird zurueckgegeben', async () => {
  ai.mockRejectedValue(new ParseNoteAiError('ai_unavailable'));
  const res = await run();
  expect(res.statusCode).toBe(502);
  expect(res.body.error).toBe('ai_unavailable');
  expect(releaseCalls()).toHaveLength(1);
});

test('leere KI-Antwort → ai_response_invalid, Lauf wird zurueckgegeben', async () => {
  ai.mockResolvedValue(aiRaw({ title: '', content: '', checklist: [] }));
  const res = await run();
  expect(res.body.error).toBe('ai_response_invalid');
  expect(releaseCalls()).toHaveLength(1);
});

test.each([
  ['ohne Diktat', { ...validBody, transcript: '  ' }],
  ['kaputtes localNow', { ...validBody, localNow: 'morgen' }],
  ['zu langes Diktat', { ...validBody, transcript: 'x'.repeat(4001) }],
])('ungueltige Eingabe (%s) → 400, kein Claim', async (_label, body) => {
  const res = await run(body);
  expect(res.statusCode).toBe(400);
  expect(claimCalls()).toHaveLength(0);
});

// --- sanitizeStructured: Modellantwort pruefen statt glauben -----------------

const input = { transcript: 'x', title: '', categories: ['Allgemein', 'Einkauf'], localNow: '2026-09-24T10:00', locale: 'de' as const };
const reminder = (over: Record<string, any>) => ({ at: '2026-09-25T09:00', recurrence: 'once', weekday: null, day_of_month: null, ...over });

test('unbekannte Kategorie → Allgemein', () => {
  expect(sanitizeStructured(aiRaw({ category: 'Urlaub' }) as any, input)!.category).toBe('Allgemein');
});

test('Titel vom Knopf bleibt unveraendert', () => {
  expect(sanitizeStructured(aiRaw({ title: 'Anders' }) as any, { ...input, title: 'Mein Titel' })!.title).toBe('Mein Titel');
});

test.each(['2026-02-30T09:00', '2026-09-25 09:00', 'morgen', '2026-09-25T25:00'])('kaputtes Datum %s → kein Reminder', (at) => {
  expect(sanitizeStructured(aiRaw({ reminder: reminder({ at }) }) as any, input)!.reminder).toBeNull();
});

test('einmaliger Reminder in der Vergangenheit → verworfen', () => {
  expect(sanitizeStructured(aiRaw({ reminder: reminder({ at: '2026-09-24T09:59' }) }) as any, input)!.reminder).toBeNull();
});

test('weekly ohne gueltigen Wochentag → Wochentag aus dem Datum (Expo 1=So)', () => {
  // 2026-09-28 ist ein Montag → 2
  const r = sanitizeStructured(aiRaw({ reminder: reminder({ at: '2026-09-28T08:00', recurrence: 'weekly', weekday: 9 }) }) as any, input)!.reminder;
  expect(r).toEqual({ at: '2026-09-28T08:00', recurrence: 'weekly', weekday: 2, dayOfMonth: null });
});

test('monthly: dayOfMonth bleibt, weekday wird verworfen', () => {
  const r = sanitizeStructured(aiRaw({ reminder: reminder({ at: '2026-10-01T09:00', recurrence: 'monthly', weekday: 3, day_of_month: 1 }) }) as any, input)!.reminder;
  expect(r).toEqual({ at: '2026-10-01T09:00', recurrence: 'monthly', weekday: null, dayOfMonth: 1 });
});

test('Kalender: 14 Tage ab heute mit Wochentag, auch ueber Monatsgrenzen', () => {
  const lines = buildCalendar('2026-09-24T10:00').split('\n');
  expect(lines).toHaveLength(14);
  expect(lines[0]).toBe('2026-09-24 Donnerstag (heute)');
  expect(lines[2]).toBe('2026-09-26 Samstag (uebermorgen)');
  expect(lines[7]).toBe('2026-10-01 Donnerstag');
});
