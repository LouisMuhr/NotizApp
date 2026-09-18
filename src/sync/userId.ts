import { getSyncUserId } from './accountState';

let cached: string | null = null;
let inflight: Promise<string | null> | null = null;

/**
 * UID fuer den Sync — null, solange kein bestaetigtes Konto existiert.
 *
 * Legt im Gegensatz zu frueher NIE einen User an: im Zustand `local` und
 * `pending-confirmation` liefert die Funktion null, und die Aufrufer bleiben
 * damit vollstaendig offline.
 */
export async function getUserId(): Promise<string | null> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = getSyncUserId().then((id) => {
    if (id) cached = id;
    inflight = null;
    return id;
  }).catch((e) => {
    inflight = null;
    throw e;
  });
  return inflight;
}

export function clearUserIdCache(): void {
  cached = null;
  inflight = null;
}
