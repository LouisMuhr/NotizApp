'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { GraphData, Thread, Note, Similarity } from '@/types';
import { GraphHandle, GraphSpotlight, IntroEvent } from '@/components/Graph';
import ThreadPanel from '@/components/ThreadPanel';
import ThreadList from '@/components/ThreadList';
import SimilarityOverlay from '@/components/SimilarityOverlay';
import { NoteViewModal, NoteCreateModal } from '@/components/NoteModal';
import LoginView, { AppUser } from '@/components/LoginView';
import VelmIcon from '@/components/VelmIcon';
import LangSwitch from '@/components/LangSwitch';
import { supabase } from '@/lib/supabase';
import { DEMO_SPOTLIGHT, demoFor, withDemoNote, type DemoTryNote } from '@/lib/demoData';
import { useI18n } from '@/lib/i18n';
import { categoriesFor } from '@/lib/categoryAccent';
import type { NoteDraft, NoteError } from '@/lib/noteDraft';
import { isNetworkError } from '@/lib/createNote';
import type { DeleteError } from '@/lib/deleteNote';
import { stressData } from '@/lib/stressData';
import { fetchTier, hasBookmarklet } from '@/lib/tier';
import { fetchNextAllowedAt, runSynthesis, describeResult, formatAvailability, synthErrorText } from '@/lib/synthesis';

const Graph = dynamic(() => import('@/components/Graph'), { ssr: false });

const EMPTY: GraphData = { threads: [], notes: [], similarities: [] };
const CACHE_KEY = 'notiz_graph_cache';
const INTRO_SEEN_KEY = 'velm_intro_seen';
// Eigener Graph: Intro einmal pro Konto, sobald er zum ersten Mal Threads hat (meist direkt nach der ersten
// Synthese). Nur für kleine Graphen — das Intro zeichnet ohne Zwischenbild.
const USER_INTRO_KEY = (uid: string) => `velm_graph_intro_${uid}`;
const USER_INTRO_MAX_NOTES = 80;

type IntroStep = 'scatter' | 'gather' | 'connect';
const INTRO_STEPS: IntroStep[] = ['scatter', 'gather', 'connect'];

const cardStyle: React.CSSProperties = {
  position: 'absolute', left: 22, bottom: 24, width: 340, maxWidth: 'calc(100vw - 44px)', padding: '18px 20px',
  background: 'rgba(22,18,14,0.88)', border: '1px solid var(--border2)', borderRadius: 16, backdropFilter: 'blur(14px)',
  zIndex: 40, animation: 'velm-rise 0.4s ease-out',
};
const NARROW_QUERY = '(max-width: 640px)';
const cardNarrow: React.CSSProperties = { left: 10, right: 10, bottom: 10, width: 'auto', maxWidth: 'none', padding: '14px 16px' };
const kickerStyle: React.CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--amber)', marginBottom: 8 };
const cardTitleStyle: React.CSSProperties = { fontFamily: 'var(--font-lora, Lora, serif)', fontSize: 19, fontWeight: 500, color: 'var(--t1)', lineHeight: 1.3, marginBottom: 8 };
const linkBtnStyle: React.CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--t3)', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif' };

