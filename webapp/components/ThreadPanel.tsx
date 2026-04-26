'use client';

import { Thread, Note } from '@/types';

interface Props {
  thread: Thread;
  notes: Note[];
  onNoteClick: (note: Note) => void;
  onClose: () => void;
}

export default function ThreadPanel({ thread, notes, onNoteClick, onClose }: Props) {
  const synth = thread.lastSynthesizedAt
    ? new Date(thread.lastSynthesizedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : null;

  return (
    <div className="absolute top-0 right-0 h-full w-[360px] flex flex-col z-40 animate-slide-in"
      style={{ background: 'rgba(14,12,9,0.93)', borderLeft: '1px solid rgba(244,162,97,0.15)', backdropFilter: 'blur(28px)' }}
    >
      {/* Header */}
      <div className="relative px-6 pt-6 pb-[18px]" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-[7px] mb-[10px]" style={{ fontSize: 10, fontWeight: 600, color: 'var(--amber)', letterSpacing: '0.13em', textTransform: 'uppercase' }}>
          <span style={{ display: 'inline-block', width: 18, height: 1, background: 'linear-gradient(90deg, var(--amber), transparent)' }} />
          Thread
        </div>
        <h2 style={{ fontFamily: 'var(--font-lora, Lora, serif)', fontSize: 21, fontWeight: 500, color: 'var(--t1)', lineHeight: 1.3, marginBottom: 10, letterSpacing: '-0.01em' }}>
          {thread.title}
        </h2>
        <div style={{ fontSize: 12, color: 'var(--t3)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {synth && <span>Synthetisiert: {synth}</span>}
          <span>{notes.length} {notes.length === 1 ? 'Notiz' : 'Notizen'}</span>
          {thread.isPinned && <span>📌 Angeheftet</span>}
        </div>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 18, right: 18, width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--t3)', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.12s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = 'var(--t1)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = 'var(--t3)'; }}
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-[18px] flex flex-col gap-5">
        {/* Summary */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.11em', color: 'var(--amber)', marginBottom: 9 }}>
            KI-Zusammenfassung
          </div>
          <p style={{ fontFamily: 'var(--font-lora, Lora, serif)', fontStyle: 'italic', fontSize: 13.5, lineHeight: 1.7, color: 'rgba(242,237,230,0.45)' }}>
            {thread.summary || 'Noch keine Zusammenfassung.'}
          </p>
        </div>

        {/* Notes */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.11em', color: 'var(--green)', marginBottom: 9 }}>
            {notes.length} {notes.length === 1 ? 'Notiz' : 'Notizen'}
          </div>
          {notes.map((note) => (
            <button
              key={note.id}
              onClick={() => onNoteClick(note)}
              style={{ display: 'block', width: '100%', textAlign: 'left', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderLeft: '2px solid var(--green)', borderRadius: 10, padding: '11px 14px', marginBottom: 7, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(168,216,168,0.06)'; el.style.transform = 'translateX(2px)'; el.style.borderColor = 'rgba(168,216,168,0.25)'; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.03)'; el.style.transform = ''; el.style.borderColor = 'var(--border)'; }}
            >
              <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(242,237,230,0.8)', marginBottom: 4 }}>{note.title || '(kein Titel)'}</div>
              <div style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {note.content.split('\n')[0]}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
