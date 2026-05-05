const BRIDGE_URL = process.env.EXPO_PUBLIC_BRIDGE_URL;
const BEARER = process.env.EXPO_PUBLIC_BRIDGE_BEARER;

export async function deleteAnonUser(uid: string): Promise<void> {
  if (!BRIDGE_URL || !BEARER) return;
  try {
    await fetch(`${BRIDGE_URL}/api/delete-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${BEARER}`,
      },
      body: JSON.stringify({ uid }),
    });
  } catch (e) {
    console.warn('[auth] deleteAnonUser failed', e);
  }
}
