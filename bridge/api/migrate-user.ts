/**
 * POST /api/migrate-user
 *   Authorization: Bearer <Access-Token des Ziel-Kontos>
 *   Body: { fromToken: "<Access-Token des anonymen Users>" }
 *
 * Haengt alle Daten des anonymen Users an das Konto. Beide Identitaeten
 * werden ueber ihre Tokens verifiziert — es gibt keinen Admin-Token und
 * keine frei waehlbaren UIDs mehr (X1). Die Migration laeuft als eine
 * Postgres-Transaktion (RPC migrate_user), damit kein Teilzustand entsteht (A1).
 */
import { readEnv, setCors, bearerToken, verifyToken, sbHeaders } from './_lib/supabaseAdmin';

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }

  const env = readEnv();
  if (!env) { res.status(500).json({ error: 'missing env' }); return; }

  const toToken = bearerToken(req);
  if (!toToken) { res.status(401).json({ error: 'unauthorized' }); return; }
  const body = typeof req.body === 'string' ? safeJson(req.body) : (req.body ?? {});
  const fromToken = body?.fromToken;
  if (typeof fromToken !== 'string' || !fromToken) { res.status(400).json({ error: 'missing fromToken' }); return; }

  const [toUser, fromUser] = await Promise.all([verifyToken(env, toToken), verifyToken(env, fromToken)]);
  if (!toUser || !fromUser) { res.status(401).json({ error: 'unauthorized' }); return; }
  if (!fromUser.is_anonymous) { res.status(403).json({ error: 'source must be anonymous' }); return; }
  if (toUser.is_anonymous) { res.status(403).json({ error: 'target must be an account' }); return; }
  if (fromUser.id === toUser.id) { res.status(400).json({ error: 'same user' }); return; }

  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/migrate_user`, {
    method: 'POST',
    headers: sbHeaders(env.SUPABASE_SERVICE_KEY),
    body: JSON.stringify({ from_uid: fromUser.id, to_uid: toUser.id }),
  });
  if (!r.ok) {
    console.error('[migrate-user] rpc failed', r.status, await r.text().catch(() => ''));
    res.status(500).json({ ok: false, error: 'migration_failed' });
    return;
  }
  const moved = await r.json().catch(() => ({}));
  // results: 1 = Tabelle vollstaendig migriert (Vertrag mit dem Client, der aeltere
  // Bridge-Versionen mit Teilfehlern noch erkennen soll).
  res.status(200).json({
    ok: true,
    results: { notes: 1, thoughts: 1, threads: 1, profiles: 1 },
    moved,
  });
}

function safeJson(s: string): any {
  try { return JSON.parse(s); } catch { return {}; }
}
