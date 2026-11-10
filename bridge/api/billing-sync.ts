/**
 * POST /api/billing-sync
 *   Authorization: Bearer <Supabase-Access-Token>
 *
 * Die App ruft das direkt nach Kauf/Wiederherstellen auf, damit der neue Tier
 * nicht erst mit dem Webhook ankommt. Gleicht nur den Aufrufer ab; der Stand
 * kommt von RevenueCat, nicht aus der Anfrage.
 */
import { readEnv, setCors, bearerToken, verifyToken } from './_lib/supabaseAdmin.js';
import { readBillingSecret, syncUserTier } from './_lib/billing.js';

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }

  const env = readEnv();
  if (!env) { res.status(500).json({ error: 'missing env' }); return; }
  const secret = readBillingSecret();
  if (!secret) { res.status(503).json({ error: 'billing_unavailable' }); return; }

  const token = bearerToken(req);
  if (!token) { res.status(401).json({ error: 'unauthorized' }); return; }
  const user = await verifyToken(env, token);
  if (!user || user.is_anonymous) { res.status(401).json({ error: 'unauthorized' }); return; }

  try {
    const tier = await syncUserTier({ ...env, REVENUECAT_SECRET_KEY: secret }, user.id);
    if (tier === null) { res.status(404).json({ error: 'no_profile' }); return; }
    res.status(200).json({ ok: true, tier });
  } catch (e) {
    console.error('[billing-sync] failed', e instanceof Error ? e.message : e);
    res.status(502).json({ error: 'billing_unavailable' });
  }
}
