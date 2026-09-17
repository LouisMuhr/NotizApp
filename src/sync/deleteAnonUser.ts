import { getSupabase } from './supabaseClient';

const BRIDGE_URL = process.env.EXPO_PUBLIC_BRIDGE_URL;

async function bridgePost(path: string, accessToken: string, body?: object): Promise<Response> {
  return fetch(`${BRIDGE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Daten des anonymen Users in das Konto uebernehmen und den anonymen User
 * danach loeschen. Beide Schritte weisen sich ueber die jeweiligen Access-Tokens
 * aus (kein Admin-Token mehr, X1).
 *
 * Der anonyme User wird NUR geloescht, wenn die Migration vollstaendig
 * bestaetigt wurde (A1) — sonst wuerde der Cascade seine Daten mitnehmen.
 *
 * @returns true, wenn Migration und Loeschung erfolgreich waren.
 */
export async function migrateAndDeleteAnonUser(anonAccessToken: string, accountAccessToken: string): Promise<boolean> {
  if (!BRIDGE_URL) return false;
  try {
    const res = await bridgePost('/api/migrate-user', accountAccessToken, { fromToken: anonAccessToken });
    if (!res.ok) {
      console.warn('[auth] migrate-user failed', res.status);
      return false;
    }
    const json: any = await res.json().catch(() => null);
    const results: Record<string, unknown> = json?.results ?? {};
    const complete =
      json?.ok === true &&
      Object.keys(results).length > 0 &&
      Object.values(results).every((v) => v === 1);
    if (!complete) {
      console.warn('[auth] migrate-user incomplete, anon user kept', json);
      return false;
    }

    const del = await bridgePost('/api/delete-user', anonAccessToken);
    if (!del.ok) {
      console.warn('[auth] delete anon user failed', del.status);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[auth] migrateAndDeleteAnonUser failed', e);
    return false;
  }
}

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
