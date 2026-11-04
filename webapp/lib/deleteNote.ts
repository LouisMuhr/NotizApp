// Kern von DELETE /api/notes/[id], ohne Next-Abhängigkeiten (testbar aus dem Repo-Root).
import { isNetworkError, type NotesDb } from './createNote';

export type DeleteError = 'unauthorized' | 'not_found' | 'network' | 'internal';
export type DeleteResult = { status: 200 } | { status: 400 | 401 | 404 | 500 | 503; error: DeleteError | 'invalid' };

/**
 * Notiz endgültig löschen. RLS greift, trotzdem wird jede Abfrage explizit nach `user_id` gefiltert.
 * Erst die Notiz, dann die Thread-Verweise: scheitert das Aufräumen, bleibt nur eine tote ID im Thread
 * (der Graph ignoriert sie) — umgekehrt stünde eine Notiz ohne Thread da, die die Synthese neu einsortiert.
 */
export async function deleteNote(db: NotesDb, id: string | undefined): Promise<DeleteResult> {
  const { data: { user }, error: userErr } = await db.auth.getUser();
  if (isNetworkError(userErr)) return { status: 503, error: 'network' };
  if (userErr || !user) return { status: 401, error: 'unauthorized' };
  if (!id) return { status: 400, error: 'invalid' };

  const { data: deleted, error: delErr } = await db.from('notes').delete().eq('id', id).eq('user_id', user.id).select('id');
  if (delErr) {
    console.error('Note delete error:', delErr); // Details nur ins Log
    return isNetworkError(delErr) ? { status: 503, error: 'network' } : { status: 500, error: 'internal' };
  }
  if (!deleted?.length) return { status: 404, error: 'not_found' };

  const { data: threads, error: thErr } = await db.from('threads').select('id, note_ids').eq('user_id', user.id).contains('note_ids', [id]);
  if (thErr) { console.error('Thread lookup error:', thErr); return { status: 200 }; }
  const stamp = new Date().toISOString();
  for (const t of (threads ?? []) as Array<{ id: string; note_ids: string[] | null }>) {
    const { error } = await db.from('threads')
      .update({ note_ids: (t.note_ids ?? []).filter(n => n !== id), updated_at: stamp })
      .eq('id', t.id).eq('user_id', user.id);
    if (error) console.error('Thread cleanup error:', error);
  }
  return { status: 200 };
}