export default function Home() {
  const { locale, t } = useI18n();
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

  // ── Handy: kompakte Topbar, Karte über die volle Breite; der Graph rückt über die gemessene Karte ──
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const on = () => setNarrow(mq.matches);
    on(); mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const [userMenu, setUserMenu] = useState(false);
  const [cardH, setCardH] = useState(0);
  const cardObs = useRef<ResizeObserver | null>(null);
  const cardRef = useCallback((el: HTMLDivElement | null) => {
    cardObs.current?.disconnect(); cardObs.current = null;
    if (!el) return; // kein Zurücksetzen auf 0: beim Kartenwechsel käme sonst kurz ein falscher Ausschnitt
    const ro = new ResizeObserver(() => setCardH(el.offsetHeight));
    ro.observe(el); cardObs.current = ro;
  }, []);

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

  const [userIntroKey, setUserIntroKey] = useState(0);

  const fetchGraph = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token, uid = session?.user.id;
    if (!token || !uid) return;
    // Nur Spinner zeigen wenn noch kein Cache da
    if (!readCache()) setLoading(true);
    fetch('/api/graph', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: GraphData) => {
        // Erster Graph mit Threads: einmal das Intro mit den eigenen Notizen abspielen
        try {
          const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          if (data.threads.length && data.notes.length <= USER_INTRO_MAX_NOTES && !reduced && !localStorage.getItem(USER_INTRO_KEY(uid))) {
            localStorage.setItem(USER_INTRO_KEY(uid), '1');
            setUserIntroKey(k => k + 1);
          }
        } catch {}
        setGraphData(data);
        writeCache(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { if (user) fetchGraph(); }, [user, fetchGraph]);

  // Bookmarklet-Button nur mit passendem Abo; an die User-ID gebunden, damit ein Kontowechsel nichts übernimmt.
  const [tierCheck, setTierCheck] = useState<{ userId: string; allowed: boolean } | null>(null);
  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    fetchTier(userId).then((tier) => setTierCheck({ userId, allowed: hasBookmarklet(tier) }));
  }, [user]);
  const showBookmarklet = !!user && tierCheck?.userId === user.id && tierCheck.allowed;

  // Synthese aus dem Web. Die Sperre kommt aus dem Profil (gleiche Regel wie die Bridge) und ist an die
  // User-ID gebunden; unbekannt = Button gesperrt, aber ohne behauptete Uhrzeit. Bei 429 gewinnt der Server-Wert.
  const [synthLimit, setSynthLimit] = useState<{ userId: string; nextAllowedAt: Date | null } | null>(null);
  const [synthesizing, setSynthesizing] = useState(false);
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    fetchNextAllowedAt(userId).then(r => setSynthLimit(r ? { userId, nextAllowedAt: r.nextAllowedAt } : null));
  }, [user]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  const limitKnown = !!user && synthLimit?.userId === user.id;
  const nextAllowedAt = limitKnown ? synthLimit!.nextAllowedAt : null;
  const synthLimited = !!nextAllowedAt && nextAllowedAt.getTime() > clock;
  // Gesperrt: Uhr mitlaufen lassen, damit „In 5 Minuten" stimmt und der Button rechtzeitig wieder frei wird.
  useEffect(() => {
    if (!synthLimited) return;
    const timer = setInterval(() => setClock(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [synthLimited]);
  const synthDisabled = synthesizing || !limitKnown || synthLimited;
  const synthLabel = synthesizing ? t.topbar.synthRunning : synthLimited ? formatAvailability(t, nextAllowedAt!, new Date(clock)) : t.topbar.synthStart;

  const handleSynthesize = async () => {
    if (!user || synthDisabled) return;
    const userId = user.id;
    setSynthesizing(true);
    const r = await runSynthesis(locale);
    setSynthesizing(false);
    const say = (text: string) => setToast({ text, id: Date.now() });
    if (r.kind === 'limit') {
      if (r.nextAllowedAt) { setSynthLimit({ userId, nextAllowedAt: r.nextAllowedAt }); setClock(Date.now()); }
      say(r.nextAllowedAt ? t.synth.limitUntil(formatAvailability(t, r.nextAllowedAt)) : t.synth.limit);
      return;
    }
    if (r.kind === 'ok') { say(`✦ ${describeResult(t, r)}`); fetchGraph(); }
    else if (r.kind === 'no_new') say(t.synth.noNew);
    else if (r.kind === 'nothing_assigned') say(t.synth.nothingAssigned);
    else if (r.kind === 'busy') say(t.synth.busy);
    else say(synthErrorText(t, r.code));
    // Lauf verbraucht oder zurückgegeben: Sperre frisch aus dem Profil
    fetchNextAllowedAt(userId).then(s => { setSynthLimit(s ? { userId, nextAllowedAt: s.nextAllowedAt } : null); setClock(Date.now()); });
  };

  const [tooltip, setTooltip]           = useState<{ label: string; x: number; y: number } | null>(null);

  // Suche: Treffer bleiben im Graphen hell, Enter springt zum ersten und öffnet ihn.
  const [query, setQuery] = useState('');

  // Nur `next dev`: ?stress=40 zeigt Gästen einen generierten Graphen mit 40 Threads (Leistungstest).
  const [stress] = useState<GraphData | null>(() => {
    if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') return null;
    const n = Number(new URLSearchParams(window.location.search).get('stress'));
    return n > 0 ? stressData(n) : null;
  });
  const demo = demoFor(locale);
  const guestBase = stress ?? demo.data;
  const isDemo = !stress;
  // Der Beispiel-Graph wächst um die Notizen, die Besucher per Chip hineinwerfen.
  const [guestData, setGuestData] = useState<GraphData>(guestBase);
  const [tryLeft, setTryLeft] = useState<DemoTryNote[]>(demo.tryNotes);
  const [thinkingId, setThinkingId] = useState<string | null>(null);
  const [lastPlaced, setLastPlaced] = useState<string | null>(null); // Thread-ID, Titel folgt der Sprache
  // Sprache gewechselt (z. B. Abmelden → Browsersprache): Beispiel in der neuen Sprache neu aufsetzen
  const [demoLocale, setDemoLocale] = useState(locale);
  if (demoLocale !== locale) {
    setDemoLocale(locale); setGuestData(guestBase); setTryLeft(demo.tryNotes); setLastPlaced(null);
  }

  const graphHandle = useRef<GraphHandle | null>(null);
  const guestRef = useRef(isGuest);
  useEffect(() => { guestRef.current = isGuest; });

  /** Chip → kurz „Velm denkt …", dann fliegt die Notiz von hier auf ihre Insel. */
  const tryNote = (n: DemoTryNote, el: HTMLElement) => {
    if (thinkingId) return;
    setThinkingId(n.id);
    setTimeout(() => {
      const r = el.getBoundingClientRect();
      graphHandle.current?.spawnFrom(r.left + r.width / 2, r.top + r.height / 2);
      setGuestData(d => withDemoNote(d, n));
      setTryLeft(l => l.filter(x => x.id !== n.id));
      setLastPlaced(n.threadId);
      setThinkingId(null);
    }, 900);
  };

  // Erstbesuch (nur Beispiel-Graph): Intro „lose Notizen → Inseln → Verbindungen", danach fliegt die Kamera
  // zu einer Verbindung und die Karte erklärt sie. Wer weniger Bewegung will, bekommt direkt die Verbindung.
  const [introKey, setIntroKey] = useState(() => {
    if (typeof window === 'undefined' || !isDemo) return 0;
    try { if (localStorage.getItem(INTRO_SEEN_KEY)) return 0; } catch { return 0; }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1;
  });
  const [introStep, setIntroStep] = useState<IntroStep | null>(null);
  const [spotlight, setSpotlight] = useState<GraphSpotlight | null>(() => {
    if (typeof window === 'undefined' || !isDemo) return null;
    try { if (localStorage.getItem(INTRO_SEEN_KEY)) return null; } catch { return null; }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? DEMO_SPOTLIGHT : null;
  });

  const handleIntro = useCallback((e: IntroEvent) => {
    if (e === 'scatter' || e === 'gather' || e === 'connect') { setIntroStep(e); return; }
    setIntroStep(null);
    // Eigener Graph: Intro ist verbraucht (ein späterer Neuaufbau des Graphen spielt es nicht noch mal),
    // kein Spotlight (keine kuratierte Verbindung).
    if (!guestRef.current) { setUserIntroKey(0); return; }
    try { localStorage.setItem(INTRO_SEEN_KEY, '1'); } catch {}
    // Abbruch durch Ziehen/Zoomen: nicht die Kamera wegreißen, der Besucher erkundet schon selbst.
    if (e === 'done') setSpotlight(DEMO_SPOTLIGHT);
  }, []);
  const replayIntro = () => {
    clearSelection(); setSpotlight(null); setIntroKey(k => k + 1);
    setGuestData(guestBase); setTryLeft(demo.tryNotes); setLastPlaced(null);
  };
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

  // Handy: Thread-Liste als Ausweg aus vollen Graphen
  const [showList, setShowList] = useState(false);
  const closeThread = () => { setSelectedThread(null); graphHandle.current?.zoomReset(); };
  const selectFromList = (thread: Thread) => {
    setShowList(false); setSelectedSim(null); setSelectedNote(null); setSpotlight(null);
    setSelectedThread(thread); graphHandle.current?.focusThread(thread.id);
  };

  // Fehler gehen als Code ans Fenster zurück; es bleibt mit allen Eingaben offen (nichts geht verloren).
  const handleCreateNote = useCallback(async (draft: NoteDraft): Promise<NoteError | null> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 'network';
    // Abgelaufene Session ohne Netz: das Auffrischen scheitert am Netz, nicht an der Anmeldung
    const { data: { session }, error: sessErr } = await supabase.auth.getSession();
    if (!session) return isNetworkError(sessErr) ? 'network' : 'unauthorized';
    const token = session.access_token;
    let res: Response;
    try {
      res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(draft),
      });
    } catch {
      return 'network';
    }
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      const code = json?.error as NoteError | undefined;
      return code && code in t.noteErrors ? code : res.status === 401 ? 'unauthorized' : 'internal';
    }
    setToast({ text: t.noteCreate.created, id: Date.now() });
    // Cache NICHT leeren: ohne Cache zeigt fetchGraph den Lade-Spinner, der Graph würde neu aufgebaut
    // (und spielte das Intro erneut). So lädt er im Hintergrund nach, neue Notizen fliegen ein.
    fetchGraph();
    return null;
  }, [fetchGraph, t]);

  /** null = gelöscht (oder war schon weg), sonst Fehler-Code */
  const requestDelete = async (id: string): Promise<DeleteError | null> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 'network';
    const { data: { session }, error: sessErr } = await supabase.auth.getSession();
    if (!session) return isNetworkError(sessErr) ? 'network' : 'unauthorized';
    let res: Response;
    try {
      res = await fetch(`/api/notes/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } });
    } catch {
      return 'network';
    }
    if (res.ok || res.status === 404) return null;
    const code = (await res.json().catch(() => null))?.error;
    return code === 'network' || code === 'unauthorized' ? code : res.status === 401 ? 'unauthorized' : 'internal';
  };

  const handleDeleteNote = async (id: string) => {
    // Sofort aus dem Graphen nehmen (kein Flackern); scheitert es, kommt die Notiz mit Hinweis zurück
    const before = graphData;
    setGraphData(prev => ({
      ...prev,
      notes: prev.notes.filter(n => n.id !== id),
      threads: prev.threads.map(t => t.noteIds.includes(id)
        ? { ...t, noteIds: t.noteIds.filter(nid => nid !== id), noteCount: Math.max(0, t.noteCount - 1) }
        : t),
    }));
    setSelectedNote(null);
    const err = await requestDelete(id);
    if (err) {
      setGraphData(before);
      setToast({ text: t.deleteErrors[err === 'not_found' ? 'internal' : err], id: Date.now() });
    }
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
  const graphLoading = !isGuest && loading;
  // Konto ohne Threads: nur ein Hinweis auf die App. Entstehen dort Threads, lädt Realtime den Graphen
  // (und beim ersten Mal läuft das Intro mit den eigenen Notizen).
  const userEmpty = !!user && !graphLoading && graphData.threads.length === 0;
  const shown = isGuest ? guestData : graphData;
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
  const card = narrow ? { ...cardStyle, ...cardNarrow } : cardStyle;
  // Handy: Thread-Leiste unten statt Fenster; sie ersetzt die Hinweiskarte und wird wie sie gemessen
  const sheetOpen = narrow && !!selectedThread;
  const cardShown = !authOverlay && (sheetOpen || !!introStep || isGuest);
  const insets = narrow
    ? { top: 64, right: 12, bottom: cardShown && cardH ? cardH + 18 : 24, left: 12 }
    : { top: 76, right: 24, bottom: 90, left: isGuest ? 384 : 24 };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* GRAPH */}
      {!graphLoading && !userEmpty && (
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
          insets={insets}
          introKey={isGuest ? introKey : userIntroKey}
          onIntro={handleIntro}
          spotlight={isGuest ? spotlight : null}
          untitledLabel={t.common.untitled}
        />
      )}

      {/* LOADING */}
      {graphLoading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--amber)', borderTopColor: 'transparent', animation: 'velm-spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--t3)', fontSize: 13 }}>{t.common.loadingGraph}</p>
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 54, background: 'rgba(14,12,9,0.75)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', padding: narrow ? '0 12px' : '0 22px', zIndex: 50, pointerEvents: 'none' }}>
        {/* Left: logo + title (Handy: nur das Logo) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, flexShrink: 0 }}>
          <VelmIcon size={30} radius={8} />
          {!narrow && (
            <div>
              <div style={{ fontFamily: 'var(--font-lora, Lora, serif)', fontSize: 15, fontWeight: 500, color: 'var(--t1)', letterSpacing: '-0.01em' }}>Velm</div>
              <div style={{ fontSize: 10.5, color: 'var(--t3)' }}>{t.topbar.tagline}</div>
            </div>
          )}
        </div>

        {/* Suche */}
        <div style={{ marginLeft: narrow ? 10 : 22, display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 12px', ...(narrow ? { flex: 1, minWidth: 0 } : { width: 260, maxWidth: '30vw' }), background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 17, pointerEvents: 'all' }}>
          <span style={{ color: 'var(--t3)', fontSize: 14 }}>⌕</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') { setQuery(''); e.currentTarget.blur(); }
              if (e.key !== 'Enter') return;
              setShowList(false);
              const m = graphHandle.current?.flyToMatch(query);
              if (m?.type === 'note') setSelectedNote(m.note);
              else if (m?.type === 'thread') { setSelectedSim(null); setSelectedNote(null); setSelectedThread(m.thread); }
            }}
            placeholder={t.topbar.search}
            className="velm-field"
            style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: 'var(--t1)', fontSize: narrow ? 16 : 13, fontFamily: 'Inter, sans-serif' /* iOS zoomt bei Feldern unter 16 px */ }}
          />
          {query.trim() && (
            <span style={{ fontSize: 11, color: 'var(--t3)', whiteSpace: 'nowrap' }}>
              {narrow ? searchHits : searchHits === 0 ? t.topbar.noHits : t.topbar.hits(searchHits)}
            </span>
          )}
        </div>

        {/* Handy: Umschalter Graph ↔ Thread-Liste */}
        {narrow && !userEmpty && !graphLoading && (
          <button
            onClick={() => setShowList(v => !v)}
            aria-label={showList ? t.topbar.showGraph : t.topbar.showList}
            className="velm-hover"
            style={{ marginLeft: 8, flexShrink: 0, width: 34, height: 34, borderRadius: '50%', background: showList ? 'rgba(244,162,97,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${showList ? 'rgba(244,162,97,0.4)' : 'var(--border2)'}`, color: showList ? 'var(--amber)' : 'var(--t2)', fontSize: 15, cursor: 'pointer', pointerEvents: 'all', fontFamily: 'Inter, sans-serif' }}
          >
            {showList ? '◎' : '☰'}
          </button>
        )}

        {/* Right (Gast): Anmelden / Konto erstellen */}
        {!user && (
          <div style={{ marginLeft: 'auto', paddingLeft: 10, display: 'flex', alignItems: 'center', gap: narrow ? 8 : 10, pointerEvents: 'all' }}>
            <LangSwitch />
            <button
              onClick={() => setAuthOverlay('login')}
              className="velm-hover"
              style={{ padding: '7px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)', borderRadius: 20, fontSize: 12.5, fontWeight: 600, color: 'var(--t1)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}
            >
              {t.topbar.login}
            </button>
            {/* Handy: „Kostenlos starten" steht schon in der Karte */}
            {!narrow && <button
              onClick={() => setAuthOverlay('register')}
              className="velm-primary"
              style={{ padding: '7px 16px', background: '#F4A261', border: 'none', borderRadius: 20, fontSize: 12.5, fontWeight: 700, color: '#0E0C09', cursor: 'pointer', fontFamily: 'Inter, sans-serif', boxShadow: '0 0 18px rgba(244,162,97,0.25)' }}
            >
              {t.topbar.register}
            </button>}
          </div>
        )}

        {/* Right: create button + user chip */}
        {user && (
        <div style={{ marginLeft: 'auto', paddingLeft: 10, display: 'flex', alignItems: 'center', gap: narrow ? 8 : 14, pointerEvents: 'all' }}>
          {/* Sprache (Handy: im Konto-Menü, die Leiste ist dort schon voll) */}
          {!narrow && <LangSwitch />}
          {/* Synthese (in der leeren Ansicht sitzt der Button in der Karte) */}
          {!userEmpty && (
            <button
              onClick={handleSynthesize}
              disabled={synthDisabled}
              title={synthLimited ? (narrow ? synthLabel : t.topbar.synthLimitTitle) : undefined}
              className={synthesizing ? 'velm-think' : undefined}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: synthDisabled && !synthesizing ? 'var(--t3)' : 'var(--t1)', cursor: synthDisabled ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
            >
              {narrow ? (synthesizing ? '✦ …' : synthLimited ? '✦' : t.topbar.synthShort) : synthLabel}
            </button>
          )}
          {/* + Notiz Button */}
          <button
            onClick={() => setShowCreate(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(244,162,97,0.12)', border: '1px solid rgba(244,162,97,0.25)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#F4A261', cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s' }}
          >
            {narrow ? '＋' : t.topbar.newNote}
          </button>
          {/* Bookmarklet (Handy: gibt es dort nicht) */}
          {showBookmarklet && !narrow && (
            <Link
              href="/bookmarklet"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: 'var(--t2)', textDecoration: 'none', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s' }}
            >
              {t.topbar.bookmarklet}
            </Link>
          )}
          {/* User chip (Handy: nur die Initiale, Abmelden im Menü) */}
          {narrow ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setUserMenu(v => !v)}
                aria-label={t.topbar.account}
                style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(244,162,97,0.2)', border: '1px solid rgba(244,162,97,0.25)', color: '#F4A261', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
              >
                {user.initial}
              </button>
              {userMenu && (
                <div style={{ position: 'absolute', right: 0, top: 40, minWidth: 180, padding: '12px 14px', background: 'var(--s2)', border: '1px solid var(--border2)', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
                  <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--t3)' }}>{t.topbar.language}</span>
                    <LangSwitch />
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 11.5 }}>
                    <Link href={t.legal.imprintHref} style={{ color: 'var(--t3)', textDecoration: 'none' }}>{t.legal.imprint}</Link>
                    <Link href={t.legal.privacyHref} style={{ color: 'var(--t3)', textDecoration: 'none' }}>{t.legal.privacy}</Link>
                  </div>
                  <button
                    onClick={() => { setUserMenu(false); handleLogout(); }}
                    className="velm-hover"
                    style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: 'var(--t1)', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                  >
                    {t.topbar.logout}
                  </button>
                </div>
              )}
            </div>
          ) : (
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
              {t.topbar.logout}
            </button>
          </div>
          )}
        </div>
        )}
      </div>

      {/* INTRO: eine Karte pro Phase, erzählt mit, was der Graph gerade zeigt */}
      {!authOverlay && introStep && (
        <div key={introStep} ref={cardRef} style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ ...kickerStyle, marginBottom: 0 }}>{t.intro[introStep].kicker}</div>
            <div style={{ display: 'flex', gap: 5 }}>
              {INTRO_STEPS.map((s, i) => (
                <span key={s} style={{ width: 6, height: 6, borderRadius: 3, background: i <= INTRO_STEPS.indexOf(introStep) ? 'var(--amber)' : 'rgba(255,255,255,0.12)', transition: 'background 0.3s' }} />
              ))}
            </div>
          </div>
          <div style={cardTitleStyle}>{t.intro[introStep].title(shown.notes.length)}</div>
          <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.55, marginBottom: 12 }}>{t.intro[introStep].body}</p>
          <button onClick={() => graphHandle.current?.skipIntro()} className="velm-hover" style={linkBtnStyle}>
            {t.intro.skip}
          </button>
        </div>
      )}

      {/* SPOTLIGHT: eine Verbindung, die aus zwei konkreten Notizen entsteht */}
      {isGuest && !authOverlay && !introStep && !sheetOpen && spotlight && (() => {
        const sim = shown.similarities.find(s => s.id === spotlight.similarityId);
        const notes = spotlight.noteIds.map(id => shown.notes.find(n => n.id === id)).filter((n): n is Note => !!n);
        if (!sim) return null;
        return (
          <div ref={cardRef} style={card}>
            <div style={kickerStyle}>{t.spotlight.kicker}</div>
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
                  {n.title || t.common.untitled}
                </button>
              ))}
            </div>
            <button
              onClick={closeSpotlight}
              className="velm-primary"
              style={{ width: '100%', padding: '10px', background: '#F4A261', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 700, color: '#0E0C09', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
            >
              {t.spotlight.explore}
            </button>
          </div>
        );
      })()}

      {/* HERO: ein Satz statt Erklärtext, in der freien Spalte links über der Karte */}
      {isGuest && (
        <div className="velm-hero" style={{ position: 'absolute', left: 42, top: 104, width: 320, zIndex: 35, pointerEvents: 'none', animation: 'velm-rise 0.6s ease-out' }}>
          <h1 style={{ fontFamily: "var(--font-instrument), 'Instrument Serif', Georgia, serif", fontSize: 52, fontWeight: 400, lineHeight: 1.02, color: 'var(--t1)', letterSpacing: '-0.01em', marginBottom: 16 }}>
            {t.hero.line1}<br /><span style={{ color: 'var(--amber)' }}>{t.hero.line2}</span>
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--t2)' }}>
            {t.hero.body}
          </p>
        </div>
      )}

      {/* GAST-HINWEIS: erklärt, dass das ein Beispiel ist */}
      {isGuest && !authOverlay && !introStep && !sheetOpen && !spotlight && (
        <div ref={cardRef} style={card}>
          {/* Handy: kompakt — kein Erklärtext, Intro-Link oben rechts, Chips in einer wischbaren Zeile */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div style={kickerStyle}>
              {t.guest.kicker}
            </div>
            {narrow && isDemo && (
              <button onClick={replayIntro} className="velm-hover" style={linkBtnStyle}>{t.guest.replayShort}</button>
            )}
          </div>
          {!narrow && (
            <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.55, marginBottom: 14 }}>
              {t.guest.body}
            </p>
          )}
          {isDemo && (
            <div style={{ marginBottom: narrow ? 12 : 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', marginBottom: 8 }}>
                {tryLeft.length ? t.guest.tryIt : t.guest.allDone}
              </div>
              <div className="velm-scroll" style={narrow ? { display: 'flex', gap: 6, overflowX: 'auto', whiteSpace: 'nowrap', margin: '0 -16px', padding: '0 16px 2px' } : { display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tryLeft.map(n => (
                  <button
                    key={n.id}
                    onClick={e => tryNote(n, e.currentTarget)}
                    disabled={!!thinkingId}
                    className="velm-hover"
                    style={{ padding: '5px 11px', background: thinkingId === n.id ? 'rgba(244,162,97,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${thinkingId === n.id ? 'rgba(244,162,97,0.45)' : 'var(--border2)'}`, borderRadius: 14, fontSize: 12, color: thinkingId === n.id ? 'var(--amber)' : 'var(--t2)', cursor: thinkingId ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif', opacity: thinkingId && thinkingId !== n.id ? 0.5 : 1 }}
                  >
                    {thinkingId === n.id ? <span className="velm-think">{t.guest.thinking}</span> : `＋ ${n.title}`}
                  </button>
                ))}
              </div>
              {lastPlaced && (
                <div key={tryLeft.length} style={{ fontSize: 12, color: 'var(--t2)', marginTop: 9, animation: 'velm-rise 0.3s ease-out' }}>
                  {t.guest.placedIn} <span style={{ color: 'var(--amber)' }}>{shown.threads.find(th => th.id === lastPlaced)?.title}</span>
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => setAuthOverlay('register')}
            className="velm-primary"
            style={{ width: '100%', padding: '10px', background: '#F4A261', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 700, color: '#0E0C09', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
          >
            {t.guest.start}
          </button>
          {/* Handy: „Anmelden" steht in der Topbar */}
          {!narrow && <button
            onClick={() => setAuthOverlay('login')}
            className="velm-hover"
            style={{ width: '100%', marginTop: 8, padding: '9px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)', borderRadius: 10, fontSize: 13, fontWeight: 600, color: 'var(--t2)', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
          >
            {t.guest.haveAccount}
          </button>}
          {isDemo && !narrow && (
            <button onClick={replayIntro} className="velm-hover" style={{ ...linkBtnStyle, display: 'block', margin: '12px auto 0' }}>
              {t.guest.replayIntro}
            </button>
          )}
          {/* Handy: der Footer unten rechts ist dort ausgeblendet (.velm-legal), deshalb in der Karte */}
          {narrow && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 10, fontSize: 11, fontFamily: 'Inter, sans-serif' }}>
              <Link href={t.legal.imprintHref} style={{ color: 'var(--t3)', textDecoration: 'none' }}>{t.legal.imprint}</Link>
              <Link href={t.legal.privacyHref} style={{ color: 'var(--t3)', textDecoration: 'none' }}>{t.legal.privacy}</Link>
            </div>
          )}
        </div>
      )}

      {authOverlay && (
        <LoginView key={authOverlay} initialMode={authOverlay} onLogin={handleLogin} onClose={() => setAuthOverlay(null)} />
      )}

      {/* LEERER GRAPH: nur ein Hinweis auf die App — Threads entstehen dort */}
      {userEmpty && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '70px 24px 24px', pointerEvents: 'none' }}>
          <div style={{ maxWidth: 420, textAlign: 'center', animation: 'velm-rise 0.5s ease-out' }}>
            <div style={{ fontFamily: "var(--font-instrument), 'Instrument Serif', Georgia, serif", fontSize: 34, lineHeight: 1.1, color: 'var(--t1)', marginBottom: 12 }}>
              {t.empty.title}
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--t2)' }}>
              {t.empty.body}
            </p>
          </div>
        </div>
      )}

      {/* ZOOM BUTTONS */}
      <div style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', display: userEmpty ? 'none' : 'flex', gap: 5, zIndex: 20 }}>
        <button onClick={() => graphHandle.current?.zoomBy(-0.2)} style={btnStyle}>−</button>
        <button onClick={() => graphHandle.current?.zoomReset()} style={{ ...btnStyle, fontSize: 13, fontWeight: 500 }}>⊙</button>
        <button onClick={() => graphHandle.current?.zoomBy(0.2)} style={btnStyle}>+</button>
      </div>

      {/* IMPRESSUM/DATENSCHUTZ: von der Startseite aus immer erreichbar (Handy: Konto-Menü bzw. Login) */}
      <div className="velm-legal" style={{ position: 'absolute', right: 16, bottom: 10, zIndex: 15, display: 'flex', gap: 12, fontSize: 11, fontFamily: 'Inter, sans-serif' }}>
        <Link href={t.legal.imprintHref} style={{ color: 'var(--t3)', textDecoration: 'none' }}>{t.legal.imprint}</Link>
        <Link href={t.legal.privacyHref} style={{ color: 'var(--t3)', textDecoration: 'none' }}>{t.legal.privacy}</Link>
      </div>

      {/* RÜCKMELDUNG nach der Synthese */}
      {toast && (
        <div key={toast.id} role="status" style={{ position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 70, padding: '10px 16px', maxWidth: 'calc(100vw - 32px)', background: 'rgba(22,18,14,0.95)', border: '1px solid var(--border2)', borderRadius: 12, fontSize: 13, color: 'var(--t1)', backdropFilter: 'blur(12px)', boxShadow: '0 10px 30px rgba(0,0,0,0.4)', animation: 'velm-rise 0.3s ease-out' }}>
          {toast.text}
        </div>
      )}

      {/* TOOLTIP */}
      {tooltip && (
        <div style={{ position: 'absolute', left: tooltip.x, top: tooltip.y, background: 'rgba(22,18,14,0.95)', border: '1px solid var(--border2)', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, color: 'var(--t1)', pointerEvents: 'none', zIndex: 30, whiteSpace: 'normal', maxWidth: 200, backdropFilter: 'blur(10px)' }}>
          {tooltip.label}
        </div>
      )}

      {/* HANDY: Thread-Liste (über dem Graphen, unter der Topbar) */}
      {narrow && showList && (
        <ThreadList threads={shown.threads} notes={shown.notes} query={query} onSelect={selectFromList} />
      )}

      {/* HANDY: zurück zur Übersicht, solange eine Insel fokussiert ist */}
      {sheetOpen && !showList && (
        <button
          onClick={closeThread}
          className="velm-hover"
          style={{ position: 'absolute', top: 64, left: 12, zIndex: 46, padding: '7px 14px', background: 'rgba(14,12,9,0.85)', border: '1px solid var(--border2)', borderRadius: 18, fontSize: 12.5, fontWeight: 600, color: 'var(--t1)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', backdropFilter: 'blur(12px)' }}
        >
          {t.topbar.overview}
        </button>
      )}

      {/* OVERLAYS */}
      {selectedThread && (
        <ThreadPanel
          thread={selectedThread}
          notes={threadNotes}
          similarities={shown.similarities}
          allThreads={shown.threads}
          onNoteClick={handleNoteClick}
          onClose={closeThread}
          variant={narrow ? 'sheet' : 'modal'}
          sheetRef={narrow ? cardRef : undefined}
        />
      )}

      {selectedNote && (
        <NoteViewModal note={selectedNote} onClose={() => setSelectedNote(null)} onDelete={user ? handleDeleteNote : undefined} />
      )}

      {showCreate && user && (
        <NoteCreateModal
          threads={graphData.threads}
          categories={categoriesFor(graphData.notes.map(n => n.category))}
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
