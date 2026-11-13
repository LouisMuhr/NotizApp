/**
 * Abo-Abgleich mit RevenueCat (Google Play Billing).
 *
 * Grundsatz: Wir glauben nie dem Inhalt eines Webhooks oder dem Client, sondern
 * fragen bei jedem Anlass RevenueCat selbst nach dem aktuellen Stand des Users
 * (`GET /v1/subscribers/{uid}`) und leiten daraus den Tier ab. Damit sind
 * doppelte, verspaetete oder vertauschte Webhooks harmlos.
 *
 * `profiles.tier_source` trennt Hand-Vergaben ('manual', z. B. Admin-/Testkonten)
 * von Store-Abos ('revenuecat'): Ein Store-Abgleich ueberschreibt einen
 * Hand-Tier nur, wenn das Abo hoeher ist — ein abgelaufenes oder fehlendes Abo
 * setzt einen Hand-Tier nie auf free zurueck.
 */
// '../_lib/' statt './': der Jest-Mapper biegt nur '…_lib/x.js'-Importe auf die .ts-Quelle um.
import { Env, sbHeaders, Tier } from '../_lib/supabaseAdmin.js';

/** Entitlement-IDs im RevenueCat-Dashboard → Tier. Verkauft wird nur noch pro (monatlich/jaehrlich); basic bleibt fuer Altbestand. */
export const ENTITLEMENT_TIER: Record<string, Tier> = { basic: 'basic', pro: 'pro' };

const RANK: Record<Tier, number> = { free: 0, basic: 1, pro: 2 };

export interface RcEntitlement {
  expires_date: string | null;
  grace_period_expires_date?: string | null;
  product_identifier?: string;
}

export interface StoreTier {
  tier: Tier;
  /** Ende des aktiven Entitlements (inkl. Kulanzfrist), null = unbefristet bzw. free. */
  expiresAt: string | null;
}

/** Hoechster aktiver Tier aus den Entitlements. Kulanzfrist (Zahlungsproblem) zaehlt als aktiv. */
export function tierFromEntitlements(
  entitlements: Record<string, RcEntitlement> | null | undefined,
  now: number,
): StoreTier {
  let best: StoreTier = { tier: 'free', expiresAt: null };
  for (const [id, ent] of Object.entries(entitlements ?? {})) {
    const tier = ENTITLEMENT_TIER[id];
    if (!tier || !ent) continue;
    const ends = [ent.expires_date, ent.grace_period_expires_date]
      .filter((d): d is string => typeof d === 'string' && d.length > 0)
      .map((d) => Date.parse(d))
      .filter((n) => Number.isFinite(n));
    const unlimited = ent.expires_date === null;
    const end = ends.length ? Math.max(...ends) : NaN;
    if (!unlimited && !(end > now)) continue;
    if (RANK[tier] > RANK[best.tier]) {
      best = { tier, expiresAt: unlimited ? null : new Date(end).toISOString() };
    }
  }
  return best;
}

export interface ProfileBilling {
  tier: Tier;
  tier_source: string | null;
}

export interface TierPatch {
  tier: Tier;
  tier_source: 'revenuecat';
  tier_expires_at: string | null;
  billing_synced_at: string;
}

/** null = Profil bleibt, wie es ist. */
export function decideTierUpdate(current: ProfileBilling, store: StoreTier, nowIso: string): TierPatch | null {
  const currentTier: Tier = RANK[current.tier] !== undefined ? current.tier : 'free';
  if (current.tier_source !== 'revenuecat' && RANK[store.tier] <= RANK[currentTier]) return null;
  return { tier: store.tier, tier_source: 'revenuecat', tier_expires_at: store.expiresAt, billing_synced_at: nowIso };
}

export interface BillingEnv extends Env {
  REVENUECAT_SECRET_KEY: string;
}

export function readBillingSecret(): string | null {
  return process.env.REVENUECAT_SECRET_KEY || null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Nur echte Supabase-UIDs; anonyme RevenueCat-IDs ($RCAnonymousID:…) haben kein Profil. */
export function isSupabaseUid(v: unknown): v is string {
  return typeof v === 'string' && UUID.test(v);
}

export class BillingError extends Error {}

async function fetchStoreTier(secret: string, uid: string, now: number): Promise<StoreTier> {
  const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`, {
    headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' },
  });
  if (!r.ok) throw new BillingError(`revenuecat ${r.status}`);
  const body: any = await r.json();
  return tierFromEntitlements(body?.subscriber?.entitlements, now);
}

/**
 * Gleicht den Tier eines Users mit RevenueCat ab und schreibt ihn ins Profil.
 * Liefert den Tier nach dem Abgleich, null wenn es kein Profil gibt.
 */
export async function syncUserTier(env: BillingEnv, uid: string, now = Date.now()): Promise<Tier | null> {
  const pr = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(uid)}&select=id,tier,tier_source`,
    { headers: sbHeaders(env.SUPABASE_SERVICE_KEY) },
  );
  if (!pr.ok) throw new BillingError(`profile read ${pr.status}`);
  const rows: any[] = await pr.json();
  const profile = rows[0];
  if (!profile) return null;

  const store = await fetchStoreTier(env.REVENUECAT_SECRET_KEY, uid, now);
  const patch = decideTierUpdate(profile, store, new Date(now).toISOString());
  if (!patch) return profile.tier as Tier;

  const w = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(uid)}`, {
    method: 'PATCH',
    headers: sbHeaders(env.SUPABASE_SERVICE_KEY, 'return=minimal'),
    body: JSON.stringify(patch),
  });
  if (!w.ok) throw new BillingError(`profile write ${w.status}`);
  return patch.tier;
}
