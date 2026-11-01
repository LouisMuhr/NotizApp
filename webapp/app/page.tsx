'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { GraphData, Thread, Note, Similarity } from '@/types';
import { GraphHandle, GraphSpotlight, IntroEvent } from '@/components/Graph';
import ThreadPanel from '@/components/ThreadPanel';
import SimilarityOverlay from '@/components/SimilarityOverlay';
import { NoteViewModal, NoteCreateModal, NoteCreateData } from '@/components/NoteModal';
import LoginView, { AppUser } from '@/components/LoginView';
import VelmIcon from '@/components/VelmIcon';
import { supabase } from '@/lib/supabase';
import { DEMO_DATA, DEMO_SPOTLIGHT } from '@/lib/demoData';
import { stressData } from '@/lib/stressData';
import { fetchTier, hasBookmarklet } from '@/lib/tier';

const Graph = dynamic(() => import('@/components/Graph'), { ssr: false });

const EMPTY: GraphData = { threads: [], notes: [], similarities: [] };
const CACHE_KEY = 'notiz_graph_cache';
const INTRO_SEEN_KEY = 'velm_intro_seen';

type IntroStep = 'scatter' | 'gather' | 'connect';
const INTRO_STEPS: IntroStep[] = ['scatter', 'gather', 'connect'];
const INTRO_TEXT: Record<IntroStep, { kicker: string; title: (n: number) => string; body: string }> = {
  scatter: { kicker: 'Deine Notizen', title: n => `${n} Gedanken, kreuz und quer.`,
    body: 'Notiert zwischendurch, im Zug, beim Lesen. Ohne Ordner, ohne System.' },
  gather: { kicker: 'Velm sortiert', title: () => 'Was zusammengehört, findet sich.',
    body: 'Velm liest mit und bündelt deine Notizen zu Threads. Du legst weder Ordner noch Tags an.' },
  connect: { kicker: 'Velm verbindet', title: () => 'Und entdeckt, was du übersehen hast.',
    body: 'Auch zwischen Themen, die auf den ersten Blick nichts miteinander zu tun haben.' },
};

