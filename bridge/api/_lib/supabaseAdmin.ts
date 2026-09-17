/**
 * Gemeinsame Helfer fuer die Bridge-Endpunkte.
 * Dateien unter api/_lib werden von Vercel nicht als Functions deployt.
 */
import { createHash } from 'node:crypto';

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

export function readEnv(): Env | null {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  return { SUPABASE_URL, SUPABASE_SERVICE_KEY };
}

export function setCors(res: any, methods = 'POST, OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function bearerToken(req: any): string | null {
  const h = req.headers?.['authorization'] || req.headers?.['Authorization'] || '';
  return typeof h === 'string' && h.startsWith('Bearer ') ? h.slice(7) : null;
}

export function sbHeaders(serviceKey: string, prefer?: string) {
  const h: Record<string, string> = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (prefer) h.Prefer = prefer;
  return h;
}

export interface VerifiedUser {
  id: string;
  is_anonymous: boolean;
}

/**
 * Prueft ein Supabase-Access-Token beim Auth-Server (Signatur + Ablauf) und
 * liefert die User-ID. Kein lokaler Decode: dieser Code arbeitet mit dem
 * Service-Role-Key, RLS greift nicht — die Identitaet MUSS verifiziert sein.
 */
export async function verifyToken(env: Env, token: string): Promise<VerifiedUser | null> {
  try {
    const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const user: any = await r.json();
    if (typeof user?.id !== 'string' || !user.id) return null;
    return { id: user.id, is_anonymous: Boolean(user.is_anonymous) };
  } catch {
    return null;
  }
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export type Tier = 'free' | 'basic' | 'pro';
const TIER_RANK: Record<Tier, number> = { free: 0, basic: 1, pro: 2 };

export function tierAtLeast(tier: string | null | undefined, min: Tier): boolean {
  const t = (tier ?? 'free') as Tier;
  return (TIER_RANK[t] ?? 0) >= TIER_RANK[min];
}

export async function fetchProfile(env: Env, uid: string): Promise<{ id: string; tier: Tier } | null> {
  const r = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(uid)}&select=id,tier`,
    { headers: sbHeaders(env.SUPABASE_SERVICE_KEY) },
  );
  if (!r.ok) return null;
  const rows: any[] = await r.json();
  return rows[0] ?? null;
}
