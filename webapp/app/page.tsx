'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { GraphData, Thread, Note, Similarity } from '@/types';
import { GraphHandle } from '@/components/Graph';
import ThreadPanel from '@/components/ThreadPanel';
import NoteOverlay from '@/components/NoteOverlay';
import SimilarityOverlay from '@/components/SimilarityOverlay';

const Graph = dynamic(() => import('@/components/Graph'), { ssr: false });

const FILTER_PILLS = [
  { label: 'Alle', value: 'all', color: 'var(--amber)' },
  { label: 'Lernen', value: 'Lernen', color: 'var(--purple)' },
  { label: 'Arbeit', value: 'Arbeit', color: 'var(--green)' },
  { label: 'Ideen', value: 'Ideen', color: 'var(--amber)' },
  { label: 'Persönlich', value: 'Persönlich', color: 'var(--rose)' },
];

const EMPTY: GraphData = { threads: [], notes: [], similarities: [] };

export default function Home() {
  const [graphData, setGraphData] = useState<GraphData>(EMPTY);
  const [loading, setLoading] = useState(true);

  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [selectedSim, setSelectedSim] = useState<Similarity | null>(null);

  const [activeFilter, setActiveFilter] = useState('all');
  const [tooltip, setTooltip] = useState<{ label: string; x: number; y: number } | null>(null);

  const graphHandle = useRef<GraphHandle | null>(null);

  useEffect(() => {
    fetch('/api/graph')
      .then((r) => r.json())
      .then((data: GraphData) => { setGraphData(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedThread(null);
        setSelectedNote(null);
        setSelectedSim(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleThreadClick = useCallback((thread: Thread) => {
    setSelectedSim(null);
    setSelectedNote(null);
    setSelectedThread((prev) => prev?.id === thread.id ? null : thread);
  }, []);

  const handleNoteClick = useCallback((note: Note) => {
    setSelectedNote(note);
  }, []);

  const handleSimilarityClick = useCallback((sim: Similarity) => {
    setSelectedThread(null);
    setSelectedNote(null);
    setSelectedSim(sim);
  }, []);

  const handleTooltip = useCallback((label: string | null, x: number, y: number) => {
    setTooltip(label ? { label, x, y } : null);
  }, []);

  const threadNotes: Note[] = selectedThread
    ? graphData.notes.filter((n) => selectedThread.noteIds.includes(n.id))
    : [];

  const simThread1 = selectedSim ? graphData.threads.find(t => t.id === selectedSim.threadId1) : undefined;
  const simThread2 = selectedSim ? graphData.threads.find(t => t.id === selectedSim.threadId2) : undefined;

  const threadCount = graphData.threads.length;
  const noteCount = graphData.notes.length;
  const catCount = new Set(graphData.notes.map(n => n.category).filter(Boolean)).size;

  const btnStyle: React.CSSProperties = { width: 36, height: 36, borderRadius: '50%', background: 'rgba(14,12,9,0.7)', border: '1px solid var(--border)', color: 'var(--t2)', fontSize: 18, fontWeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(12px)', transition: 'all 0.15s', userSelect: 'none' };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* GRAPH */}
      {!loading && (
        <Graph
          data={graphData}
          activeFilter={activeFilter}
          onThreadClick={handleThreadClick}
          onNoteClick={handleNoteClick}
          onSimilarityClick={handleSimilarityClick}
          activeThreadId={selectedThread?.id ?? null}
          activeSimilarityId={selectedSim?.id ?? null}
          onTooltip={handleTooltip}
          handleRef={graphHandle}
        />
      )}

      {/* LOADING */}
      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--amber)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--t3)', fontSize: 13 }}>Graph wird geladen…</p>
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 54, background: 'rgba(14,12,9,0.75)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', padding: '0 22px', gap: 0, zIndex: 50, pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #FBCB96, #C05C1A 70%)', boxShadow: '0 0 16px rgba(244,162,97,0.5), 0 0 40px rgba(244,162,97,0.15)', flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: 'var(--font-lora, Lora, serif)', fontSize: 15, fontWeight: 500, color: 'var(--t1)', letterSpacing: '-0.01em' }}>Notiz</div>
            <div style={{ fontSize: 10.5, color: 'var(--t3)' }}>Second Brain</div>
          </div>
        </div>
        <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 20px' }} />
        {!loading && (
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { dot: 'var(--amber)', n: threadCount, label: 'Threads' },
              { dot: 'var(--green)', n: noteCount, label: 'Notizen' },
              { dot: 'var(--purple)', n: catCount, label: 'Kategorien' },
            ].map(({ dot, n, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 12px', fontSize: 12, color: 'var(--t2)' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: dot, boxShadow: `0 0 6px ${dot}`, flexShrink: 0 }} />
                <span style={{ color: 'var(--t1)', fontWeight: 500 }}>{n}</span> {label}
              </div>
            ))}
          </div>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--t3)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>Klick auf <strong style={{ color: 'var(--amber)' }}>Thread</strong>, <strong style={{ color: 'var(--green)' }}>Notiz</strong> oder <strong style={{ color: 'var(--amber)' }}>◆ KI-Verbindung</strong></span>
          <span style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 7px', fontSize: 11, color: 'var(--t2)' }}>Esc</span>
          <span style={{ color: 'var(--t3)' }}>schließen</span>
        </div>
      </div>

      {/* FILTER PILLS */}
      <div style={{ position: 'absolute', top: 70, left: 20, display: 'flex', flexDirection: 'column', gap: 5, zIndex: 20 }}>
        {FILTER_PILLS.map((pill, i) => (
          <div key={pill.value}>
            {i === 1 && <div style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />}
            <button
              onClick={() => setActiveFilter(pill.value)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: activeFilter === pill.value ? 'rgba(244,162,97,0.1)' : 'rgba(14,12,9,0.7)', border: `1px solid ${activeFilter === pill.value ? 'rgba(244,162,97,0.3)' : 'var(--border)'}`, borderRadius: 20, padding: '6px 14px', fontSize: 12, color: activeFilter === pill.value ? 'var(--amber)' : 'var(--t2)', cursor: 'pointer', backdropFilter: 'blur(12px)', transition: 'all 0.18s', userSelect: 'none', whiteSpace: 'nowrap' }}
            >
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: pill.color, flexShrink: 0 }} />
              {pill.label}
            </button>
          </div>
        ))}
      </div>

      {/* LEGEND */}
      <div style={{ position: 'absolute', bottom: 28, left: 20, background: 'rgba(14,12,9,0.7)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', backdropFilter: 'blur(12px)', zIndex: 20, pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Legende</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--t2)' }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--amber)', boxShadow: '0 0 8px var(--amber)', flexShrink: 0 }} /> Thread (klickbar)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--t2)' }}>
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 6px var(--green)', flexShrink: 0 }} /> Notiz (klickbar)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--t2)' }}>
          <div style={{ width: 11, height: 11, borderRadius: '50%', border: '1.5px dashed var(--purple)', background: 'transparent', flexShrink: 0 }} /> Kategorie
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--t2)' }}>
          <div style={{ width: 11, height: 11, background: 'var(--amber)', transform: 'rotate(45deg)', flexShrink: 0, borderRadius: 2 }} /> KI-Verbindung (klickbar)
        </div>
      </div>

      {/* ZOOM BUTTONS */}
      <div style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5, zIndex: 20 }}>
        <button onClick={() => graphHandle.current?.zoomBy(-0.2)} style={btnStyle}>−</button>
        <button onClick={() => graphHandle.current?.zoomReset()} style={{ ...btnStyle, fontSize: 13, fontWeight: 500 }}>⊙</button>
        <button onClick={() => graphHandle.current?.zoomBy(0.2)} style={btnStyle}>+</button>
      </div>

      {/* TOOLTIP */}
      {tooltip && (
        <div style={{ position: 'absolute', left: tooltip.x, top: tooltip.y, background: 'rgba(22,18,14,0.95)', border: '1px solid var(--border2)', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, color: 'var(--t1)', pointerEvents: 'none', zIndex: 30, whiteSpace: 'normal', maxWidth: 200, backdropFilter: 'blur(10px)' }}>
          {tooltip.label}
        </div>
      )}

      {/* OVERLAYS */}
      {selectedThread && (
        <ThreadPanel
          thread={selectedThread}
          notes={threadNotes}
          similarities={graphData.similarities}
          allThreads={graphData.threads}
          onNoteClick={handleNoteClick}
          onClose={() => { setSelectedThread(null); graphHandle.current?.zoomReset(); }}
        />
      )}

      {selectedNote && (
        <NoteOverlay note={selectedNote} onClose={() => setSelectedNote(null)} />
      )}

      {selectedSim && (
        <SimilarityOverlay
          similarity={selectedSim}
          thread1={simThread1}
          thread2={simThread2}
          onClose={() => setSelectedSim(null)}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
