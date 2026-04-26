'use client';

import { Similarity, Thread } from '@/types';

interface Props {
  similarity: Similarity;
  thread1: Thread | undefined;
  thread2: Thread | undefined;
  onClose: () => void;
}

export default function SimilarityOverlay({ similarity, thread1, thread2, onClose }: Props) {
  return (
    <div
      style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'rgba(22,18,14,0.98)', border: '1px solid rgba(244,162,97,0.3)', borderRadius: 18, padding: '30px 34px', width: 460, maxWidth: 'calc(100vw - 80px)', boxShadow: '0 30px 70px rgba(0,0,0,0.55), 0 0 50px rgba(244,162,97,0.07)', position: 'relative' }}
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

        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--amber)', marginBottom: 14 }}>
          ✦ KI-Verbindung
        </div>

        <h3 style={{ fontFamily: 'var(--font-lora, Lora, serif)', fontSize: 26, fontWeight: 500, color: 'var(--t1)', marginBottom: 16, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
          {similarity.label}
        </h3>

        <div style={{ fontSize: 13, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--amber)' }}>{thread1?.title ?? '–'}</span>
          <span style={{ color: 'var(--t3)', margin: '0 6px' }}>↔</span>
          <span style={{ color: 'var(--amber)' }}>{thread2?.title ?? '–'}</span>
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--amber)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
          Warum diese Verbindung?
        </div>

        <p style={{ fontSize: 14, lineHeight: 1.75, color: 'rgba(242,237,230,0.5)', fontWeight: 300, whiteSpace: 'pre-wrap' }}>
          {similarity.explanation || 'Keine Erklärung verfügbar.'}
        </p>
      </div>
    </div>
  );
}
