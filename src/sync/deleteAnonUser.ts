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
