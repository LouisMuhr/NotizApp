import { getSupabase } from './supabaseClient';
import { getSyncUserId } from './accountState';
import {
  isBillingAvailable,
  ProPlan,
  purchasePro,
  PurchaseOutcome,
  restoreStorePurchases,
  RestoreOutcome,
  syncTierWithServer,
} from './billing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 'basic' ist eine Altlast (nicht mehr kaufbar), der Server kann ihn aber noch liefern. */
export type Tier = 'free' | 'basic' | 'pro';

/** Pro-Synthesen pro UTC-Tag. Muss zu bridge/api/synthesize.ts passen (der Server entscheidet). */
export const PRO_SYNTHESES_PER_DAY = 3;

export interface ProfileRow {
  id: string;
  tier: Tier;
  ai_last_run: string | null;
  ai_runs_today: number;
  ai_day_reset: string | null;
  created_at: string;
}

/** Ergebnis eines Kauf-/Wiederherstellungs-Versuchs; die UI zeigt dazu den passenden Dialog. */
export type BillingPrecondition = 'unavailable' | 'needs_account';
export interface UpgradeResult {
  kind: BillingPrecondition | PurchaseOutcome;
  /** true = Bridge hat den neuen Tier schon bestaetigt; false = kommt mit dem Webhook nach. */
  synced?: boolean;
}
export interface RestoreResult {
  kind: BillingPrecondition | RestoreOutcome;
  synced?: boolean;
}

// ---------------------------------------------------------------------------
// Abstract interface
// ---------------------------------------------------------------------------

export interface SubscriptionService {
  /** Returns the user's current tier (defaults to 'free' if unavailable). */
  getCurrentTier(): Promise<Tier>;

  /**
   * Returns the earliest Date at which the next synthesis run is allowed,
   * or null if a run is allowed right now.
   */
  getNextAllowedAt(): Promise<Date | null>;

  /** Fetches both tier and nextAllowedAt in one Supabase round-trip. */
  getStatus(): Promise<{ tier: Tier; nextAllowedAt: Date | null }>;

  /** Startet den Pro-Kauf (Google Play via RevenueCat) und gleicht danach den Tier ab. */
  openUpgradeFlow(plan: ProPlan): Promise<UpgradeResult>;

  /** Stellt Store-Abos wieder her (Geraetewechsel, Neuinstallation) und gleicht den Tier ab. */
  restorePurchases(): Promise<RestoreResult>;
}

// ---------------------------------------------------------------------------
// Helper: calculate nextAllowedAt from a profile row
// ---------------------------------------------------------------------------

/**
 * Berechnet die Sperr-Grenze ausschliesslich aus den Server-Feldern des Profils
 * (Entscheidung 14). Es wird NICHT gegen die Geraeteuhr verglichen: eine falsch
 * gestellte Uhr aendert das Ergebnis nicht. Ob die Grenze schon vorbei ist,
 * entscheidet die UI — endgueltig entscheidet immer der Server (429).
 *
 * Liegt die Grenze in der Vergangenheit, darf sie als "verfuegbar" gelten.
 */
export function computeNextAllowedAt(profile: Pick<ProfileRow, 'tier' | 'ai_last_run' | 'ai_runs_today' | 'ai_day_reset'>): Date | null {
  const { tier, ai_last_run, ai_runs_today, ai_day_reset } = profile;

  if (tier === 'pro') {
    if (ai_day_reset && ai_runs_today >= PRO_SYNTHESES_PER_DAY) {
      const midnight = new Date(ai_day_reset); // 'YYYY-MM-DD' → 00:00 UTC
      midnight.setUTCDate(midnight.getUTCDate() + 1);
      return midnight;
    }
    return null;
  }

  if (!ai_last_run) return null; // never run → always allowed
  const lastRun = new Date(ai_last_run);

  if (tier === 'free') return new Date(lastRun.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (tier === 'basic') return new Date(lastRun.getTime() + 24 * 60 * 60 * 1000);
  return null;
}

// ---------------------------------------------------------------------------
// Supabase-only implementation
// ---------------------------------------------------------------------------

export class SupabaseOnlySubscription implements SubscriptionService {
  private async fetchProfile(): Promise<ProfileRow | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    // getSession liest lokal; getUser wuerde offline "kein Nutzer" melden und
    // einen Pro-Nutzer zum Free-Nutzer machen.
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const user = session?.user;
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      // Nur "Zeile fehlt" (Trigger noch nicht gelaufen) gilt als free. Jeder andere
      // Fehler (Netz, Server) heisst "unbekannt": werfen, damit der Aufrufer den
      // zuletzt bestaetigten Tier behaelt.
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data as ProfileRow;
  }

  async getCurrentTier(): Promise<Tier> {
    const profile = await this.fetchProfile();
    return (profile?.tier as Tier) ?? 'free';
  }

  async getNextAllowedAt(): Promise<Date | null> {
    const profile = await this.fetchProfile();
    if (!profile) return null;
    return computeNextAllowedAt(profile);
  }

  async getStatus(): Promise<{ tier: Tier; nextAllowedAt: Date | null }> {
    const profile = await this.fetchProfile();
    if (!profile) return { tier: 'free', nextAllowedAt: null };
    return {
      tier: (profile.tier as Tier) ?? 'free',
      nextAllowedAt: computeNextAllowedAt(profile),
    };
  }

  /** Bestaetigtes Konto + Session, sonst null. Abos haengen an der Supabase-UID. */
  private async billingUser(): Promise<{ uid: string; token: string } | null> {
    const uid = await getSyncUserId();
    const supabase = getSupabase();
    if (!uid || !supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || session.user.id !== uid) return null;
    return { uid, token: session.access_token };
  }

  async openUpgradeFlow(plan: ProPlan): Promise<UpgradeResult> {
    if (!isBillingAvailable()) return { kind: 'unavailable' };
    const user = await this.billingUser();
    if (!user) return { kind: 'needs_account' };
    const outcome = await purchasePro(user.uid, plan);
    if (outcome !== 'purchased' && outcome !== 'already_owned') return { kind: outcome };
    const tier = await syncTierWithServer(user.token);
    return { kind: outcome, synced: tier !== null };
  }

  async restorePurchases(): Promise<RestoreResult> {
    if (!isBillingAvailable()) return { kind: 'unavailable' };
    const user = await this.billingUser();
    if (!user) return { kind: 'needs_account' };
    const outcome = await restoreStorePurchases(user.uid);
    if (outcome !== 'restored') return { kind: outcome };
    const tier = await syncTierWithServer(user.token);
    return { kind: outcome, synced: tier !== null };
  }
}

// ---------------------------------------------------------------------------
// Singleton — import this everywhere
// ---------------------------------------------------------------------------

export const subscriptionService: SubscriptionService = new SupabaseOnlySubscription();
