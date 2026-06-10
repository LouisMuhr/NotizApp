import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { GraphData, Thread, Note, Similarity } from '@/types';

export const revalidate = 0; // kein statisches Caching — Daten sind nutzer-spezifisch

export async function GET(req: NextRequest) {
  const auth = req.headers.get('Authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServerClient(token);

  // User aus dem JWT auflösen und ALLE Queries explizit darauf filtern.
  // Nicht allein auf RLS verlassen — fehlende/permissive Policies haben fremde
  // Threads durchsickern lassen.
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = user.id;

  const [{ data: threadRows }, { data: noteRows }, { data: similarityRows }] = await Promise.all([
    supabase
      .from('threads')
      .select('id, title, summary, status, is_pinned, note_ids, last_synthesized_at, created_at, updated_at')
      .eq('user_id', userId)
      .eq('status', 'active'),
    supabase
      .from('notes')
      .select('id, title, content, category, created_at, updated_at')
      .eq('user_id', userId),
    supabase
      .from('thread_similarities')
      .select('id, thread_id_1, thread_id_2, label')
      .eq('user_id', userId),
  ]);

  const noteMap = new Map((noteRows ?? []).map((n: any) => [n.id, n]));

  const threads: Thread[] = [];
  const notes: Note[] = [];

  for (const row of threadRows ?? []) {
    threads.push({
      id: row.id,
      title: row.title,
      summary: row.summary ?? '',
      status: row.status,
      isPinned: row.is_pinned ?? false,
      noteCount: (row.note_ids ?? []).length,
      noteIds: row.note_ids ?? [],
      lastSynthesizedAt: row.last_synthesized_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  // Notizen einmalig erzeugen, dabei ALLE zugehörigen Threads sammeln.
  // Eine Notiz kann legitim zu mehreren Threads gehören (geteilte Notiz).
  const threadIdsByNote = new Map<string, string[]>();
  for (const t of threads) {
    for (const noteId of t.noteIds) {
      if (!threadIdsByNote.has(noteId)) threadIdsByNote.set(noteId, []);
      threadIdsByNote.get(noteId)!.push(t.id);
    }
  }
  for (const [noteId, threadIds] of threadIdsByNote) {
    const n = noteMap.get(noteId);
    if (!n) continue;
    notes.push({
      id: n.id,
      threadId: threadIds[0],   // primärer Thread für Layout/Drag
      threadIds,                // alle Zuordnungen
      title: n.title ?? '',
      content: n.content ?? '',
      category: n.category ?? '',
      createdAt: n.created_at,
      updatedAt: n.updated_at,
    });
  }

  const similarities: Similarity[] = (similarityRows ?? []).map((row: any) => ({
    id: row.id ?? `${row.thread_id_1}_${row.thread_id_2}`,
    threadId1: row.thread_id_1,
    threadId2: row.thread_id_2,
    label: row.label ?? '',
    explanation: '',
  }));

  const data: GraphData = { threads, notes, similarities };
  return NextResponse.json(data);
}
