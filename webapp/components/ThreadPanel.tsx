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
    ? new Date(thread.lastSynthesizedAt).toLocaleDateString('de-DE')
    : null;

  return (
    <div className="absolute top-0 right-0 h-full w-80 flex flex-col bg-[#181B23] border-l border-[#7B6EF640] z-10 animate-slide-in overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-[#7B6EF620]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#7B6EF6] opacity-70">
              Thread
            </span>
            {thread.isPinned && (
              <span className="text-[10px] text-[#FFB347] opacity-80">📌</span>
            )}
          </div>
          <h2 className="text-white font-bold text-lg leading-tight truncate">{thread.title}</h2>
          {synth && (
            <p className="text-[11px] text-white/40 mt-1">Zuletzt synthetisiert {synth}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="ml-3 mt-1 text-white/40 hover:text-white/80 transition-colors text-xl leading-none"
        >
          ×
        </button>
      </div>

      {/* Summary */}
      {thread.summary ? (
        <div className="px-5 py-4 border-b border-[#7B6EF620]">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#7B6EF6] opacity-70 mb-2">
            KI-Zusammenfassung
          </p>
          <p className="text-white/75 text-sm leading-relaxed">{thread.summary}</p>
        </div>
      ) : (
        <div className="px-5 py-4 border-b border-[#7B6EF620]">
          <p className="text-white/30 text-sm italic">Noch keine Zusammenfassung.</p>
        </div>
      )}

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#3ECFB4] opacity-70 mb-3">
          {notes.length} {notes.length === 1 ? 'Notiz' : 'Notizen'}
        </p>
        <div className="flex flex-col gap-2">
          {notes.map((note) => (
            <button
              key={note.id}
              onClick={() => onNoteClick(note)}
              className="text-left rounded-xl border-l-2 border-[#3ECFB4] bg-[#0F1117] px-3 py-2.5 hover:bg-[#1a1e2a] transition-colors"
            >
              {note.title && (
                <p className="text-white/90 text-sm font-semibold truncate">{note.title}</p>
              )}
              <p className="text-white/50 text-xs leading-relaxed line-clamp-2 mt-0.5">
                {note.content}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
