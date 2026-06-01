import { Alert } from 'react-native';
import { getSupabase } from './supabaseClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Tier = 'free' | 'basic' | 'pro';

export interface ProfileRow {
  id: string;
  tier: Tier;
  ai_last_run: string | null;
  ai_runs_today: number;
  ai_day_reset: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Abstract interface — swap out implementation when RevenueCat/Stripe arrives
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

  /** Opens the upgrade flow for the given tier. Placeholder for now. */
  openUpgradeFlow(targetTier: 'basic' | 'pro'): Promise<void>;
}

// ---------------------------------------------------------------------------
// Helper: calculate nextAllowedAt from a profile row
// ---------------------------------------------------------------------------

function computeNextAllowedAt(profile: ProfileRow): Date | null {
  const now = new Date();
  const { tier, ai_last_run, ai_runs_today, ai_day_reset } = profile;

  if (!ai_last_run) return null; // never run → always allowed

  const lastRun = new Date(ai_last_run);

  if (tier === 'free') {
    const nextAllowed = new Date(lastRun.getTime() + 7 * 24 * 60 * 60 * 1000);
    return nextAllowed > now ? nextAllowed : null;
  }

  if (tier === 'basic') {
    const nextAllowed = new Date(lastRun.getTime() + 24 * 60 * 60 * 1000);
    return nextAllowed > now ? nextAllowed : null;
  }

  if (tier === 'pro') {
    const todayUtc = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
    if (ai_day_reset === todayUtc && ai_runs_today >= 10) {
      // Blocked until midnight UTC
      const midnight = new Date(todayUtc);
      midnight.setUTCDate(midnight.getUTCDate() + 1);
      return midnight;
    }
    return null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Supabase-only implementation
// ---------------------------------------------------------------------------

export class SupabaseOnlySubscription implements SubscriptionService {
  private async fetchProfile(): Promise<ProfileRow | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      // Row might not exist yet (Trigger not yet run) — treat as free
      console.warn('[subscription] profile fetch error:', error.message);
      return null;
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

  async openUpgradeFlow(targetTier: 'basic' | 'pro'): Promise<void> {
    const label = targetTier === 'basic' ? 'Basic' : 'Pro';
    Alert.alert(
      `Upgrade auf ${label}`,
      'Bezahl-Pläne sind in Kürze verfügbar. Bleib dran!',
      [{ text: 'OK' }],
    );
  }
}

// ---------------------------------------------------------------------------
// Singleton — import this everywhere
// ---------------------------------------------------------------------------

export const subscriptionService: SubscriptionService = new SupabaseOnlySubscription();
