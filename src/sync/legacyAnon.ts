import { getSupabase } from './supabaseClient';
import { clearUserIdCache } from './userId';
import { isLegacyAnonymous } from './accountState';

/**
 * Altlast aus dem frueheren Modell aufraeumen, in dem die App beim ersten
 * Start ungefragt einen anonymen Supabase-User angelegt hat.
 *
 * Findet sich beim Start eine anonyme Session, wird sie NUR beendet — der
 * Remote-User bleibt bestehen. Die Notizen liegen durch den bisherigen
 * bidirektionalen Sync ohnehin lokal vor, das Geraet verliert also nichts, und
 * nichts an diesem Schritt ist unwiderruflich.
 *
 * Die verwaisten anonymen User raeumt ein separates, manuell auszufuehrendes
 * SQL-Skript ab (scripts/cleanup-anon-users.sql) — bewusst mit Karenzzeit,
 * damit Geraete, die noch nicht aktualisiert haben, ihre Daten behalten.
 *
 * @returns true, wenn eine anonyme Altsession beendet wurde.
 */
export async function signOutLegacyAnonymous(): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!isLegacyAnonymous(user)) return false;
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.warn('[auth] legacy anon signOut failed', error.message);
      return false;
    }
    clearUserIdCache();
    return true;
  } catch (e) {
    console.warn('[auth] legacy anon cleanup failed', e);
    return false;
  }
}
