/**
 * Persoenlicher Bookmarklet-Schluessel (O5): ersetzt den globalen Admin-Token.
 *
 *   POST   /api/bookmarklet-token   Authorization: Bearer <User-JWT>  → { token }
 *   DELETE /api/bookmarklet-token   Authorization: Bearer <User-JWT>  → { ok }
 *
 * Es wird nur der SHA-256-Hash in profiles.bookmarklet_token_hash gespeichert;
 * der Klartext ist genau einmal in der Antwort sichtbar. Ein neuer POST macht
 * den alten Schluessel ungueltig. Freigabe ab Tier BOOKMARKLET_MIN_TIER
 * (Default: basic, Entscheidung 7).
 */
import { randomBytes } from 'node:crypto';
import { readEnv, setCors, bearerToken, verifyToken, sbHeaders, sha256, fetchProfile, tierAtLeast, Tier } from './_lib/supabaseAdmin';

export default async function handler(req: any, res: any) {
  setCors(res, 'POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST' && req.method !== 'DELETE') { res.status(405).json({ error: 'method not allowed' }); return; }

  const env = readEnv();
  if (!env) { res.status(500).json({ error: 'missing env' }); return; }

  const token = bearerToken(req);
  if (!token) { res.status(401).json({ error: 'unauthorized' }); return; }
  const user = await verifyToken(env, token);
  if (!user) { res.status(401).json({ error: 'unauthorized' }); return; }
  if (user.is_anonymous) { res.status(403).json({ error: 'account_required' }); return; }

  const plain = req.method === 'POST' ? randomBytes(32).toString('hex') : null;

  if (req.method === 'POST') {
    const minTier = (process.env.BOOKMARKLET_MIN_TIER ?? 'basic') as Tier;
    const profile = await fetchProfile(env, user.id);
    if (!profile) { res.status(503).json({ error: 'profile_unavailable' }); return; }
    if (!tierAtLeast(profile.tier, minTier)) { res.status(403).json({ error: 'tier_required', min_tier: minTier }); return; }
  }

  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, {
    method: 'PATCH',
    headers: sbHeaders(env.SUPABASE_SERVICE_KEY, 'return=minimal'),
    body: JSON.stringify({ bookmarklet_token_hash: plain ? sha256(plain) : null }),
  });
  if (!r.ok) {
    console.error('[bookmarklet-token] patch failed', r.status, await r.text().catch(() => ''));
    res.status(500).json({ error: 'internal' });
    return;
  }
  res.status(200).json(plain ? { ok: true, token: plain } : { ok: true });
}
