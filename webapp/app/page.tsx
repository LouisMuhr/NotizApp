'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { GraphData, Thread, Note, Similarity } from '@/types';
import { GraphHandle } from '@/components/Graph';
import ThreadPanel from '@/components/ThreadPanel';
import SimilarityOverlay from '@/components/SimilarityOverlay';
import { NoteViewModal, NoteCreateModal, NoteCreateData } from '@/components/NoteModal';
import LoginView, { AppUser } from '@/components/LoginView';
import { supabase } from '@/lib/supabase';
import { DEMO_DATA } from '@/lib/demoData';

const Graph = dynamic(() => import('@/components/Graph'), { ssr: false });

const EMPTY: GraphData = { threads: [], notes: [], similarities: [] };

export default function Home() {
  // ── auth ──────────────────────────────────────────────────────────────────
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // Check for existing Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const u = session.user;
        setUser({
          id: u.id,
          email: u.email!,
          name: u.user_metadata?.full_name ?? u.email!.split('@')[0],
          initial: (u.user_metadata?.full_name ?? u.email!)[0].toUpperCase(),
        });
      }
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const u = session.user;
        setUser({
          id: u.id,
          email: u.email!,
          name: u.user_metadata?.full_name ?? u.email!.split('@')[0],
          initial: (u.user_metadata?.full_name ?? u.email!)[0].toUpperCase(),
        });
      } else if (!session) {
        // Only clear if not a demo user
        setUser(prev => prev?.isDemo ? prev : null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    if (!user?.isDemo) await supabase.auth.signOut();
    setUser(null);
  };

  /** Aktuellen Supabase-Access-Token holen (null für Demo-User) */
  const getToken = useCallback(async (): Promise<string | null> => {
    if (user?.isDemo) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, [user]);

  // ── graph data ────────────────────────────────────────────────────────────
  const CACHE_KEY = 'notiz_graph_cache';

  function readCache(): GraphData | null {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function writeCache(data: GraphData) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
  }

  const cached = readCache();
  const [graphData, setGraphData] = useState<GraphData>(cached ?? EMPTY);
  const [loading, setLoading]     = useState(!cached); // kein Spinner wenn Cache vorhanden

  const fetchGraph = useCallback(async (currentUser?: AppUser | null) => {
    const u = currentUser ?? user;
    if (u?.isDemo) {
      setGraphData(DEMO_DATA);
      setLoading(false);
      return;
    }
    const token = await getToken();
    if (!token) return;
    // Nur Spinner zeigen wenn noch kein Cache da
    if (!readCache()) setLoading(true);
    fetch('/api/graph', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: GraphData) => {
        setGraphData(data);
        writeCache(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken]);

  useEffect(() => { if (user) fetchGraph(user); }, [user, fetchGraph]);

  // ── selection state ───────────────────────────────────────────────────────
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [selectedNote,   setSelectedNote]   = useState<Note | null>(null);
  const [selectedSim,    setSelectedSim]    = useState<Similarity | null>(null);

  // Filter-Pills wurden entfernt → Graph zeigt immer alle Knoten.
  const activeFilter = 'all';
  const [tooltip, setTooltip]           = useState<{ label: string; x: number; y: number } | null>(null);

  const graphHandle = useRef<GraphHandle | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedThread(null); setSelectedNote(null); setSelectedSim(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleThreadClick = useCallback((thread: Thread) => {
    setSelectedSim(null); setSelectedNote(null);
    setSelectedThread(prev => prev?.id === thread.id ? null : thread);
  }, []);

  const handleNoteClick     = useCallback((note: Note)       => { setSelectedNote(note); }, []);
  const handleSimilarityClick = useCallback((sim: Similarity) => {
    setSelectedThread(null); setSelectedNote(null); setSelectedSim(sim);
  }, []);
  const handleTooltip = useCallback((label: string | null, x: number, y: number) => {
    setTooltip(label ? { label, x, y } : null);
  }, []);

  // ── note create / delete ──────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);

  const handleCreateNote = useCallback(async (data: NoteCreateData) => {
    if (user?.isDemo) { setShowCreate(false); return; }
    const token = await getToken();
    if (!token) return;
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      sessionStorage.removeItem('notiz_graph_cache');
      fetchGraph();
    } else {
      // Fehler nicht stillschweigend schlucken — sonst wirkt das Speichern
      // erfolgreich, obwohl die Notiz nie angelegt wurde.
      const msg = await res.json().catch(() => null);
      alert(`Notiz konnte nicht erstellt werden: ${msg?.error ?? `Fehler ${res.status}`}`);
    }
  }, [user, getToken, fetchGraph]);

  const handleDeleteNote = useCallback(async (id: string) => {
    // Sofort aus lokalem State entfernen — kein Reload, kein Flackern
    setGraphData(prev => ({
      ...prev,
      notes: prev.notes.filter(n => n.id !== id),
      threads: prev.threads.map(t => ({
        ...t,
        noteIds: t.noteIds.filter(nid => nid !== id),
        noteCount: Math.max(0, t.noteCount - 1),
      })),
    }));
    setSelectedNote(null);
    if (!user?.isDemo) {
      const token = await getToken();
      if (token) await fetch(`/api/notes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  }, [user, getToken]);

  // ── realtime: Graph neu laden wenn Worker synthetisiert ───────────────────
  useEffect(() => {
    if (!user || user.isDemo) return;
    const channel = supabase
      .channel('graph-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'threads' }, () => {
        fetchGraph();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchGraph]);

  // ── derived ───────────────────────────────────────────────────────────────
  const threadNotes: Note[] = selectedThread
    ? graphData.notes.filter(n => selectedThread.noteIds.includes(n.id))
    : [];
  const simThread1 = selectedSim ? graphData.threads.find(t => t.id === selectedSim.threadId1) : undefined;
  const simThread2 = selectedSim ? graphData.threads.find(t => t.id === selectedSim.threadId2) : undefined;

  // ── render ────────────────────────────────────────────────────────────────

  if (authLoading) return (
    <div style={{ position: 'fixed', inset: 0, background: '#0E0C09', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #F4A261', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!user) return <LoginView onLogin={setUser} />;

  const btnStyle: React.CSSProperties = {
    width: 36, height: 36, borderRadius: '50%',
    background: 'rgba(14,12,9,0.7)', border: '1px solid var(--border)',
    color: 'var(--t2)', fontSize: 18, fontWeight: 300,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', backdropFilter: 'blur(12px)', transition: 'all 0.15s', userSelect: 'none',
  };

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
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 54, background: 'rgba(14,12,9,0.75)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', padding: '0 22px', zIndex: 50, pointerEvents: 'none' }}>
        {/* Left: logo + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #FBCB96, #C05C1A 70%)', boxShadow: '0 0 16px rgba(244,162,97,0.5)', flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: 'var(--font-lora, Lora, serif)', fontSize: 15, fontWeight: 500, color: 'var(--t1)', letterSpacing: '-0.01em' }}>Notiz</div>
            <div style={{ fontSize: 10.5, color: 'var(--t3)' }}>Second Brain</div>
          </div>
        </div>

        {/* Right: create button + user chip */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14, pointerEvents: 'all' }}>
          {/* + Notiz Button */}
          {!user.isDemo && (
            <button
              onClick={() => setShowCreate(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(244,162,97,0.12)', border: '1px solid rgba(244,162,97,0.25)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#F4A261', cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s' }}
            >
              ＋ Notiz
            </button>
          )}
          {/* User chip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(244,162,97,0.08)', border: '1px solid rgba(244,162,97,0.15)', borderRadius: 20, padding: '4px 12px' }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(244,162,97,0.2)', color: '#F4A261', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
              {user.initial}
            </span>
            <span style={{ fontSize: 12, color: 'var(--t2)' }}>{user.name}</span>
            <span style={{ color: 'var(--t3)', fontSize: 12 }}>·</span>
            <button
              onClick={handleLogout}
              style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: 11, cursor: 'pointer', fontFamily: 'Inter, sans-serif', padding: 0 }}
            >
              {user.isDemo ? 'Demo beenden' : 'Abmelden'}
            </button>
          </div>
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
        <NoteViewModal note={selectedNote} onClose={() => setSelectedNote(null)} onDelete={handleDeleteNote} />
      )}

      {showCreate && (
        <NoteCreateModal
          threads={graphData.threads}
          userId={user.id}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreateNote}
        />
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
