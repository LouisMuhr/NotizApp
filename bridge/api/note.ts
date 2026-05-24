import { randomUUID } from 'node:crypto';

function setCors(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
    const BRIDGE_USER_ID = process.env.BRIDGE_USER_ID;
    const BEARER = process.env.MCP_BEARER_TOKEN;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !BRIDGE_USER_ID || !BEARER) {
      res.status(500).json({
        error: 'missing env',
        have: {
          SUPABASE_URL: !!SUPABASE_URL,
          SUPABASE_SERVICE_KEY: !!SUPABASE_SERVICE_KEY,
          BRIDGE_USER_ID: !!BRIDGE_USER_ID,
          MCP_BEARER_TOKEN: !!BEARER,
        },
      });
      return;
    }

    const headerAuth = req.headers['authorization'] || req.headers['Authorization'];
    const queryToken = req.query?.token;
    const ok =
      (headerAuth && headerAuth === `Bearer ${BEARER}`) ||
      (typeof queryToken === 'string' && queryToken === BEARER);
    if (!ok) {
      res.status(401).json({ error: 'unauthorized' });
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

    // user_id from body (bookmarklet sends it explicitly); fall back to env BRIDGE_USER_ID
    const userId = typeof body.user_id === 'string' && body.user_id.trim()
      ? body.user_id.trim()
      : BRIDGE_USER_ID;

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
      const txt = await r.text();
      res.status(500).json({ error: 'supabase ' + r.status + ': ' + txt });
      return;
    }
    res.status(200).json({ ok: true, id: row.id });
  } catch (e: any) {
    try {
      res.status(500).json({ error: 'crash: ' + (e?.message || String(e)) });
    } catch {
      res.status(500).end('crash');
    }
  }
}
