function setCors(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const BEARER = process.env.MCP_BEARER_TOKEN;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !BEARER) {
    res.status(500).json({ error: 'missing env' });
    return;
  }

  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${BEARER}`) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const { fromUid, toUid } = req.body ?? {};
  if (!fromUid || !toUid || typeof fromUid !== 'string' || typeof toUid !== 'string') {
    res.status(400).json({ error: 'missing fromUid or toUid' });
    return;
  }

  const headers = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };

  const tables = ['notes', 'thoughts', 'threads'];
  const results: Record<string, number> = {};

  for (const table of tables) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?user_id=eq.${fromUid}`,
      { method: 'PATCH', headers, body: JSON.stringify({ user_id: toUid }) },
    );
    results[table] = r.ok ? 1 : 0;
  }

  // migrate thought_threads via thoughts that were migrated
  // (thought_threads has no user_id — it's linked via thought_id, no migration needed)

  res.status(200).json({ ok: true, results });
}
