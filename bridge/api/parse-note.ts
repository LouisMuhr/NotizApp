/**
 * KI-Strukturierung diktierter Notizen (nur Pro).
 *
 *   POST /api/parse-note   Authorization: Bearer <User-JWT>
 *   Body: { transcript, title?, categories, localNow: "YYYY-MM-DDTHH:mm", locale }
 *   → 200 StructuredNote | 4xx/5xx { error }
 *
 * Limit: VOICE_AI_DAILY_LIMIT Laeufe pro UTC-Tag (profiles.voice_ai_runs_today /
 * voice_ai_day_reset). Der Lauf wird VOR dem KI-Call gebucht (Filter auf den
 * gelesenen Zaehlerstand, damit parallele Requests nicht beide durchrutschen) und
 * bei Fehlern auf unserer Seite zurueckgegeben. Das Diktat wird nie geloggt.
 */
import { readEnv, setCors, bearerToken, verifyToken, sbHeaders, tierAtLeast, Env, Tier } from './_lib/supabaseAdmin';
import { structureWithClaude, sanitizeStructured, ParseNoteAiError, ParseNoteInput } from './_lib/parseNoteAi';

export const VOICE_AI_DAILY_LIMIT = 30;

interface VoiceProfile {
  id: string;
  tier: Tier;
  voice_ai_runs_today: number | null;
  voice_ai_day_reset: string | null;
}

async function loadProfile(env: Env, uid: string): Promise<VoiceProfile | null | 'error'> {
  const r = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(uid)}&select=id,tier,voice_ai_runs_today,voice_ai_day_reset`,
    { headers: sbHeaders(env.SUPABASE_SERVICE_KEY) },
  );
  if (!r.ok) return 'error';
  const rows: VoiceProfile[] = await r.json();
  return rows[0] ?? null;
}

function runsToday(p: VoiceProfile, todayUtc: string): number {
  return p.voice_ai_day_reset === todayUtc ? p.voice_ai_runs_today ?? 0 : 0;
}

function nextUtcMidnight(todayUtc: string): string {
  const d = new Date(`${todayUtc}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

/** Bucht einen Lauf; true = fuer diesen Request reserviert. */
async function claimRun(env: Env, p: VoiceProfile, todayUtc: string): Promise<boolean> {
  const filter = [
    p.voice_ai_day_reset === null ? 'voice_ai_day_reset=is.null' : `voice_ai_day_reset=eq.${p.voice_ai_day_reset}`,
    p.voice_ai_runs_today === null ? 'voice_ai_runs_today=is.null' : `voice_ai_runs_today=eq.${p.voice_ai_runs_today}`,
  ].join('&');
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(p.id)}&${filter}`, {
    method: 'PATCH',
    headers: sbHeaders(env.SUPABASE_SERVICE_KEY, 'return=representation'),
    body: JSON.stringify({ voice_ai_runs_today: runsToday(p, todayUtc) + 1, voice_ai_day_reset: todayUtc }),
  });
  if (!r.ok) return false;
  const rows = await r.json();
  return Array.isArray(rows) && rows.length > 0;
}

/** Gibt den gebuchten Lauf zurueck (best effort). */
async function releaseRun(env: Env, p: VoiceProfile): Promise<void> {
  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(p.id)}`, {
      method: 'PATCH',
      headers: sbHeaders(env.SUPABASE_SERVICE_KEY, 'return=minimal'),
      body: JSON.stringify({ voice_ai_runs_today: p.voice_ai_runs_today, voice_ai_day_reset: p.voice_ai_day_reset }),
    });
  } catch {
    // Ein nicht zurueckgegebener Lauf ist aergerlich, aber harmlos.
  }
}

const LOCAL_NOW = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function readInput(body: any): ParseNoteInput | null {
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return null; }
  }
  if (!body || typeof body !== 'object') return null;
  const transcript = typeof body.transcript === 'string' ? body.transcript.trim() : '';
  if (!transcript || transcript.length > 4000) return null;
  if (typeof body.localNow !== 'string' || !LOCAL_NOW.test(body.localNow)) return null;
  const categories: string[] = Array.isArray(body.categories)
    ? body.categories.filter((c: unknown): c is string => typeof c === 'string' && c.length > 0 && c.length <= 60).slice(0, 50)
    : [];
  if (!categories.includes('Allgemein')) categories.unshift('Allgemein');
  return {
    transcript,
    title: typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '',
    categories,
    localNow: body.localNow,
    locale: body.locale === 'en' ? 'en' : 'de',
  };
}

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }

  const env = readEnv();
  if (!env || !process.env.ANTHROPIC_API_KEY) { res.status(500).json({ error: 'missing env' }); return; }

  const token = bearerToken(req);
  if (!token) { res.status(401).json({ error: 'unauthorized' }); return; }
  const user = await verifyToken(env, token);
  if (!user) { res.status(401).json({ error: 'unauthorized' }); return; }
  if (user.is_anonymous) { res.status(403).json({ error: 'account_required' }); return; }

  const input = readInput(req.body);
  if (!input) { res.status(400).json({ error: 'invalid_input' }); return; }

  try {
    const todayUtc = new Date().toISOString().slice(0, 10);
    let profile = await loadProfile(env, user.id);
    if (profile === 'error') { res.status(503).json({ error: 'profile_unavailable' }); return; }
    if (!profile || !tierAtLeast(profile.tier, 'pro')) { res.status(403).json({ error: 'plan_required' }); return; }

    // Buchen; bei Race einmal neu lesen und erneut versuchen.
    let claimed = false;
    for (let attempt = 0; attempt < 2 && !claimed; attempt++) {
      if (attempt > 0) {
        const fresh = await loadProfile(env, user.id);
        if (!fresh || fresh === 'error') break;
        profile = fresh;
      }
      if (runsToday(profile, todayUtc) >= VOICE_AI_DAILY_LIMIT) {
        res.status(429).json({ error: 'limit_reached', next_allowed_at: nextUtcMidnight(todayUtc) });
        return;
      }
      claimed = await claimRun(env, profile, todayUtc);
    }
    if (!claimed) { res.status(429).json({ error: 'busy' }); return; }

    let structured;
    try {
      const raw = await structureWithClaude(input);
      structured = sanitizeStructured(raw, input);
      if (!structured) throw new ParseNoteAiError('ai_response_invalid');
    } catch (e) {
      await releaseRun(env, profile);
      const code = e instanceof ParseNoteAiError ? e.code : 'internal';
      if (code === 'internal') console.error('[parse-note] failed', (e as Error)?.message);
      res.status(502).json({ error: code });
      return;
    }

    res.status(200).json(structured);
  } catch (e) {
    console.error('[parse-note] internal', (e as Error)?.message);
    res.status(500).json({ error: 'internal' });
  }
}