const cardStyle: React.CSSProperties = {
  position: 'absolute', left: 22, bottom: 24, width: 340, maxWidth: 'calc(100vw - 44px)', padding: '18px 20px',
  background: 'rgba(22,18,14,0.88)', border: '1px solid var(--border2)', borderRadius: 16, backdropFilter: 'blur(14px)',
  zIndex: 40, animation: 'velm-rise 0.4s ease-out',
};
const kickerStyle: React.CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--amber)', marginBottom: 8 };
const cardTitleStyle: React.CSSProperties = { fontFamily: 'var(--font-lora, Lora, serif)', fontSize: 19, fontWeight: 500, color: 'var(--t1)', lineHeight: 1.3, marginBottom: 8 };
const linkBtnStyle: React.CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--t3)', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif' };

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
    }).catch(() => {}).finally(() => setAuthLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const u = session.user;
        setUser({
          id: u.id,
          email: u.email!,
          name: u.user_metadata?.full_name ?? u.email!.split('@')[0],
          initial: (u.user_metadata?.full_name ?? u.email!)[0].toUpperCase(),
        });
      } else {
        setUser(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Ohne Login zeigt die Startseite den Beispiel-Graphen; Anmelden öffnet sich als Overlay darüber.
  const [authOverlay, setAuthOverlay] = useState<'login' | 'register' | null>(null);
  const isGuest = !user;

  // ── selection state ───────────────────────────────────────────────────────
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [selectedNote,   setSelectedNote]   = useState<Note | null>(null);
  const [selectedSim,    setSelectedSim]    = useState<Similarity | null>(null);

  // Wechsel Gast ↔ Konto: Auswahl aus dem vorherigen Graphen verwerfen.
  const clearSelection = () => { setSelectedThread(null); setSelectedNote(null); setSelectedSim(null); };

  const handleLogin = (u: AppUser) => {
    clearSelection();
    setUser(u);
    setAuthOverlay(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Graph-Cache gehört zum Konto — sonst sähe das nächste Konto im selben Tab kurz die alten Notizen.
    try { sessionStorage.removeItem(CACHE_KEY); } catch {}
    clearSelection();
    setGraphData(EMPTY);
    setUser(null);
  };

  /** Aktuellen Supabase-Access-Token holen */
  const getToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  // ── graph data ────────────────────────────────────────────────────────────
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

  const fetchGraph = useCallback(async () => {
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
  }, [getToken]);

  useEffect(() => { if (user) fetchGraph(); }, [user, fetchGraph]);

  // Bookmarklet-Button nur mit passendem Abo; an die User-ID gebunden, damit ein Kontowechsel nichts übernimmt.
  const [tierCheck, setTierCheck] = useState<{ userId: string; allowed: boolean } | null>(null);
  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    fetchTier(userId).then((tier) => setTierCheck({ userId, allowed: hasBookmarklet(tier) }));
  }, [user]);
  const showBookmarklet = !!user && tierCheck?.userId === user.id && tierCheck.allowed;

  const [tooltip, setTooltip]           = useState<{ label: string; x: number; y: number } | null>(null);

  // Suche: Treffer bleiben im Graphen hell, Enter springt zum ersten und öffnet ihn.
  const [query, setQuery] = useState('');

  // Nur `next dev`: ?stress=40 zeigt Gästen einen generierten Graphen mit 40 Threads (Leistungstest).
  const [guestData] = useState<GraphData>(() => {
    if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') return DEMO_DATA;
    const n = Number(new URLSearchParams(window.location.search).get('stress'));
    return n > 0 ? stressData(n) : DEMO_DATA;
  });

  const graphHandle = useRef<GraphHandle | null>(null);

  // Erstbesuch (nur Beispiel-Graph): Intro „lose Notizen → Inseln → Verbindungen", danach fliegt die Kamera
  // zu einer Verbindung und die Karte erklärt sie. Wer weniger Bewegung will, bekommt direkt die Verbindung.
  const [introKey, setIntroKey] = useState(() => {
    if (typeof window === 'undefined' || guestData !== DEMO_DATA) return 0;
    try { if (localStorage.getItem(INTRO_SEEN_KEY)) return 0; } catch { return 0; }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1;
  });
  const [introStep, setIntroStep] = useState<IntroStep | null>(null);
  const [spotlight, setSpotlight] = useState<GraphSpotlight | null>(() => {
    if (typeof window === 'undefined' || guestData !== DEMO_DATA) return null;
    try { if (localStorage.getItem(INTRO_SEEN_KEY)) return null; } catch { return null; }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? DEMO_SPOTLIGHT : null;
  });

  const handleIntro = useCallback((e: IntroEvent) => {
    if (e === 'scatter' || e === 'gather' || e === 'connect') { setIntroStep(e); return; }
    setIntroStep(null);
    try { localStorage.setItem(INTRO_SEEN_KEY, '1'); } catch {}
    // Abbruch durch Ziehen/Zoomen: nicht die Kamera wegreißen, der Besucher erkundet schon selbst.
    if (e === 'done') setSpotlight(DEMO_SPOTLIGHT);
  }, []);
  const replayIntro = () => { clearSelection(); setSpotlight(null); setIntroKey(k => k + 1); };
  const closeSpotlight = () => {
    setSpotlight(null); graphHandle.current?.zoomReset();
    try { localStorage.setItem(INTRO_SEEN_KEY, '1'); } catch {}
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        graphHandle.current?.skipIntro();
        setSelectedThread(null); setSelectedNote(null); setSelectedSim(null); setAuthOverlay(null); setSpotlight(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleThreadClick = useCallback((thread: Thread) => {
    setSelectedSim(null); setSelectedNote(null); setSpotlight(null);
    setSelectedThread(prev => prev?.id === thread.id ? null : thread);
  }, []);

  const handleNoteClick     = useCallback((note: Note)       => { setSelectedNote(note); }, []);
  const handleSimilarityClick = useCallback((sim: Similarity) => {
    setSelectedThread(null); setSelectedNote(null); setSelectedSim(sim); setSpotlight(null);
  }, []);
  const handleTooltip = useCallback((label: string | null, x: number, y: number) => {
    setTooltip(label ? { label, x, y } : null);
  }, []);

  // ── note create / delete ──────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);

  const handleCreateNote = useCallback(async (data: NoteCreateData) => {
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
  }, [getToken, fetchGraph]);

  const handleDeleteNote = async (id: string) => {
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
    const token = await getToken();
    if (token) await fetch(`/api/notes/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  };

  // ── realtime: Graph neu laden wenn Worker synthetisiert ───────────────────
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('graph-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'threads' }, () => {
        fetchGraph();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchGraph]);

  // ── derived ───────────────────────────────────────────────────────────────
  const shown = isGuest ? guestData : graphData;
  const graphLoading = !isGuest && loading;
  const threadNotes: Note[] = selectedThread
    ? shown.notes.filter(n => selectedThread.noteIds.includes(n.id))
    : [];
  const simThread1 = selectedSim ? shown.threads.find(t => t.id === selectedSim.threadId1) : undefined;
  const simThread2 = selectedSim ? shown.threads.find(t => t.id === selectedSim.threadId2) : undefined;
  const q = query.trim().toLowerCase();
  const searchHits = q
    ? shown.threads.filter(t => t.title.toLowerCase().includes(q)).length + shown.notes.filter(n => (n.title || '').toLowerCase().includes(q)).length
    : 0;

  // ── render ────────────────────────────────────────────────────────────────

  if (authLoading) return (
    <div style={{ position: 'fixed', inset: 0, background: '#0E0C09', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #F4A261', borderTopColor: 'transparent', animation: 'velm-spin 0.8s linear infinite' }} />
    </div>
  );

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
      {!graphLoading && (
        <Graph
          data={shown}
          onThreadClick={handleThreadClick}
          onNoteClick={handleNoteClick}
          onSimilarityClick={handleSimilarityClick}
          activeThreadId={selectedThread?.id ?? null}
          activeSimilarityId={selectedSim?.id ?? null}
          onTooltip={handleTooltip}
          handleRef={graphHandle}
          query={query}
          insets={{ top: 76, right: 24, bottom: 90, left: isGuest ? 384 : 24 }}
          introKey={isGuest ? introKey : 0}
          onIntro={handleIntro}
          spotlight={isGuest ? spotlight : null}
        />
      )}

      {/* LOADING */}
      {graphLoading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--amber)', borderTopColor: 'transparent', animation: 'velm-spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--t3)', fontSize: 13 }}>Graph wird geladen…</p>
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 54, background: 'rgba(14,12,9,0.75)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', padding: '0 22px', zIndex: 50, pointerEvents: 'none' }}>
        {/* Left: logo + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <VelmIcon size={30} radius={8} />
          <div>
            <div style={{ fontFamily: 'var(--font-lora, Lora, serif)', fontSize: 15, fontWeight: 500, color: 'var(--t1)', letterSpacing: '-0.01em' }}>Velm</div>
            <div style={{ fontSize: 10.5, color: 'var(--t3)' }}>Second Brain</div>
          </div>
        </div>

        {/* Suche */}
        <div style={{ marginLeft: 22, display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 12px', width: 260, maxWidth: '30vw', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 17, pointerEvents: 'all' }}>
          <span style={{ color: 'var(--t3)', fontSize: 14 }}>⌕</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') { setQuery(''); e.currentTarget.blur(); }
              if (e.key !== 'Enter') return;
              const m = graphHandle.current?.flyToMatch(query);
              if (m?.type === 'note') setSelectedNote(m.note);
              else if (m?.type === 'thread') { setSelectedSim(null); setSelectedNote(null); setSelectedThread(m.thread); }
            }}
            placeholder="Suchen…"
            className="velm-field"
            style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: 'var(--t1)', fontSize: 13, fontFamily: 'Inter, sans-serif' }}
          />
          {query.trim() && (
            <span style={{ fontSize: 11, color: 'var(--t3)', whiteSpace: 'nowrap' }}>
              {searchHits === 0 ? 'keine Treffer' : `${searchHits} Treffer`}
            </span>
          )}
        </div>

        {/* Right (Gast): Anmelden / Konto erstellen */}
        {!user && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'all' }}>
            <button
              onClick={() => setAuthOverlay('login')}
              className="velm-hover"
              style={{ padding: '7px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)', borderRadius: 20, fontSize: 12.5, fontWeight: 600, color: 'var(--t1)', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
            >
              Anmelden
            </button>
            <button
              onClick={() => setAuthOverlay('register')}
              className="velm-primary"
              style={{ padding: '7px 16px', background: '#F4A261', border: 'none', borderRadius: 20, fontSize: 12.5, fontWeight: 700, color: '#0E0C09', cursor: 'pointer', fontFamily: 'Inter, sans-serif', boxShadow: '0 0 18px rgba(244,162,97,0.25)' }}
            >
              Konto erstellen
            </button>
          </div>
        )}

        {/* Right: create button + user chip */}
        {user && (
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14, pointerEvents: 'all' }}>
          {/* + Notiz Button */}
          <button
            onClick={() => setShowCreate(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(244,162,97,0.12)', border: '1px solid rgba(244,162,97,0.25)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#F4A261', cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s' }}
          >
            ＋ Notiz
          </button>
          {/* Bookmarklet */}
          {showBookmarklet && (
            <Link
              href="/bookmarklet"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: 'var(--t2)', textDecoration: 'none', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s' }}
            >
              🔖 Bookmarklet
            </Link>
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
              Abmelden
            </button>
          </div>
        </div>
        )}
      </div>

      {/* INTRO: eine Karte pro Phase, erzählt mit, was der Graph gerade zeigt */}
      {isGuest && !authOverlay && introStep && (
        <div key={introStep} style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ ...kickerStyle, marginBottom: 0 }}>{INTRO_TEXT[introStep].kicker}</div>
            <div style={{ display: 'flex', gap: 5 }}>
              {INTRO_STEPS.map((s, i) => (
                <span key={s} style={{ width: 6, height: 6, borderRadius: 3, background: i <= INTRO_STEPS.indexOf(introStep) ? 'var(--amber)' : 'rgba(255,255,255,0.12)', transition: 'background 0.3s' }} />
              ))}
            </div>
          </div>
          <div style={cardTitleStyle}>{INTRO_TEXT[introStep].title(shown.notes.length)}</div>
          <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.55, marginBottom: 12 }}>{INTRO_TEXT[introStep].body}</p>
          <button onClick={() => graphHandle.current?.skipIntro()} className="velm-hover" style={linkBtnStyle}>
            Überspringen →
          </button>
        </div>
      )}

      {/* SPOTLIGHT: eine Verbindung, die aus zwei konkreten Notizen entsteht */}
      {isGuest && !authOverlay && !introStep && spotlight && (() => {
        const sim = shown.similarities.find(s => s.id === spotlight.similarityId);
        const notes = spotlight.noteIds.map(id => shown.notes.find(n => n.id === id)).filter((n): n is Note => !!n);
        if (!sim) return null;
        return (
          <div style={cardStyle}>
            <div style={kickerStyle}>✦ Verbindung entdeckt</div>
            <div style={cardTitleStyle}>{sim.label}</div>
            <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.55, marginBottom: 12 }}>{sim.explanation}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {notes.map(n => (
                <button
                  key={n.id}
                  onClick={() => setSelectedNote(n)}
                  className="velm-hover"
                  style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)', borderRadius: 12, fontSize: 11.5, color: 'var(--t2)', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                >
                  {n.title}
                </button>
              ))}
            </div>
            <button
              onClick={closeSpotlight}
              className="velm-primary"
              style={{ width: '100%', padding: '10px', background: '#F4A261', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 700, color: '#0E0C09', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
            >
              Selbst erkunden →
            </button>
          </div>
        );
      })()}

      {/* HERO: ein Satz statt Erklärtext, in der freien Spalte links über der Karte */}
      {isGuest && (
        <div className="velm-hero" style={{ position: 'absolute', left: 42, top: 104, width: 320, zIndex: 35, pointerEvents: 'none', animation: 'velm-rise 0.6s ease-out' }}>
          <h1 style={{ fontFamily: "var(--font-instrument), 'Instrument Serif', Georgia, serif", fontSize: 52, fontWeight: 400, lineHeight: 1.02, color: 'var(--t1)', letterSpacing: '-0.01em', marginBottom: 16 }}>
            Du schreibst.<br /><span style={{ color: 'var(--amber)' }}>Velm verbindet.</span>
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--t2)' }}>
            Notizen landen, wie sie kommen. Velm ordnet sie zu Threads und findet die Verbindungen dazwischen.
          </p>
        </div>
      )}

      {/* GAST-HINWEIS: erklärt, dass das ein Beispiel ist */}
      {isGuest && !authOverlay && !introStep && !spotlight && (
        <div style={cardStyle}>
          <div style={kickerStyle}>
            Beispiel-Graph
          </div>
          <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.55, marginBottom: 14 }}>
            Das sind Beispiel-Notizen. Fahr über Threads und Verbindungen oder klick sie an.
          </p>
          <button
            onClick={() => setAuthOverlay('register')}
            className="velm-primary"
            style={{ width: '100%', padding: '10px', background: '#F4A261', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 700, color: '#0E0C09', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
          >
            Kostenlos starten →
          </button>
          <button
            onClick={() => setAuthOverlay('login')}
            className="velm-hover"
            style={{ width: '100%', marginTop: 8, padding: '9px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)', borderRadius: 10, fontSize: 13, fontWeight: 600, color: 'var(--t2)', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
          >
            Ich habe schon ein Konto
          </button>
          {guestData === DEMO_DATA && (
            <button onClick={replayIntro} className="velm-hover" style={{ ...linkBtnStyle, display: 'block', margin: '12px auto 0' }}>
              ↺ Intro noch einmal ansehen
            </button>
          )}
        </div>
      )}

      {authOverlay && (
        <LoginView key={authOverlay} initialMode={authOverlay} onLogin={handleLogin} onClose={() => setAuthOverlay(null)} />
      )}

      {/* TEMP (nur zum Testen, vor dem PR entfernen): Intro jederzeit neu abspielen */}
      {process.env.NODE_ENV === 'development' && isGuest && guestData === DEMO_DATA && (
        <button
          onClick={() => { try { localStorage.removeItem(INTRO_SEEN_KEY); } catch {} replayIntro(); }}
          style={{ position: 'absolute', right: 22, bottom: 28, zIndex: 45, padding: '8px 14px', background: 'rgba(244,162,97,0.12)', border: '1px dashed rgba(244,162,97,0.5)', borderRadius: 18, fontSize: 12, fontWeight: 600, color: '#F4A261', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
        >
          ▶ Intro abspielen (Test)
        </button>
      )}

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
          similarities={shown.similarities}
          allThreads={shown.threads}
          onNoteClick={handleNoteClick}
          onClose={() => { setSelectedThread(null); graphHandle.current?.zoomReset(); }}
        />
      )}

      {selectedNote && (
        <NoteViewModal note={selectedNote} onClose={() => setSelectedNote(null)} onDelete={user ? handleDeleteNote : undefined} />
      )}

      {showCreate && user && (
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
    </div>
  );
}
