export const BRIDGE_URL = process.env.EXPO_PUBLIC_BRIDGE_URL;

/** POST an die Bridge mit dem Supabase-Access-Token des Users. */
export async function bridgePost(
  path: string,
  accessToken: string,
  body?: object,
  signal?: AbortSignal,
): Promise<Response> {
  return fetch(`${BRIDGE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
}
