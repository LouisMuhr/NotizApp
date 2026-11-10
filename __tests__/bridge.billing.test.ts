/**
 * @jest-environment node
 *
 * Abo-Abgleich mit RevenueCat: Tier-Ableitung, Schutz von Hand-Tiers,
 * Webhook-Auth und dass nur dem RevenueCat-Stand geglaubt wird.
 */
import { tierFromEntitlements, decideTierUpdate } from '../bridge/api/_lib/billing';
import webhook from '../bridge/api/billing-webhook';
import billingSync from '../bridge/api/billing-sync';

const NOW = Date.parse('2026-11-10T12:00:00Z');
const FUTURE = '2026-12-10T12:00:00Z';
const PAST = '2026-11-01T12:00:00Z';

describe('tierFromEntitlements', () => {
  test('ohne Entitlements: free', () => {
    expect(tierFromEntitlements({}, NOW)).toEqual({ tier: 'free', expiresAt: null });
    expect(tierFromEntitlements(undefined, NOW).tier).toBe('free');
  });
  test('aktives Basic', () => {
    expect(tierFromEntitlements({ basic: { expires_date: FUTURE } }, NOW)).toEqual({
      tier: 'basic', expiresAt: new Date(FUTURE).toISOString(),
    });
  });
  test('abgelaufen zaehlt nicht, Kulanzfrist schon', () => {
    expect(tierFromEntitlements({ pro: { expires_date: PAST } }, NOW).tier).toBe('free');
    expect(tierFromEntitlements({ pro: { expires_date: PAST, grace_period_expires_date: FUTURE } }, NOW).tier).toBe('pro');
  });
  test('hoechster Tier gewinnt, unbekannte IDs werden ignoriert', () => {
    const r = tierFromEntitlements(
      { basic: { expires_date: FUTURE }, pro: { expires_date: FUTURE }, gold: { expires_date: null } },
      NOW,
    );
    expect(r.tier).toBe('pro');
  });
});

describe('decideTierUpdate', () => {
  const iso = new Date(NOW).toISOString();
  test('Hand-Tier wird von fehlendem Abo nie heruntergesetzt', () => {
    expect(decideTierUpdate({ tier: 'pro', tier_source: 'manual' }, { tier: 'free', expiresAt: null }, iso)).toBeNull();
    expect(decideTierUpdate({ tier: 'pro', tier_source: 'manual' }, { tier: 'basic', expiresAt: FUTURE }, iso)).toBeNull();
  });
  test('Kauf hebt free (manual) auf den Store-Tier', () => {
    expect(decideTierUpdate({ tier: 'free', tier_source: 'manual' }, { tier: 'basic', expiresAt: FUTURE }, iso)).toEqual({
      tier: 'basic', tier_source: 'revenuecat', tier_expires_at: FUTURE, billing_synced_at: iso,
    });
  });
  test('abgelaufenes Store-Abo faellt auf free zurueck', () => {
    expect(decideTierUpdate({ tier: 'pro', tier_source: 'revenuecat' }, { tier: 'free', expiresAt: null }, iso)?.tier).toBe('free');
  });
});

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

const SB = 'https://sb.test';
const UID = '11111111-2222-4333-8444-555555555555';
const OTHER = '99999999-2222-4333-8444-555555555555';
type Call = { url: string; method: string; body: any; headers: any };
let calls: Call[];
let rcEntitlements: Record<string, Record<string, any>>;
let profiles: Record<string, any>;

function jsonRes(status: number, body: any) {
  return { ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) };
}

