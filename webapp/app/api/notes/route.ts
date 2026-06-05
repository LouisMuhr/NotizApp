import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { title, content, category, threadId, includeInThreads, reminder } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Titel ist erforderlich.' }, { status: 400 });
    }

    const supabase = createServerClient(token);

    // user_id aus dem Token ableiten (RLS setzt es automatisch via auth.uid())
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const noteData: Record<string, unknown> = {
      id: crypto.randomUUID(),
      title: title.trim(),
      content: content?.trim() ?? '',
      category: category ?? '',
      user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (includeInThreads !== undefined) noteData.feeds_threads = includeInThreads;
    if (reminder) noteData.reminder = reminder;

    const { data: noteRow, error: noteErr } = await supabase
      .from('notes')
      .insert(noteData)
      .select('id')
      .single();

    if (noteErr || !noteRow) {
      console.error('Note insert error:', noteErr);
      return NextResponse.json({ error: noteErr?.message ?? 'Fehler beim Erstellen.' }, { status: 500 });
    }

    // If a thread is selected, add the note to the thread's note_ids
    if (threadId) {
      const { data: thread } = await supabase
        .from('threads')
        .select('note_ids')
        .eq('id', threadId)
        .single();

      if (thread) {
        const newIds = [...(thread.note_ids ?? []), noteRow.id];
        await supabase
          .from('threads')
          .update({ note_ids: newIds, updated_at: new Date().toISOString() })
          .eq('id', threadId);
      }
    }

    return NextResponse.json({ id: noteRow.id }, { status: 201 });
  } catch (err) {
    console.error('POST /api/notes error:', err);
    return NextResponse.json({ error: 'Serverfehler.' }, { status: 500 });
  }
}
