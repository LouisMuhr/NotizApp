// Kern von POST /api/notes, ohne Next-Abhängigkeiten (testbar aus dem Repo-Root).
import { validateDraft, type NoteDraft, type NoteError } from './noteDraft';

/** Der Teil des Supabase-Clients, den das Anlegen braucht (im Test ein Fake). */
export interface NotesDb {
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null }; error: unknown }> };
  from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export type CreateResult = { status: 201; id: string } | { status: 400 | 401 | 500 | 503; error: NoteError };

/**
 * Supabase nicht erreichbar (Server offline, DNS, Timeout) — kein Anmeldeproblem. supabase-js meldet das
 * als AuthRetryableFetchError (Status 0) bzw. als PostgREST-Fehler mit „fetch failed".
 */
export function isNetworkError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const x = e as { name?: string; status?: number; message?: string; details?: string };
  return x.name === 'AuthRetryableFetchError' || x.status === 0
    || /fetch failed|network|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN/i.test(`${x.message ?? ''} ${x.details ?? ''}`);
}

export async function createNote(db: NotesDb, body: unknown, now = new Date()): Promise<CreateResult> {
  const { data: { user }, error: userErr } = await db.auth.getUser();
  if (isNetworkError(userErr)) return { status: 503, error: 'network' };
  if (userErr || !user) return { status: 401, error: 'unauthorized' };

  const d = (body ?? {}) as Partial<NoteDraft>;
  const invalid = validateDraft(d, now);
  if (invalid) return { status: 400, error: invalid };

  const stamp = now.toISOString();
  const r = d.reminder ?? null;
  const row: Record<string, unknown> = {
    id: crypto.randomUUID(),
    user_id: user.id,
    title: (d.title ?? '').trim(),
    content: (d.content ?? '').trim(),
    category: typeof d.category === 'string' && d.category.trim() ? d.category.trim() : 'Allgemein',
    feeds_threads: d.includeInThreads !== false,
    created_at: stamp,
    updated_at: stamp,
    // Klingeln tut die Erinnerung nur auf dem Handy: die App plant sie, sobald die Notiz ankommt.
    reminder_at: r?.reminder_at ?? null,
    reminder_recurrence: r?.reminder_recurrence ?? 'once',
    reminder_weekday: r?.reminder_weekday ?? null,
    reminder_day_of_month: r?.reminder_day_of_month ?? null,
  };

  const { data: noteRow, error: noteErr } = await db.from('notes').insert(row).select('id').single();
  if (noteErr || !noteRow) {
    console.error('Note insert error:', noteErr); // Details nur ins Log, nach außen ein Code
    return isNetworkError(noteErr) ? { status: 503, error: 'network' } : { status: 500, error: 'internal' };
  }

  // Fester Thread gewählt: Notiz dort einhängen (RLS greift, trotzdem explizit nach user_id filtern)
  if (typeof d.threadId === 'string' && d.threadId) {
    const { data: thread } = await db.from('threads').select('note_ids').eq('id', d.threadId).eq('user_id', user.id).maybeSingle();
    if (thread) {
      const ids: string[] = thread.note_ids ?? [];
      const { error: tErr } = await db.from('threads')
        .update({ note_ids: [...ids, noteRow.id], updated_at: stamp })
        .eq('id', d.threadId).eq('user_id', user.id);
      if (tErr) console.error('Thread update error:', tErr); // Notiz existiert; die Synthese sortiert sie sonst ein
    }
  }
  return { status: 201, id: noteRow.id };
}
