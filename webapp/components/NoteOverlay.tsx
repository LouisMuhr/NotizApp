'use client';

import { Note } from '@/types';

interface Props {
  note: Note;
  onClose: () => void;
}

export default function NoteOverlay({ note, onClose }: Props) {
  const date = new Date(note.createdAt).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  });

  return (
    <div
      style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'rgba(22,18,14,0.98)', border: '1px solid rgba(168,216,168,0.2)', borderRadius: 18, padding: '30px 34px', width: 460, maxWidth: 'calc(100vw - 80px)', boxShadow: '0 30px 70px rgba(0,0,0,0.55), 0 0 50px rgba(168,216,168,0.05)', position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--t3)', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.12s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = 'var(--t1)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = 'var(--t3)'; }}
        >
          ×
        </button>

        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          NOTIZ
          {note.category && (
            <span style={{ background: 'rgba(168,216,168,0.1)', borderRadius: 4, padding: '2px 8px' }}>{note.category}</span>
          )}
          <span style={{ color: 'var(--t3)', fontWeight: 400 }}>{date}</span>
        </div>

        {note.title && (
          <h3 style={{ fontFamily: 'var(--font-lora, Lora, serif)', fontSize: 22, fontWeight: 500, color: 'var(--t1)', marginBottom: 16, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
            {note.title}
          </h3>
        )}

        <p style={{ fontSize: 14, lineHeight: 1.75, color: 'rgba(242,237,230,0.5)', fontWeight: 300, whiteSpace: 'pre-wrap' }}>
          {note.content}
        </p>
      </div>
    </div>
  );
}
