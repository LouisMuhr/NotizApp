import { supabase } from '@/lib/supabase';

export type Tier = 'free' | 'basic' | 'pro';

/** Tarif aus profiles; null = unbekannt (kein Profil oder Abfrage fehlgeschlagen). */
export async function fetchTier(userId: string): Promise<Tier | null> {
  const { data, error } = await supabase.from('profiles').select('tier').eq('id', userId).maybeSingle();
  if (error || !data) return null;
  return (data.tier as Tier | null) ?? 'free';
}

/** Gleiche Regel wie die Bridge (BOOKMARKLET_MIN_TIER, Default basic). */
export function hasBookmarklet(tier: Tier | null): boolean {
  return tier === 'basic' || tier === 'pro';
}
