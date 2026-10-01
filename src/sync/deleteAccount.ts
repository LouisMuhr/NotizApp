import { getSupabase } from './supabaseClient';
import { BRIDGE_URL, bridgePost } from './bridge';

/**
 * DSGVO-Komplettloeschung des aktuell angemeldeten Users (auth.users inkl.
 * E-Mail). Durch `on delete cascade` verschwinden notes, thoughts, threads,
 * thread_similarities und das profiles-Row.
 *
 * Wirft bei Fehlern, damit der Aufrufer den User nicht faelschlich als
 * geloescht meldet.
 */
export async function deleteAccountCompletely(): Promise<void> {
  if (!BRIDGE_URL) throw new Error('Bridge ist nicht konfiguriert.');
  const supabase = getSupabase();
  if (!supabase) throw new Error('Sync ist nicht konfiguriert.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Keine aktive Sitzung.');
  const res = await bridgePost('/api/delete-user', session.access_token);
  if (!res.ok) {
    throw new Error(`Account-Löschung fehlgeschlagen (${res.status})`);
  }
}
