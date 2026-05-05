import { ensureAuth } from './supabaseClient';

let cached: string | null = null;

export async function getUserId(): Promise<string | null> {
  if (cached) return cached;
  const id = await ensureAuth();
  if (id) cached = id;
  return id;
}

export function clearUserIdCache(): void {
  cached = null;
}
