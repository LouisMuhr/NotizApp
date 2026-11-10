/**
 * POST /api/billing-webhook
 *   Authorization: <REVENUECAT_WEBHOOK_AUTH> (im RevenueCat-Dashboard hinterlegt)
 *
 * Jedes RevenueCat-Ereignis (Kauf, Verlaengerung, Kuendigung, Ablauf,
 * Transfer, …) loest nur einen Abgleich der betroffenen User aus — der
 * Ereignis-Inhalt selbst entscheidet nichts (siehe _lib/billing.ts).
 * Fehler → 500, damit RevenueCat das Ereignis erneut zustellt.
 */
import { timingSafeEqual } from 'node:crypto';
import { readEnv } from './_lib/supabaseAdmin.js';
import { isSupabaseUid, readBillingSecret, syncUserTier } from './_lib/billing.js';

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }

  const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
  const env = readEnv();
  const secret = readBillingSecret();
  if (!expected || !env || !secret) { res.status(500).json({ error: 'missing env' }); return; }

  const got = req.headers?.['authorization'] ?? req.headers?.['Authorization'] ?? '';
  if (typeof got !== 'string' || !safeEqual(got, expected)) { res.status(401).json({ error: 'unauthorized' }); return; }

  const event = req.body?.event;
  if (!event || typeof event !== 'object') { res.status(400).json({ error: 'bad_request' }); return; }
  if (event.type === 'TEST') { res.status(200).json({ ok: true }); return; }

  const candidates: unknown[] = [
    event.app_user_id,
    event.original_app_user_id,
    ...(Array.isArray(event.aliases) ? event.aliases : []),
    ...(Array.isArray(event.transferred_from) ? event.transferred_from : []),
    ...(Array.isArray(event.transferred_to) ? event.transferred_to : []),
  ];
  const uids = [...new Set(candidates.filter(isSupabaseUid))];

  try {
    for (const uid of uids) await syncUserTier({ ...env, REVENUECAT_SECRET_KEY: secret }, uid);
  } catch (e) {
    console.error('[billing-webhook] sync failed', event.type, e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'internal' });
    return;
  }
  res.status(200).json({ ok: true, synced: uids.length });
}
