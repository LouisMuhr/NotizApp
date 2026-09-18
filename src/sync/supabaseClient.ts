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
    // Abgelaufene/ungültige Sessions still verwerfen statt als ERROR zu loggen.
    // KEIN erneutes signOut() im SIGNED_OUT-Branch — das löst rekursiv ein
    // weiteres SIGNED_OUT-Event aus und kann eine Schleife erzeugen.
    client.auth.getSession().then(({ error }) => {
      if (error?.message?.includes('Refresh Token')) {
        client?.auth.signOut().catch(() => {});
      }
    });
  }
  return client;
}

export function isSyncConfigured(): boolean {
  return Boolean(url && anonKey);
}

/**
 * UID des angemeldeten Users — oder null, wenn keiner existiert.
 *
 * Es wird NIE ein User angelegt: der Default-Zustand der App ist `local`
 * (Notizen liegen ausschliesslich auf dem Geraet). Ein Supabase-User entsteht
 * ausschliesslich durch eine bewusste Registrierung im Konto-Screen.
 *
 * Liefert auch fuer einen noch unbestaetigten User eine UID. Ob damit
 * synchronisiert werden darf, entscheidet allein `resolveAccountState()` —
 * wer syncen will, fragt `getSyncUserId()` aus `accountState.ts`.
 */
export async function getExistingUserId(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}
