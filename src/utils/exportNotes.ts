import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Note } from '../models/Note';
import { Thread } from '../models/Thought';
import { getSupabase } from '../sync/supabaseClient';

/**
 * Kontodaten fuer den Export (Art. 15/20 DSGVO): was ausser den Notizen ueber den Nutzer
 * gespeichert ist. Ohne Konto bzw. offline `null` — der Export laeuft trotzdem.
 */
export async function loadAccountExport(): Promise<Record<string, unknown> | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user || user.is_anonymous) return null;
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier, created_at, ai_last_run, ai_runs_today, ai_day_reset, voice_ai_runs_today, voice_ai_day_reset')
      .eq('id', user.id)
      .maybeSingle();
    return {
      id: user.id,
      email: user.email ?? null,
      emailConfirmedAt: user.email_confirmed_at ?? null,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at ?? null,
      metadata: user.user_metadata ?? {},
      profile: profile ?? null,
    };
  } catch {
    return null;
  }
}

export async function exportNotesAsJson(
  notes: Note[],
  archivedNotes: Note[],
  threads: Thread[],
  account: Record<string, unknown> | null = null,
): Promise<void> {
  const payload = {
    exportedAt: new Date().toISOString(),
    account,
    notes,
    archivedNotes,
    threads,
  };

  const json = JSON.stringify(payload, null, 2);
  const path = FileSystem.cacheDirectory + 'notizapp-export.json';
  await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Teilen wird auf diesem Gerät nicht unterstützt.');
  }

  await Sharing.shareAsync(path, {
    mimeType: 'application/json',
    dialogTitle: 'Notizen exportieren',
    UTI: 'public.json',
  });
}
