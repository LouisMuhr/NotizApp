import { ensureAuth } from './supabaseClient';

let cached: string | null = null;
let inflight: Promise<string | null> | null = null;

export async function getUserId(): Promise<string | null> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = ensureAuth().then((id) => {
    if (id) cached = id;
    inflight = null;
    return id;
  });
  return inflight;
}

export function clearUserIdCache(): void {
  cached = null;
  inflight = null;
}
