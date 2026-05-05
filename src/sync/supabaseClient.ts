import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: AsyncStorage,
      },
      realtime: { params: { eventsPerSecond: 5 } },
    });
  }
  return client;
}

export function isSyncConfigured(): boolean {
  return Boolean(url && anonKey);
}

export async function ensureAuth(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn('[auth] ensureAuth: supabase not configured');
    return null;
  }
  console.log('[auth] ensureAuth: checking existing session...');
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    console.log('[auth] existing user:', user.id, 'anon:', user.is_anonymous);
    return user.id;
  }
  console.log('[auth] no session, calling signInAnonymously...');
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.warn('[auth] signInAnonymously failed', error.message);
    return null;
  }
  console.log('[auth] signed in anonymously:', data.user?.id);
  return data.user?.id ?? null;
}
