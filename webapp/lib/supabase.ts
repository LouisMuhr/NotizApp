import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Browser-seitiger Client (kein Auth-Kontext nötig — Session wird via Cookie/localStorage verwaltet) */
export const supabase = createClient(url, key);

/**
 * Server-seitiger Client, der den Supabase-JWT des eingeloggten Nutzers mitschickt.
 * Dadurch greifen die RLS-Policies ("own_notes", "own_threads" etc.) automatisch.
 */
export function createServerClient(accessToken: string) {
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  });
}
