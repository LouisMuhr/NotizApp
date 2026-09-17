/**
 * POST /api/delete-user
 *   Authorization: Bearer <Access-Token des zu loeschenden Users>
 *
 * Loescht ausschliesslich den Aufrufer selbst (auth.users → Cascade auf alle
 * Tabellen). Kein Admin-Token, keine UID im Body (X1).
 */
import { readEnv, setCors, bearerToken, verifyToken } from './_lib/supabaseAdmin';

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }

  const env = readEnv();
  if (!env) { res.status(500).json({ error: 'missing env' }); return; }

  const token = bearerToken(req);
  if (!token) { res.status(401).json({ error: 'unauthorized' }); return; }
  const user = await verifyToken(env, token);
  if (!user) { res.status(401).json({ error: 'unauthorized' }); return; }

  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
    method: 'DELETE',
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` },
  });

  if (!response.ok) {
    console.error('[delete-user] admin delete failed', response.status, await response.text().catch(() => ''));
    res.status(500).json({ ok: false, error: 'delete_failed' });
    return;
  }
  res.status(200).json({ ok: true });
}