beforeEach(() => {
  process.env.SUPABASE_URL = SB;
  process.env.SUPABASE_SERVICE_KEY = 'service';
  process.env.REVENUECAT_SECRET_KEY = 'rc-secret';
  process.env.REVENUECAT_WEBHOOK_AUTH = 'hook-secret';
  calls = [];
  rcEntitlements = {};
  profiles = {
    [UID]: { id: UID, tier: 'free', tier_source: 'manual' },
    [OTHER]: { id: OTHER, tier: 'basic', tier_source: 'revenuecat' },
  };
  (global as any).fetch = jest.fn(async (url: string, init: any = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body, headers: init.headers ?? {} });
    if (url.startsWith('https://api.revenuecat.com/v1/subscribers/')) {
      if (init.headers?.Authorization !== 'Bearer rc-secret') return jsonRes(401, {});
      const uid = decodeURIComponent(url.split('/').pop()!);
      return jsonRes(200, { subscriber: { entitlements: rcEntitlements[uid] ?? {} } });
    }
    if (url.startsWith(`${SB}/auth/v1/user`)) {
      return init.headers?.Authorization === 'Bearer user-tok'
        ? jsonRes(200, { id: UID, is_anonymous: false })
        : jsonRes(401, {});
    }
    if (url.startsWith(`${SB}/rest/v1/profiles`)) {
      const id = new URL(url).searchParams.get('id')!.replace('eq.', '');
      if (method === 'GET') return jsonRes(200, profiles[id] ? [profiles[id]] : []);
      if (method === 'PATCH') { profiles[id] = { ...profiles[id], ...body }; return jsonRes(204, null); }
    }
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

describe('POST /api/billing-webhook', () => {
  const hook = (auth: string | null, event: any) => ({
    method: 'POST', headers: auth ? { authorization: auth } : {}, body: { event },
  });

  test('falsches Secret → 401, nichts geschrieben', async () => {
    const res = mockRes();
    await webhook(hook('nope', { type: 'INITIAL_PURCHASE', app_user_id: UID }), res);
    expect(res.statusCode).toBe(401);
    expect(calls).toHaveLength(0);
  });

  test('Kauf-Ereignis: Tier kommt aus RevenueCat, nicht aus dem Ereignis', async () => {
    rcEntitlements[UID] = { basic: { expires_date: '2999-01-01T00:00:00Z' } };
    const res = mockRes();
    // Ereignis behauptet "pro" — massgeblich ist RevenueCat (basic).
    await webhook(hook('hook-secret', { type: 'INITIAL_PURCHASE', app_user_id: UID, entitlement_ids: ['pro'] }), res);
    expect(res.statusCode).toBe(200);
    expect(profiles[UID]).toMatchObject({ tier: 'basic', tier_source: 'revenuecat' });
  });

  test('Ablauf setzt Store-Abo auf free', async () => {
    const res = mockRes();
    await webhook(hook('hook-secret', { type: 'EXPIRATION', app_user_id: OTHER }), res);
    expect(profiles[OTHER].tier).toBe('free');
  });

  test('Transfer gleicht beide Konten ab, anonyme IDs werden ignoriert', async () => {
    rcEntitlements[UID] = { basic: { expires_date: '2999-01-01T00:00:00Z' } };
    const res = mockRes();
    await webhook(hook('hook-secret', {
      type: 'TRANSFER', transferred_from: [OTHER, '$RCAnonymousID:abc'], transferred_to: [UID],
    }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.synced).toBe(2);
    expect(profiles[UID].tier).toBe('basic');
    expect(profiles[OTHER].tier).toBe('free');
  });

  test('RevenueCat nicht erreichbar → 500 (Retry durch RevenueCat)', async () => {
    process.env.REVENUECAT_SECRET_KEY = 'wrong';
    const res = mockRes();
    await webhook(hook('hook-secret', { type: 'RENEWAL', app_user_id: UID }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/billing-sync', () => {
  const req = (auth: string | null) => ({ method: 'POST', headers: auth ? { authorization: `Bearer ${auth}` } : {} });

  test('ohne gueltiges Token → 401', async () => {
    const res = mockRes();
    await billingSync(req('bad'), res);
    expect(res.statusCode).toBe(401);
  });

  test('gleicht nur den Aufrufer ab und liefert den Tier', async () => {
    rcEntitlements[UID] = { pro: { expires_date: '2999-01-01T00:00:00Z' } };
    const res = mockRes();
    await billingSync(req('user-tok'), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, tier: 'pro' });
    expect(calls.filter((c) => c.method === 'PATCH').every((c) => c.url.includes(UID))).toBe(true);
  });

  test('ohne RevenueCat-Key → 503', async () => {
    delete process.env.REVENUECAT_SECRET_KEY;
    const res = mockRes();
    await billingSync(req('user-tok'), res);
    expect(res.statusCode).toBe(503);
  });
});
