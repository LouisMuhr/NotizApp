const BRIDGE_URL = process.env.EXPO_PUBLIC_BRIDGE_URL;
const BEARER = process.env.EXPO_PUBLIC_BRIDGE_BEARER;

async function bridgePost(path: string, body: object): Promise<void> {
  if (!BRIDGE_URL || !BEARER) return;
  await fetch(`${BRIDGE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${BEARER}`,
    },
    body: JSON.stringify(body),
  });
}

export async function migrateAndDeleteAnonUser(fromUid: string, toUid: string): Promise<void> {
  if (!BRIDGE_URL || !BEARER) return;
  try {
    await bridgePost('/api/migrate-user', { fromUid, toUid });
    await bridgePost('/api/delete-user', { uid: fromUid });
  } catch (e) {
    console.warn('[auth] migrateAndDeleteAnonUser failed', e);
  }
}

/**
 * DSGVO-Komplettlöschung: löscht den Auth-User (auth.users) inkl. E-Mail über
 * die Bridge-Admin-API. Durch `on delete cascade` im Schema verschwinden dabei
 * auch notes, thoughts, threads, thread_similarities und das profiles-Row.
 *
 * Wirft bei Fehlern, damit der Aufrufer den User nicht fälschlich als gelöscht
 * meldet (im Gegensatz zum fire-and-forget migrateAndDeleteAnonUser oben).
 */
export async function deleteAccountCompletely(uid: string): Promise<void> {
  if (!BRIDGE_URL || !BEARER) {
    throw new Error('Bridge ist nicht konfiguriert.');
  }
  const res = await fetch(`${BRIDGE_URL}/api/delete-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${BEARER}`,
    },
    body: JSON.stringify({ uid }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Account-Löschung fehlgeschlagen (${res.status}): ${body}`);
  }
}
