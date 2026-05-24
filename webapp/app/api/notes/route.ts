import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, content, category, threadId, userId, includeInThreads, reminder } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Titel ist erforderlich.' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const noteData: Record<string, unknown> = {
      title: title.trim(),
      content: content?.trim() ?? '',
      category: category ?? '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Optional fields
    if (userId && userId !== 'demo') noteData.user_id = userId;
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
