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

  const { uid } = req.body ?? {};
  if (!uid || typeof uid !== 'string') {
    res.status(400).json({ error: 'missing uid' });
    return;
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    res.status(response.status).json({ error: body });
    return;
  }

  res.status(200).json({ ok: true });
}
