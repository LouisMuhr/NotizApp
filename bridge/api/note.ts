import { randomUUID } from 'node:crypto';
import { readEnv, setCors, bearerToken, sbHeaders, sha256, tierAtLeast, Tier } from './_lib/supabaseAdmin';

/**
 * Bookmarklet-Endpunkt. Auth ueber den persoenlichen Bookmarklet-Schluessel
 * (?token= oder Authorization: Bearer), der per SHA-256-Hash auf genau ein
 * profiles-Row zeigt. Die Ziel-User-ID ergibt sich aus dem Schluessel —
 * ein user_id im Body wird ignoriert (X1).
 */
async function resolveUserByToken(env: { SUPABASE_URL: string; SUPABASE_SERVICE_KEY: string }, token: string) {
  const r = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?bookmarklet_token_hash=eq.${sha256(token)}&select=id,tier`,
    { headers: sbHeaders(env.SUPABASE_SERVICE_KEY) },
  );
  if (!r.ok) return null;
  const rows: Array<{ id: string; tier: Tier }> = await r.json();
  return rows[0] ?? null;
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
    const SUPABASE_URL = env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY;

    const queryToken = req.query?.token;
    const token = bearerToken(req) ?? (typeof queryToken === 'string' ? queryToken : null);
    if (!token || token.length < 32) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const owner = await resolveUserByToken(env, token);
    if (!owner) {
      res.status(401).json({ error: 'unauthorized' });
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

    const title = String(body.title || '').slice(0, 200).trim();
    const content = String(body.content || '');
    if (!title && !content) {
      res.status(400).json({ error: 'title or content required' });
      return;
    }

    // Ziel-User kommt ausschliesslich aus dem Schluessel.
    const userId = owner.id;

    const checklist =
      Array.isArray(body.checklist) && body.checklist.length > 0
        ? body.checklist.map((text: string) => ({
            id: randomUUID(),
            text: String(text),
            checked: false,
          }))
        : [];

    const reminderAt =
      body.reminder_at && typeof body.reminder_at === 'string'
        ? body.reminder_at
        : null;
    const reminderRecurrence =
      reminderAt && ['once', 'daily', 'weekly', 'monthly'].includes(body.reminder_recurrence)
        ? body.reminder_recurrence
        : 'once';

    const now = new Date().toISOString();
    const row = {
      id: randomUUID(),
      user_id: userId,
      title: title || 'Notiz aus Claude',
      content,
      category: body.category || 'Allgemein',
      is_pinned: false,
      feeds_threads: Boolean(body.feeds_threads),
      checklist,
      created_at: now,
      updated_at: now,
      reminder_at: reminderAt,
      reminder_recurrence: reminderRecurrence,
      reminder_weekday: null,
      reminder_day_of_month: null,
      source: 'bookmarklet',
    };

    const r = await fetch(`${SUPABASE_URL}/rest/v1/notes`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
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
