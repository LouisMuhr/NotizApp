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
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#181B23] border border-[#3ECFB440] rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#3ECFB4] opacity-70">
            Notiz · {note.category || 'Allgemein'} · {date}
          </span>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 transition-colors text-xl leading-none ml-3"
          >
            ×
          </button>
        </div>

        {note.title && (
          <h3 className="text-white font-bold text-base mb-2">{note.title}</h3>
        )}
        <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">
          {note.content}
        </p>
      </div>
    </div>
  );
}
