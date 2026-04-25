'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { GraphData, GraphNode, Thread, Note } from '@/types';
import ThreadPanel from '@/components/ThreadPanel';
import NoteOverlay from '@/components/NoteOverlay';

const Graph = dynamic(() => import('@/components/Graph'), { ssr: false });

export default function Home() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  useEffect(() => {
    fetch('/api/graph')
      .then((r) => r.json())
      .then((data: GraphData) => { setGraphData(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNote(null);
    if (node.type === 'thread') {
      setSelectedThread(node.data as Thread);
    } else {
      setSelectedNote(node.data as Note);
      setSelectedThread(null);
    }
  }, []);

  const threadNotes: Note[] = selectedThread
    ? graphData.nodes
        .filter((n) => n.type === 'note' && selectedThread.noteIds.includes(n.id))
        .map((n) => n.data as Note)
    : [];

  const threadCount = graphData.nodes.filter((n) => n.type === 'thread').length;
  const noteCount = graphData.nodes.filter((n) => n.type === 'note').length;

  return (
    <div
      className="relative w-screen h-screen bg-[#0F1117] overflow-hidden"
      onClick={() => { setSelectedThread(null); setSelectedNote(null); }}
    >
      {!loading && <Graph data={graphData} onNodeClick={handleNodeClick} />}

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 rounded-full border-2 border-[#7B6EF6] border-t-transparent animate-spin mx-auto mb-3" />
            <p className="text-white/40 text-sm">Graph wird geladen…</p>
          </div>
        </div>
      )}

      {!loading && (
        <div className="absolute top-5 left-5 bg-[#181B23] border border-[#7B6EF630] rounded-xl px-4 py-2.5 pointer-events-none">
          <p className="text-white/80 font-bold text-sm">NotizApp · Second Brain</p>
          <p className="text-white/35 text-xs mt-0.5">
            {threadCount} Threads · {noteCount} Notizen
          </p>
        </div>
      )}

      {!loading && (
        <div className="absolute bottom-5 left-5 flex flex-col gap-1.5 pointer-events-none">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full bg-[#7B6EF6] shadow-[0_0_8px_#7B6EF6]" />
            <span className="text-white/40 text-xs">Thread</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#3ECFB4] shadow-[0_0_6px_#3ECFB4]" />
            <span className="text-white/40 text-xs">Notiz</span>
          </div>
        </div>
      )}

      {selectedThread && (
        <div onClick={(e) => e.stopPropagation()}>
          <ThreadPanel
            thread={selectedThread}
            notes={threadNotes}
            onNoteClick={(note) => setSelectedNote(note)}
            onClose={() => setSelectedThread(null)}
          />
        </div>
      )}

      {selectedNote && (
        <NoteOverlay note={selectedNote} onClose={() => setSelectedNote(null)} />
      )}
    </div>
  );
}
