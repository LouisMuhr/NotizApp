import { randomUUID } from 'node:crypto';
import { readEnv, setCors, bearerToken, sbHeaders, tierAtLeast, verifyToken, fetchProfile } from './_lib/supabaseAdmin.js';
import type { Env, Tier } from './_lib/supabaseAdmin.js';

/**
 * Bookmarklet-Endpunkt, aufgerufen vom Speichern-Fenster der Webapp.
 *   POST /api/note   Authorization: Bearer <Supabase-Access-Token>
 * Die Ziel-User-ID ergibt sich ausschliesslich aus dem Token — ein user_id im Body wird ignoriert (X1).
 */
const DAILY_LIMIT = 50;
const TITLE_MAX = 200;
const CONTENT_MAX = 50_000;
const CATEGORY_MAX = 50;
const RECURRENCES = ['once', 'daily', 'weekly', 'monthly'];

/** Heute (UTC) per Bookmarklet angelegte Notizen; null, wenn die Zaehlung fehlschlaegt. */
async function countToday(env: Env, uid: string): Promise<number | null> {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const r = await fetch(
    `${env.SUPABASE_URL}/rest/v1/notes?user_id=eq.${encodeURIComponent(uid)}&source=eq.bookmarklet` +
      `&created_at=gte.${encodeURIComponent(dayStart.toISOString())}&select=id`,
    { method: 'HEAD', headers: { ...sbHeaders(env.SUPABASE_SERVICE_KEY, 'count=exact'), Range: '0-0' } },
  );
  if (!r.ok) return null;
  const total = Number(r.headers.get('content-range')?.split('/')[1]);
  return Number.isFinite(total) ? total : null;
}

export default async function handler(req: any, res: any) {
  try {
    setCors(res);
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'method not allowed' });
      return;
    }

    const env = readEnv();
    if (!env) {
      res.status(500).json({ error: 'missing env' });
      return;
    }

    const token = bearerToken(req);
    const user = token ? await verifyToken(env, token) : null;
    if (!user) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    if (user.is_anonymous) {
      res.status(403).json({ error: 'account_required' });
      return;
    }
    const owner = await fetchProfile(env, user.id);
    if (!owner) {
      res.status(503).json({ error: 'profile_unavailable' });
      return;
    }
    const minTier = (process.env.BOOKMARKLET_MIN_TIER ?? 'basic') as Tier;
    if (!tierAtLeast(owner.tier, minTier)) {
      res.status(403).json({ error: 'tier_required', min_tier: minTier });
      return;
    }

    let body: any;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
      res.status(400).json({ error: 'invalid json' });
      return;
    }
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'missing body' });
      return;
    }

    const title = (typeof body.title === 'string' ? body.title : '').trim().slice(0, TITLE_MAX);
    const content = typeof body.content === 'string' ? body.content : '';
    if (!title && !content) {
      res.status(400).json({ error: 'title or content required' });
      return;
    }
    if (content.length > CONTENT_MAX) {
      res.status(413).json({ error: 'content_too_long', max: CONTENT_MAX });
      return;
    }
    const category = (typeof body.category === 'string' ? body.category : '').trim().slice(0, CATEGORY_MAX) || 'Allgemein';

    let reminderAt: string | null = null;
    if (body.reminder_at !== undefined && body.reminder_at !== null && body.reminder_at !== '') {
      const d = typeof body.reminder_at === 'string' ? new Date(body.reminder_at) : null;
      if (!d || Number.isNaN(d.getTime())) {
        res.status(400).json({ error: 'invalid_reminder' });
        return;
      }
      reminderAt = d.toISOString();
    }
    const reminderRecurrence = reminderAt && RECURRENCES.includes(body.reminder_recurrence) ? body.reminder_recurrence : 'once';

    const usedToday = await countToday(env, owner.id);
    if (usedToday === null) {
      res.status(500).json({ error: 'internal' });
      return;
    }
    if (usedToday >= DAILY_LIMIT) {
      res.status(429).json({ error: 'rate_limited', limit: DAILY_LIMIT });
      return;
    }

    const now = new Date().toISOString();
    const row = {
      id: randomUUID(),
      user_id: owner.id,
      title: title || 'Notiz aus Bookmarklet',
      content,
      category,
      is_pinned: false,
      feeds_threads: Boolean(body.feeds_threads),
      checklist: [],
      created_at: now,
      updated_at: now,
      reminder_at: reminderAt,
      reminder_recurrence: reminderRecurrence,
      reminder_weekday: null,
      reminder_day_of_month: null,
      source: 'bookmarklet',
    };

    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/notes`, {
      method: 'POST',
      headers: sbHeaders(env.SUPABASE_SERVICE_KEY, 'return=minimal'),
      body: JSON.stringify(row),
    });
    if (!r.ok) {
      console.error('[note] insert failed', r.status, await r.text().catch(() => ''));
      res.status(500).json({ error: 'internal' });
      return;
    }
    res.status(200).json({ ok: true, id: row.id });
  } catch (e: any) {
    console.error('[note] crash', e?.message || e);
    try {
      res.status(500).json({ error: 'internal' });
    } catch {
      res.status(500).end('internal');
    }
  }
}
