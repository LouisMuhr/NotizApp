import { randomUUID } from 'node:crypto';

function setCors(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sbHeaders(serviceKey: string) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function sbGet(url: string, serviceKey: string, path: string) {
  const r = await fetch(`${url}/rest/v1/${path}`, { headers: sbHeaders(serviceKey) });
  if (!r.ok) throw new Error(`supabase GET ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function sbPost(url: string, serviceKey: string, path: string, body: any, prefer = 'return=minimal') {
  const r = await fetch(`${url}/rest/v1/${path}`, {
    method: 'POST',
    headers: { ...sbHeaders(serviceKey), Prefer: prefer },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`supabase POST ${path}: ${r.status} ${await r.text()}`);
}

async function sbPatch(url: string, serviceKey: string, path: string, body: any) {
  const r = await fetch(`${url}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: { ...sbHeaders(serviceKey), Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`supabase PATCH ${path}: ${r.status} ${await r.text()}`);
}

const SYSTEM_PROMPT = `Du bist ein Brainstorm-Synthese-Agent für die NotizApp.
Deine Aufgabe: Notizen (feed_notes) thematisch gruppieren und als "Threads" mit KI-generierten Zusammenfassungen ausgeben.

Du erhältst JSON mit:
- feed_notes: Notizen die verarbeitet werden sollen
- active_threads: bestehende aktive Threads (Titel, Summary, note_ids, updated_at)

Antworte NUR mit einem einzigen validen JSON-Objekt, ohne Markdown, ohne Erklärungen. Exaktes Format:
{
  "new_threads": [
    {
      "id": "<uuid-v4>",
      "title": "Titel (3-6 Worte, Deutsch)",
      "summary": "Fließtext 2-4 Sätze Deutsch",
      "note_ids": ["<note-id>"]
    }
  ],
  "thread_updates": [
    {
      "id": "<thread-id>",
      "summary": "Aktualisierte Summary",
      "note_ids": ["<alle bisherigen + neue note-ids>"]
    }
  ]
}

Regeln:
- Threads ohne neue Notiz seit >21 Tagen: als {"id":"...","status":"dormant","summary":"<unverändert>"} in thread_updates
- Notizen ≤14 Zeichen ohne Aussage (einzelnes Wort, "ok", "ja"): ignorieren
- Pro Notiz: A) passt zu bestehendem Thread → thread_updates; B) verwandt mit anderen neuen → neuer gemeinsamer Thread; C) isoliert → Single-Thread
- note_ids in thread_updates = VOLLSTÄNDIGE Liste (bestehende + neue)
- Summary: Deutsch, Fließtext, max. 4 Sätze, beschreibt das Thema sachlich
- UUIDs für neue Threads selbst generieren (Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)`;

export default async function handler(req: any, res: any) {
  try {
    setCors(res);
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !ANTHROPIC_API_KEY) {
      res.status(500).json({
        error: 'missing env',
        have: { SUPABASE_URL: !!SUPABASE_URL, SUPABASE_SERVICE_KEY: !!SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY: !!ANTHROPIC_API_KEY },
      });
      return;
    }

    // user_id aus Supabase JWT
    const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) { res.status(401).json({ error: 'missing auth token' }); return; }

    let userId: string;
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
      userId = payload.sub;
      if (!userId) throw new Error('no sub');
    } catch {
      res.status(401).json({ error: 'invalid token' }); return;
    }

    // Daten laden
    const uid = encodeURIComponent(userId);
    const [feedNotes, activeThreads] = await Promise.all([
      sbGet(SUPABASE_URL, SUPABASE_SERVICE_KEY,
        `notes?user_id=eq.${uid}&feeds_threads=eq.true&order=created_at.asc&select=id,title,content,created_at,updated_at`),
      sbGet(SUPABASE_URL, SUPABASE_SERVICE_KEY,
        `threads?user_id=eq.${uid}&status=eq.active&order=updated_at.desc&select=id,title,summary,thought_count,note_ids,updated_at`),
    ]);

    if (!feedNotes.length) {
      res.status(200).json({ message: 'no_feed_notes', threads_created: 0, threads_updated: 0 });
      return;
    }

    // Anthropic API
    const input = JSON.stringify({ feed_notes: feedNotes, active_threads: activeThreads });
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: input }],
      }),
    });

    if (!anthropicRes.ok) {
      res.status(500).json({ error: 'anthropic API: ' + anthropicRes.status + ' ' + await anthropicRes.text() });
      return;
    }

    const anthropicData: any = await anthropicRes.json();
    const rawText: string = anthropicData.content?.[0]?.text ?? '';

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.status(200).json({ message: 'no_feed_notes', threads_created: 0, threads_updated: 0 });
      return;
    }

    let synthesis: { new_threads?: any[]; thread_updates?: any[] };
    try {
      synthesis = JSON.parse(jsonMatch[0]);
    } catch (e: any) {
      res.status(500).json({ error: 'JSON parse error: ' + e.message, raw: rawText.slice(0, 300) });
      return;
    }

    // Ergebnisse schreiben
    const now = new Date().toISOString();
    let threads_created = 0;
    let threads_updated = 0;

    // Idempotenz: bestehende Titel
    const existing: any[] = await sbGet(SUPABASE_URL, SUPABASE_SERVICE_KEY, `threads?user_id=eq.${uid}&select=title`);
    const existingTitles = new Set(existing.map((t: any) => t.title));

    // Neue Threads
    const toInsert = (synthesis.new_threads ?? [])
      .filter((t: any) => !existingTitles.has(t.title))
      .map((t: any) => ({
        id: t.id ?? randomUUID(),
        user_id: userId,
        title: t.title,
        summary: t.summary ?? '',
        status: 'active',
        thought_count: (t.note_ids ?? []).length,
        note_ids: t.note_ids ?? [],
        last_synthesized_at: now,
        created_at: now,
        updated_at: now,
      }));

    if (toInsert.length > 0) {
      await sbPost(SUPABASE_URL, SUPABASE_SERVICE_KEY, 'threads', toInsert, 'resolution=merge-duplicates,return=minimal');
      threads_created = toInsert.length;
    }

    // Thread-Updates
    for (const u of synthesis.thread_updates ?? []) {
      const noteIds = u.note_ids ?? [];
      const patch: any = {
        user_id: userId,
        summary: u.summary,
        status: u.status ?? 'active',
        last_synthesized_at: now,
        updated_at: now,
      };
      if (noteIds.length > 0) { patch.note_ids = noteIds; patch.thought_count = noteIds.length; }
      await sbPatch(SUPABASE_URL, SUPABASE_SERVICE_KEY,
        `threads?user_id=eq.${uid}&id=eq.${encodeURIComponent(u.id)}`, patch);
      threads_updated++;
    }

    res.status(200).json({ ok: true, threads_created, threads_updated });
  } catch (e: any) {
    try { res.status(500).json({ error: 'crash: ' + (e?.message || String(e)) }); }
    catch { res.status(500).end('crash'); }
  }
}
