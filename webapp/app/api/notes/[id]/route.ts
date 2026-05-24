import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'ID fehlt.' }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // Remove note from any thread's note_ids first
  const { data: threads } = await supabase
    .from('threads')
    .select('id, note_ids')
    .contains('note_ids', [id]);

  for (const thread of threads ?? []) {
    const newIds = (thread.note_ids ?? []).filter((nid: string) => nid !== id);
    await supabase
      .from('threads')
      .update({ note_ids: newIds, updated_at: new Date().toISOString() })
      .eq('id', thread.id);
  }

  const { error } = await supabase.from('notes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
