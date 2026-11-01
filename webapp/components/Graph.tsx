'use client';

import { useEffect, useRef } from 'react';
import { GraphData, Thread, Note, Similarity } from '@/types';
import { categoryAccent } from '@/lib/categoryAccent';
import {
  computeLayout, hull, simCurve, ISLAND_COLORS,
  Box, GraphLayout, LNode, LNote, LSim, LThread, Measure,
} from '@/lib/graphLayout';

// ── Insel-Graph ─────────────────────────────────────────────────────────────
// Jeder Thread ist eine eingefärbte Insel, seine Notizen liegen als Pillen darin. KI-Verbindungen sind
// leise Linien zwischen den Inseln; Brücke + Beschriftung erscheinen erst bei Fokus (Hover/Auswahl).
//
// Viele Notizen: herausgezoomt nur Inseln + Punkte (Detailstufen), Beschriftungen ohne Überlappung
// (wichtige gewinnen), Insel-Namen in konstanter Bildschirmgröße.
// Rechenleistung: Inseln, Linien und Notizen liegen in einem Zwischenbild, das nur bei Änderungen neu
// gemalt wird (Verschieben = Bild kopieren); im Leerlauf 30 statt 60 Bilder/s.
//
// Intro (Erstbesuch, Demo): Notizen liegen erst lose verstreut, fliegen dann Thread für Thread auf ihre
// Inseln, zuletzt werden die Verbindungen gezogen. Läuft ohne Zwischenbild direkt auf dem Canvas — nur für
// kleine Graphen gedacht; jede Eingabe im Graphen bricht es ab.
// Leerlauf-Bewegung: Inseln „atmen" (weicher Schein darunter), Lichtpunkte wandern über die Verbindungen.
// Beides liegt außerhalb des Zwischenbilds (vorgefertigte Sprites, nur drawImage) und entfällt bei
// prefers-reduced-motion.

const BG = '#0E0C09';
const LOD = 0.55;        // ab diesem Zoom: Pillen mit Titel statt Punkte
const CHIP_ZOOM = 0.9;   // ab diesem Zoom: KI-Verbindungen auch ohne Fokus beschriftet
const DIM = 0.18;        // Deckkraft von allem außerhalb des Fokus
const ISLAND_PAD = 26;   // Rand der Insel um ihre Notizen
const MAX_DPR = 2;
const Z_MIN = 0.08, Z_MAX = 3;
const DEFAULT_INSETS: GraphInsets = { top: 70, right: 24, bottom: 90, left: 24 };
const CAM_K = 0.12, CAM_K_SLOW = 0.045; // Kamera-Nachlauf pro Bild: normal / Spotlight-Flug
// Intro-Zeitplan (Sekunden)
const I_APPEAR = 1.0, I_GATHER = 2.2, I_THREAD_GAP = 0.2, I_NOTE_GAP = 0.05, I_FLY = 1.1, I_SIM_GAP = 0.25, I_SIM = 0.7;

export interface GraphInsets { top: number; right: number; bottom: number; left: number }

export type GraphMatch = { type: 'note'; note: Note } | { type: 'thread'; thread: Thread };

/** Intro-Fortschritt: drei Phasen, dann `done` (durchgelaufen/übersprungen) oder `interrupted` (Eingabe im Graphen). */
export type IntroEvent = 'scatter' | 'gather' | 'connect' | 'done' | 'interrupted';

export interface GraphSpotlight { similarityId: string; noteIds: [string, string] }

export interface GraphHandle {
  zoomBy: (delta: number) => void;
  zoomReset: () => void;
  /** Springt zum ersten Treffer (Thread-Titel vor Notiz-Titel) und gibt ihn zurück. */
  flyToMatch: (query: string) => GraphMatch | null;
  skipIntro: () => void;
}

interface Props {
  data: GraphData;
  onThreadClick: (t: Thread) => void;
  onNoteClick: (n: Note) => void;
  onSimilarityClick: (s: Similarity) => void;
  activeThreadId: string | null;
  activeSimilarityId: string | null;
  onTooltip: (label: string | null, x: number, y: number) => void;
  handleRef?: React.MutableRefObject<GraphHandle | null>;
  /** Suchbegriff: Treffer bleiben hell, der Rest wird gedimmt. */
  query?: string;
  /** Freizuhaltende Ränder (Topbar, Hinweiskarten) — „alles zeigen" passt den Graphen dazwischen. */
  insets?: GraphInsets;
  /** Intro abspielen: jeder neue Wert ≠ 0 startet es (neu), 0 bricht es ab. */
  introKey?: number;
  onIntro?: (e: IntroEvent) => void;
  /** Hebt eine Verbindung samt der zwei Notizen hervor, aus denen sie entsteht; die Kamera fliegt hin. */
  spotlight?: GraphSpotlight | null;
}

// ── kleine Helfer ───────────────────────────────────────────────────────────
function rgb(hex: string) { return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]; }
function rgba(hex: string, a: number) { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; }
function mix(hex: string, bg: string, t: number) {
  const a = rgb(hex), b = rgb(bg);
  return '#' + a.map((v, i) => Math.round(b[i] + (v - b[i]) * t).toString(16).padStart(2, '0')).join('');
}
function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { c.beginPath(); c.roundRect(x, y, w, h, r); }
const noteTitle = (n: Note) => n.title?.trim() || 'Ohne Titel';
const islandColor = (t: LThread) => ISLAND_COLORS[t.color % ISLAND_COLORS.length];

/** Schriftfamilien aus next/font (CSS-Variablen am <html>), damit der Canvas dieselben Fonts nutzt. */
function fontFamilies() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return { serif: v('--font-instrument', "'Instrument Serif', Georgia, serif"), sans: v('--font-inter', 'Inter, system-ui, sans-serif') };
}

interface Label {
  text: string; x: number; y: number; font: string; h: number; w: number; color: string; a: number; pri: number;
  padX: number; padY: number; id?: string; bg?: (box: number[]) => void;
}
interface IntroNote { sx: number; sy: number; r: number; appear: number; go: number; i: number }
interface Intro {
  t0: number; step: IntroEvent; notes: Map<string, IntroNote>; isles: Map<string, number>; sims: Map<string, number>;
  connect: number; end: number; z: number;
}
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeInOut = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
/** Punkt auf der quadratischen Kurve a → (Kontrollpunkt c) → b */
const qPoint = (ax: number, ay: number, cx: number, cy: number, bx: number, by: number, t: number): [number, number] =>
  [(1 - t) * (1 - t) * ax + 2 * (1 - t) * t * cx + t * t * bx, (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * cy + t * t * by];

interface Drag { node: LThread | null; sx: number; sy: number; cx: number; cy: number; moved: boolean; last: [number, number]; clicked: LNode | null }

export default function Graph(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  useEffect(() => { propsRef.current = props; });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    // Alte Drag-Positionen des früheren Graphen (Bruchteil-Koordinaten) sind mit dem neuen Layout wertlos.
    try { localStorage.removeItem('notiz_thread_positions'); localStorage.removeItem('notiz_note_positions'); } catch {}

    // ── Zustand (lebt nur in diesem Effekt, löst keine Re-Renders aus) ──
    let W = 0, H = 0, DPR = 1, T = 0, raf = 0, lastDraw = 0, lastInput = 0;
    let fonts = fontFamilies();
    const cam = { x: 0, y: 0, z: 1, tx: 0, ty: 0, tz: 1 };
    const fitCam = { x: 0, y: 0, z: 1 };
    let G: GraphLayout | null = null, layoutData: GraphData | null = null, layoutVer = 0, threadKey = '';
    let hover: LNode | null = null, drag: Drag | null = null;
    let pinch: { d: number; z: number; wx: number; wy: number } | null = null;
    const pointers = new Map<number, { x: number; y: number }>();
    const fade = new Map<string, number>();
    let fadeVer = 0, FS: Set<string> | null = null;
    let VIEW = { x0: 0, y0: 0, x1: 0, y1: 0 };
    const widths = new Map<string, number>();
    const hulls = new Map<string, { v: number; hull: Array<[number, number]>; shared: LNote[] }>();
    const simGrad = new Map<string, { v: number; g: CanvasGradient }>();
    const labelBoxes = new Map<string, number[]>(); // Thread-ID → zuletzt gezeichneter Titel (Welt), für Klicks
    let search = { q: '', v: -1, set: null as Set<string> | null };
    let camK = CAM_K, fontsOk = false, intro: Intro | null = null, introSeen = 0, spotSeen: string | null = null;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let ambientFrom = 0; // Leerlauf-Bewegung blendet ab hier ein (Seitenstart, Intro-Ende)
    function sprite(stops: Array<[number, string]>) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 128;
      const c = cv.getContext('2d')!, gr = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      for (const [o, col] of stops) gr.addColorStop(o, col);
      c.fillStyle = gr; c.fillRect(0, 0, 128, 128);
      return cv;
    }
    const halos = ISLAND_COLORS.map(col => sprite([[0, rgba(col, 0.5)], [0.5, rgba(col, 0.2)], [1, rgba(col, 0)]]));
    const spark = sprite([[0, 'rgba(255,240,222,1)'], [0.2, 'rgba(244,162,97,0.6)'], [1, 'rgba(244,162,97,0)']]);

    const F = {
      title: (px: number) => `400 ${px}px ${fonts.serif}`,
      pill: () => `500 12px ${fonts.sans}`,
      chip: () => `600 11.5px ${fonts.sans}`,
      small: () => `600 10px ${fonts.sans}`,
    };
    function textW(text: string, font: string) {
      const k = font + '|' + text;
      let w = widths.get(k);
      if (w === undefined) { ctx.font = font; w = ctx.measureText(text).width; widths.set(k, w); }
      return w;
    }
    function trunc(text: string, font: string, max: number) {
      if (textW(text, font) <= max) return text;
      let s = text;
      while (s.length > 1 && textW(s + '…', font) > max) s = s.slice(0, -1);
      return s + '…';
    }
    const measure: Measure = {
      thread: t => { const cw = textW(t.title, F.title(24)) + 34; return { cw, hw: cw / 2, hh: 20 }; },
      note: n => { const cw = Math.min(176, textW(noteTitle(n), F.pill()) + 34); return { cw, hw: cw / 2, hh: 14 }; },
      sim: s => ({ hw: (textW('✦ ' + s.label, F.chip()) + 22) / 2, hh: 13 }),
    };

    // ── Kamera ──
    const worldT = (c: CanvasRenderingContext2D) => c.setTransform(DPR * cam.z, 0, 0, DPR * cam.z, DPR * (W / 2 - cam.x * cam.z), DPR * (H / 2 - cam.y * cam.z));
    const screenT = (c: CanvasRenderingContext2D) => c.setTransform(DPR, 0, 0, DPR, 0, 0);
    const toWorld = (sx: number, sy: number): [number, number] => [(sx - W / 2) / cam.z + cam.x, (sy - H / 2) / cam.z + cam.y];
    const vis = (o: Box, m = 0) => o.x + o.hw + m > VIEW.x0 && o.x - o.hw - m < VIEW.x1 && o.y + o.hh + m > VIEW.y0 && o.y - o.hh - m < VIEW.y1;
    /** Schriftgröße, die beim Herauszoomen auf dem Bildschirm nicht unter px fällt */
    const sf = (px: number) => px / Math.min(1, cam.z);

    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      W = canvas!.clientWidth; H = canvas!.clientHeight;
      canvas!.width = Math.round(W * DPR); canvas!.height = Math.round(H * DPR);
      IC.ok = false;
    }

    function ensureLayout(): GraphLayout {
      const data = propsRef.current.data;
      if (G && layoutData === data) return G;
      G = computeLayout(data, measure); layoutData = data; layoutVer++; IC.ok = false; fade.clear();
      const key = data.threads.map(t => t.id).sort().join(',');
      if (key !== threadKey) { threadKey = key; fit(true); }
      return G;
    }

    /** Kamera, die den Weltausschnitt in den freien Bereich (ohne Insets) einpasst */
    function frameBox(x0: number, y0: number, x1: number, y1: number, maxZ: number) {
      const ins = propsRef.current.insets ?? DEFAULT_INSETS;
      const left = W > 900 ? ins.left : DEFAULT_INSETS.left; // schmale Bildschirme: Hinweiskarte darf überlappen
      const aw = Math.max(100, W - left - ins.right), ah = Math.max(100, H - ins.top - ins.bottom);
      const z = Math.max(Z_MIN, Math.min(maxZ, Math.min(aw / (x1 - x0), ah / (y1 - y0))));
      return { x: (x0 + x1) / 2 - (left + aw / 2 - W / 2) / z, y: (y0 + y1) / 2 - (ins.top + ah / 2 - H / 2) / z, z };
    }
    function fit(instant = false) {
      if (!G || !G.all.length) { Object.assign(fitCam, { x: 0, y: 0, z: 1 }); }
      else {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const p of G.all) { x0 = Math.min(x0, p.x - p.hw); x1 = Math.max(x1, p.x + p.hw); y0 = Math.min(y0, p.y - p.hh); y1 = Math.max(y1, p.y + p.hh); }
        const m = ISLAND_PAD + 10;
        Object.assign(fitCam, frameBox(x0 - m, y0 - m, x1 + m, y1 + m, 1.2));
      }
      cam.tx = fitCam.x; cam.ty = fitCam.y; cam.tz = fitCam.z; camK = CAM_K;
      if (instant) { cam.x = cam.tx; cam.y = cam.ty; cam.z = cam.tz; }
    }
    function flyTo(x: number, y: number, z: number) {
      cam.tz = Math.max(Z_MIN, Math.min(Z_MAX, z)); cam.tx = x; cam.ty = y; camK = CAM_K;
    }
    function flyToThread(t: LThread) {
      flyTo(t.x, t.y, Math.min(1.1, Math.min(W - 120, H - 160) / (2 * t.R + 2 * ISLAND_PAD + 80)));
    }
    function zoomAround(sx: number, sy: number, nz: number) {
      const [wx, wy] = toWorld(sx, sy);
      nz = Math.max(Z_MIN, Math.min(Z_MAX, nz));
      cam.tx = wx - (sx - W / 2) / nz; cam.ty = wy - (sy - H / 2) / nz; cam.tz = nz; camK = CAM_K;
    }

    // ── Fokus & Suche ──
    function searchSet(g: GraphLayout): Set<string> | null {
      const q = (propsRef.current.query ?? '').trim().toLowerCase();
      if (q !== search.q || search.v !== layoutVer) {
        let set: Set<string> | null = null;
        if (q) {
          set = new Set();
          for (const t of g.threads) if (t.data.title.toLowerCase().includes(q)) set.add(t.id);
          for (const n of g.notes) if (noteTitle(n.data).toLowerCase().includes(q)) { set.add(n.id); n.threadIds.forEach(id => set!.add(id)); }
          if (!set.size) set = null; // nichts gefunden → nicht alles abdunkeln
        }
        search = { q, v: layoutVer, set };
      }
      return search.set;
    }
    function selectedNode(g: GraphLayout): LNode | null {
      const p = propsRef.current;
      if (p.activeThreadId) { const t = g.byId.get(p.activeThreadId); if (t) return t; }
      if (p.activeSimilarityId) { const s = g.sims.find(x => x.id === p.activeSimilarityId); if (s) return s; }
      return spotlightOf(g)?.s ?? null;
    }
    function spotlightOf(g: GraphLayout): { s: LSim; a: LNote; b: LNote } | null {
      const sp = propsRef.current.spotlight;
      if (!sp) return null;
      const s = g.sims.find(x => x.id === sp.similarityId);
      const a = g.notes.find(n => n.id === sp.noteIds[0]), b = g.notes.find(n => n.id === sp.noteIds[1]);
      return s && a && b ? { s, a, b } : null;
    }
    function flyToSpotlight(g: GraphLayout) {
      const sp = spotlightOf(g); if (!sp) return;
      const a = g.byId.get(sp.s.a)!, b = g.byId.get(sp.s.b)!, m = ISLAND_PAD + 30;
      const c = frameBox(Math.min(a.x - a.R, b.x - b.R) - m, Math.min(a.y - a.R, b.y - b.R) - m,
        Math.max(a.x + a.R, b.x + b.R) + m, Math.max(a.y + a.R, b.y + b.R) + m, 1.15);
      flyTo(c.x, c.y, c.z); camK = CAM_K_SLOW;
    }
    function focusSet(g: GraphLayout): Set<string> | null {
      const f = hover ?? selectedNode(g);
      if (!f) return searchSet(g);
      if (drag?.moved) return null;
      const s = new Set([f.id]);
      if (f.kind === 'thread') {
        for (const n of f.members) s.add(n.id);
        for (const x of g.sims) if (x.a === f.id || x.b === f.id) { s.add(x.id); s.add(x.a); s.add(x.b); }
      } else if (f.kind === 'note') { for (const id of f.threadIds) s.add(id); }
      else {
        s.add(f.a); s.add(f.b);
        const sp = spotlightOf(g);
        if (sp?.s === f) { s.add(sp.a.id); s.add(sp.b.id); }
      }
      return s;
    }
    function updateFade(g: GraphLayout) {
      FS = focusSet(g);
      let changed = false;
      for (const o of g.all) {
        const tgt = !FS || FS.has(o.id) ? 1 : DIM, cur = fade.get(o.id) ?? 1;
        if (cur !== tgt) { changed = true; fade.set(o.id, Math.abs(tgt - cur) < 0.01 ? tgt : cur + (tgt - cur) * 0.18); }
      }
      if (changed) fadeVer++;
      return changed;
    }
    const al = (id: string) => fade.get(id) ?? 1;
    const inFocus = (o: LNode) => !!FS && FS.has(o.id);
    const isHot = (o: LNode) => hover?.id === o.id || selectedNode(G!)?.id === o.id;
    const chipVisible = (s: LSim) => cam.z >= CHIP_ZOOM || inFocus(s);

    // ── Beschriftungen ohne Überlappung ──
    let labels: Label[] = [];
    function flushLabels() {
      labels.sort((a, b) => b.pri - a.pri);
      const grid = new Map<number, number[][]>(), cell = 160 / cam.z;
      labelBoxes.clear();
      for (const l of labels) {
        const x0 = l.x - l.w / 2, box = [x0 - l.padX, l.y - l.padY, x0 + l.w + l.padX, l.y + l.h + l.padY];
        const gx0 = Math.floor(box[0] / cell), gx1 = Math.floor(box[2] / cell), gy0 = Math.floor(box[1] / cell), gy1 = Math.floor(box[3] / cell);
        let ok = true;
        outer: for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) {
          for (const r of grid.get(gx * 1e6 + gy) ?? []) if (box[0] < r[2] && box[2] > r[0] && box[1] < r[3] && box[3] > r[1]) { ok = false; break outer; }
        }
        if (!ok) continue;
        for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) {
          const k = gx * 1e6 + gy; if (!grid.has(k)) grid.set(k, []); grid.get(k)!.push(box);
        }
        if (l.id) labelBoxes.set(l.id, box);
        ctx.globalAlpha = l.a;
        l.bg?.(box);
        ctx.font = l.font; ctx.fillStyle = l.color; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(l.text, l.x, l.y);
      }
      ctx.globalAlpha = 1; labels = [];
    }

    // ── Zwischenbild für die statische Ebene ──
    // Deckt den sichtbaren Bereich + 25 % Rand ab und wird wiederverwendet, solange Layout, Fokus und Zoom
    // gleich sind. Während einer Zoom-Animation wird es nur skaliert und erst in Ruhe neu gemalt.
    const IC = { cv: document.createElement('canvas'), ok: false, x0: 0, y0: 0, x1: 0, y1: 0, z: 1, lv: -1, fv: -1, key: '' };
    function cachedLayer(key: string, drawFn: (c: CanvasRenderingContext2D, inView: (o: Box) => boolean) => void) {
      const z = cam.z, settled = Math.abs(cam.tz - z) <= cam.tz * 1e-4;
      const inside = IC.ok && VIEW.x0 >= IC.x0 && VIEW.y0 >= IC.y0 && VIEW.x1 <= IC.x1 && VIEW.y1 <= IC.y1;
      const ratio = IC.ok ? z / IC.z : 0;
      const same = IC.ok && IC.lv === layoutVer && IC.fv === fadeVer && IC.key === key;
      if (!(same && inside && (ratio === 1 || (!settled && ratio > 0.8 && ratio < 1.25)))) {
        const mx = (VIEW.x1 - VIEW.x0) * 0.25, my = (VIEW.y1 - VIEW.y0) * 0.25;
        Object.assign(IC, { x0: VIEW.x0 - mx, y0: VIEW.y0 - my, x1: VIEW.x1 + mx, y1: VIEW.y1 + my, z });
        const pw = Math.ceil((IC.x1 - IC.x0) * z * DPR), ph = Math.ceil((IC.y1 - IC.y0) * z * DPR);
        if (IC.cv.width !== pw || IC.cv.height !== ph) { IC.cv.width = pw; IC.cv.height = ph; }
        const c = IC.cv.getContext('2d')!;
        c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, pw, ph);
        c.setTransform(DPR * z, 0, 0, DPR * z, -IC.x0 * DPR * z, -IC.y0 * DPR * z);
        drawFn(c, o => o.x + o.hw > IC.x0 && o.x - o.hw < IC.x1 && o.y + o.hh > IC.y0 && o.y - o.hh < IC.y1);
        Object.assign(IC, { ok: true, lv: layoutVer, fv: fadeVer, key });
      }
      const dx = (IC.x0 - cam.x) * z + W / 2, dy = (IC.y0 - cam.y) * z + H / 2;
      if (z === IC.z) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(IC.cv, Math.round(dx * DPR), Math.round(dy * DPR)); }
      else { screenT(ctx); ctx.drawImage(IC.cv, dx, dy, (IC.x1 - IC.x0) * z, (IC.y1 - IC.y0) * z); }
      worldT(ctx);
    }

    function islandShape(c: CanvasRenderingContext2D, t: LThread, pad: number) {
      let h = hulls.get(t.id);
      if (!h || h.v !== layoutVer) {
        const pts: Array<[number, number]> = [];
        for (const p of [t, ...t.own]) for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pts.push([p.x + sx * p.hw, p.y + sy * p.hh]);
        h = { v: layoutVer, hull: hull(pts), shared: t.members.filter(n => n.threadIds.length > 1) };
        hulls.set(t.id, h);
      }
      c.lineJoin = 'round'; c.lineCap = 'round';
      c.beginPath(); h.hull.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath();
      c.lineWidth = pad * 2; c.fill(); c.stroke();
      // Alt-Daten: Notiz in mehreren Threads hängt als Landzunge an der Insel
      for (const n of h.shared) {
        c.lineWidth = pad * 1.3; c.beginPath(); c.moveTo(t.x, t.y); c.lineTo(n.x, n.y); c.stroke();
        rr(c, n.x - n.hw - pad * 0.6, n.y - n.hh - pad * 0.6, 2 * (n.hw + pad * 0.6), 2 * (n.hh + pad * 0.6), n.hh + pad * 0.6); c.fill();
      }
    }

    function gradientFor(s: LSim, a: LThread, b: LThread, c: CanvasRenderingContext2D) {
      if (c !== ctx) { const g = c.createLinearGradient(a.x, a.y, b.x, b.y); g.addColorStop(0, islandColor(a)); g.addColorStop(1, islandColor(b)); return g; }
      let e = simGrad.get(s.id);
      if (!e || e.v !== layoutVer) {
        const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y); g.addColorStop(0, islandColor(a)); g.addColorStop(1, islandColor(b));
        e = { v: layoutVer, g }; simGrad.set(s.id, e);
      }
      return e.g;
    }

    // ── Zeichnen ──
    function backdrop() {
      screenT(ctx);
      ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
      const glow = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.7);
      glow.addColorStop(0, 'rgba(60,46,30,0.35)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    }
    /** Notiz-Pille bei (x, y); `stroke` ersetzt den Rand in Inselfarbe (Intro: noch keinem Thread zugeordnet). */
    function pill(c: CanvasRenderingContext2D, n: LNote, x: number, y: number, h: boolean, stroke?: string) {
      const cols = n.threadIds.map(id => islandColor(G!.byId.get(id)!));
      rr(c, x - n.cw / 2, y - 14, n.cw, 28, 14);
      c.fillStyle = h ? '#2E261E' : '#1E1913'; c.fill();
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; }
      else if (cols.length > 1) {
        const lg = c.createLinearGradient(x - n.cw / 2, 0, x + n.cw / 2, 0);
        cols.forEach((col, i) => lg.addColorStop(i / (cols.length - 1), col)); c.strokeStyle = lg; c.lineWidth = 1.6;
      } else { c.strokeStyle = rgba(cols[0], h ? 0.9 : 0.4); c.lineWidth = 1; }
      c.stroke();
      c.fillStyle = categoryAccent(n.data.category); c.beginPath(); c.arc(x - n.cw / 2 + 14, y, 3.2, 0, 7); c.fill();
      c.font = F.pill(); c.fillStyle = h ? '#FFFFFF' : '#E8DCCB'; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(trunc(noteTitle(n.data), F.pill(), n.cw - 34), x - n.cw / 2 + 24, y + 0.5);
    }
    /** Insel-Name: konstante Bildschirmgröße, große/fokussierte Threads gewinnen bei Platzmangel */
    function threadLabel(t: LThread, a: number, h: boolean, focus: boolean) {
      const col = islandColor(t), px = Math.max(24, sf(17)), font = F.title(px), z = cam.z;
      labels.push({
        text: t.data.title, x: t.x, y: t.y - px * 0.55, font, h: px, w: textW(t.data.title, font), color: h ? '#15110D' : col, a,
        pri: h ? 2000 : focus ? 1000 : 100 + t.count, padX: px * 0.7, padY: px * 0.25, id: t.id,
        bg: box => {
          rr(ctx, box[0], box[1], box[2] - box[0], box[3] - box[1], (box[3] - box[1]) / 2);
          ctx.fillStyle = h ? col : mix(col, BG, 0.22); ctx.fill();
          ctx.strokeStyle = rgba(col, 0.7); ctx.lineWidth = 1.2 / z; ctx.stroke();
        },
      });
    }
    function simChip(s: LSim, a: number, light: boolean) {
      const w = s.hw * 2;
      ctx.globalAlpha = a;
      rr(ctx, s.x - w / 2, s.y - 13, w, 26, 13); ctx.fillStyle = light ? '#F2EDE6' : '#221C16'; ctx.fill();
      ctx.strokeStyle = 'rgba(242,237,230,0.25)'; ctx.lineWidth = 1 / cam.z; ctx.stroke();
      ctx.font = F.chip(); ctx.fillStyle = light ? '#15110D' : '#E8DCCB'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('✦ ' + s.data.label, s.x, s.y + 0.5);
    }

    function draw(g: GraphLayout) {
      backdrop();

      const z = cam.z, detail = z >= LOD;
      const sel = selectedNode(g);
      const key = `${detail}|${hover?.id ?? ''}|${sel?.id ?? ''}|${search.q}`;
      const amb = calm ? 0 : clamp01((T * 1000 - ambientFrom) / 1500);

      // Atmender Schein unter den Inseln (das Zwischenbild ist außerhalb der Inseln durchsichtig); in der
      // Übersicht weggelassen — dort lägen viele große Sprites übereinander, und man sähe sie kaum
      if (amb > 0 && detail) {
        worldT(ctx);
        for (const t of g.threads) {
          const r0 = (t.R + ISLAND_PAD) * 1.4;
          if (!vis({ x: t.x, y: t.y, hw: r0, hh: r0 })) continue;
          const b = Math.sin(T * 0.55 + t.idx * 1.7), r = r0 * (1 + 0.05 * b);
          ctx.globalAlpha = amb * al(t.id) * (0.38 + 0.2 * b);
          ctx.drawImage(halos[t.color % halos.length], t.x - r, t.y - r, 2 * r, 2 * r);
        }
        ctx.globalAlpha = 1;
      }

      cachedLayer(key, (c, inView) => {
        // Inseln: deckende Mischfarben statt Transparenz (schnell, keine Überblendungs-Artefakte)
        for (const t of g.threads) {
          if (!inView({ x: t.x, y: t.y, hw: t.R + 60, hh: t.R + 60 })) continue;
          const col = islandColor(t), hot = inFocus(t);
          c.globalAlpha = al(t.id);
          c.fillStyle = c.strokeStyle = mix(col, BG, hot ? 0.75 : 0.4); islandShape(c, t, ISLAND_PAD + 1.6 / z);
          c.fillStyle = c.strokeStyle = mix(col, BG, hot ? 0.2 : 0.12); islandShape(c, t, ISLAND_PAD);
        }
        // KI-Verbindungen: leise Linie, im Fokus breites Brücken-Band
        c.lineCap = 'round';
        for (const s of g.sims) {
          const a = g.byId.get(s.a)!, b = g.byId.get(s.b)!, cc = simCurve(s, a, b), hot = inFocus(s);
          c.strokeStyle = gradientFor(s, a, b, c);
          c.globalAlpha = al(s.id) * (hot ? 0.22 : 0.3); c.lineWidth = hot ? 16 : 1.2 / z;
          c.beginPath(); c.moveTo(a.x, a.y); c.quadraticCurveTo(cc.cx, cc.cy, b.x, b.y); c.stroke();
        }
        // Notizen: Pillen mit Titel, herausgezoomt nur Punkte
        for (const n of g.notes) {
          if (!inView(n)) continue;
          const h = hover?.id === n.id;
          c.globalAlpha = al(n.id);
          if (!detail && !h) { c.fillStyle = mix(islandColor(g.byId.get(n.threadIds[0])!), BG, 0.7); c.beginPath(); c.arc(n.x, n.y, Math.max(5, 2.2 / z), 0, 7); c.fill(); continue; }
          pill(c, n, n.x, n.y, h);
        }
        c.globalAlpha = 1;
      });

      // Live-Ebene: Lichtpunkte, Spotlight (Faden zwischen den zwei Notizen), Fokus-Brücken (laufende Striche), Beschriftungen
      if (amb > 0 && z > 0.15) {
        g.sims.forEach((s, i) => {
          const a = g.byId.get(s.a)!, b = g.byId.get(s.b)!, d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          // nur in der Lücke zwischen den Inseln, nicht über den Pillen
          const t0 = (a.R + ISLAND_PAD) / d, t1 = 1 - (b.R + ISLAND_PAD) / d;
          if (t1 - t0 < 0.05 || !vis({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, hw: Math.abs(b.x - a.x) / 2, hh: Math.abs(b.y - a.y) / 2 })) return;
          const u = (T * 34 / ((t1 - t0) * d) + i * 0.618) % 1, cc = simCurve(s, a, b);
          const [x, y] = qPoint(a.x, a.y, cc.cx, cc.cy, b.x, b.y, t0 + (t1 - t0) * u), r = 10 / z;
          ctx.globalAlpha = amb * al(s.id) * Math.sin(Math.PI * u) * 0.9;
          ctx.drawImage(spark, x - r, y - r, 2 * r, 2 * r);
        });
        ctx.globalAlpha = 1;
      }
      const sp = spotlightOf(g);
      if (sp && sel === sp.s && (!hover || hover === sp.s || hover === sp.a || hover === sp.b)) {
        const { s, a, b } = sp, cc = simCurve(s, a, b), aa = al(a.id), pulse = 0.55 + 0.35 * Math.sin(T * 3);
        const lg = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        lg.addColorStop(0, islandColor(g.byId.get(a.threadIds[0])!)); lg.addColorStop(1, islandColor(g.byId.get(b.threadIds[0])!));
        ctx.globalAlpha = aa; ctx.strokeStyle = lg; ctx.lineWidth = 1.8 / Math.min(1, z); ctx.lineCap = 'round';
        ctx.setLineDash([7 / z, 6 / z]); ctx.lineDashOffset = -T * 14 / z;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(cc.cx, cc.cy, b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
        for (const n of [a, b]) {
          const col = islandColor(g.byId.get(n.threadIds[0])!), m = 5;
          ctx.globalAlpha = aa * pulse * 0.35; ctx.fillStyle = col;
          rr(ctx, n.x - n.cw / 2 - m, n.y - 14 - m, n.cw + 2 * m, 28 + 2 * m, 14 + m); ctx.fill();
          ctx.globalAlpha = aa; pill(ctx, n, n.x, n.y, true, rgba(col, 0.95));
        }
        ctx.globalAlpha = 1;
      }
      for (const s of g.sims) {
        const a = g.byId.get(s.a)!, b = g.byId.get(s.b)!, hot = inFocus(s), aa = al(s.id);
        if (hot) {
          const cc = simCurve(s, a, b);
          ctx.strokeStyle = gradientFor(s, a, b, ctx); ctx.lineCap = 'round';
          ctx.globalAlpha = aa * 0.9; ctx.lineWidth = 1.3 / z; ctx.setLineDash([6 / z, 5 / z]); ctx.lineDashOffset = -T * 10 / z;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(cc.cx, cc.cy, b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
        }
        if (!chipVisible(s) || !vis(s)) continue;
        simChip(s, aa * (hot ? 1 : 0.75), isHot(s) || hot);
      }
      ctx.globalAlpha = 1;
      for (const t of g.threads) if (vis(t, 80)) threadLabel(t, al(t.id), isHot(t), inFocus(t));
      flushLabels();
    }

    // ── Intro ──
    function startIntro(g: GraphLayout) {
      fit(true);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const t of g.threads) { x0 = Math.min(x0, t.x - t.R); x1 = Math.max(x1, t.x + t.R); y0 = Math.min(y0, t.y - t.R); y1 = Math.max(y1, t.y + t.R); }
      // Lose verstreut: „bester Kandidat" aus 14 Zufallspunkten hält die Pillen auseinander
      const placed: Array<[number, number]> = [], notes = new Map<string, IntroNote>();
      const order = [...g.notes].sort(() => Math.random() - 0.5);
      order.forEach((n, i) => {
        let best: [number, number] = [0, 0], bd = -1;
        for (let k = 0; k < 14; k++) {
          const c: [number, number] = [x0 + Math.random() * (x1 - x0), y0 + Math.random() * (y1 - y0)];
          const d = placed.reduce((m, p) => Math.min(m, Math.hypot((p[0] - c[0]) / 2.2, p[1] - c[1])), Infinity);
          if (d > bd) { bd = d; best = c; }
        }
        placed.push(best);
        notes.set(n.id, { sx: best[0], sy: best[1], r: (Math.random() - 0.5) * 0.45, appear: 0.2 + I_APPEAR * i / order.length, go: 0, i });
      });
      // Einsammeln: Threads von links nach rechts, Notizen leicht versetzt
      const isles = new Map<string, number>();
      let arrive = I_GATHER;
      [...g.threads].sort((a, b) => a.x - b.x).forEach((t, j) => {
        const go = I_GATHER + j * I_THREAD_GAP;
        t.members.forEach((n, k) => { const o = notes.get(n.id); if (o && !o.go) o.go = go + k * I_NOTE_GAP; });
        isles.set(t.id, go + I_FLY * 0.45);
        arrive = Math.max(arrive, go + Math.max(0, t.members.length - 1) * I_NOTE_GAP + I_FLY);
      });
      const sims = new Map<string, number>(), connect = arrive + 0.15;
      [...g.sims].sort((a, b) => a.x - b.x).forEach((s, i) => sims.set(s.id, connect + i * I_SIM_GAP));
      // Am Ende stehen alle Verbindungs-Labels kurz da, damit man sie lesen kann
      const end = Math.max(connect + 2.4, connect + Math.max(0, g.sims.length - 1) * I_SIM_GAP + I_SIM + 1.6);
      intro = { t0: performance.now(), step: 'scatter', notes, isles, sims, connect, end, z: fitCam.z };
      hover = null; propsRef.current.onTooltip(null, 0, 0);
      propsRef.current.onIntro?.('scatter');
    }
    function endIntro(e: 'done' | 'interrupted') {
      if (!intro) return;
      intro = null; IC.ok = false; fade.clear(); ambientFrom = performance.now();
      cam.x = cam.tx = fitCam.x; cam.y = cam.ty = fitCam.y; cam.z = cam.tz = fitCam.z;
      propsRef.current.onIntro?.(e);
    }
    function drawIntro(g: GraphLayout, sec: number) {
      const I = intro!;
      // Kamera: langsames Heranfahren bis zum Ende des Einsammelns
      const zp = easeOut(clamp01(sec / I.connect));
      cam.x = cam.tx = fitCam.x; cam.y = cam.ty = fitCam.y; cam.z = cam.tz = I.z * (0.88 + 0.12 * zp);
      const z = cam.z;
      const [vx0, vy0] = toWorld(0, 0), [vx1, vy1] = toWorld(W, H);
      VIEW = { x0: vx0, y0: vy0, x1: vx1, y1: vy1 };
      backdrop(); worldT(ctx);

      // Inseln wachsen, sobald ihre Notizen ankommen (Rand leuchtet dabei kurz auf)
      for (const t of g.threads) {
        const p = clamp01((sec - I.isles.get(t.id)!) / 0.7);
        if (p <= 0) continue;
        const col = islandColor(t), k = 0.75 + 0.25 * easeOutBack(p);
        ctx.save(); ctx.translate(t.x, t.y); ctx.scale(k, k); ctx.translate(-t.x, -t.y);
        ctx.globalAlpha = easeOut(p);
        ctx.fillStyle = ctx.strokeStyle = mix(col, BG, 0.4 + 0.45 * Math.sin(Math.PI * p)); islandShape(ctx, t, ISLAND_PAD + 1.6 / z);
        ctx.fillStyle = ctx.strokeStyle = mix(col, BG, 0.12); islandShape(ctx, t, ISLAND_PAD);
        ctx.restore();
      }
      // Verbindungen werden gezogen, ein Lichtpunkt läuft vorneweg
      ctx.lineCap = 'round';
      for (const s of g.sims) {
        const p = clamp01((sec - I.sims.get(s.id)!) / I_SIM);
        if (p <= 0) continue;
        const a = g.byId.get(s.a)!, b = g.byId.get(s.b)!, cc = simCurve(s, a, b), e = easeInOut(p), N = 32;
        const glowing = 1 - clamp01((sec - I.sims.get(s.id)! - I_SIM) / 0.8);
        ctx.globalAlpha = 0.3 + 0.4 * glowing; ctx.strokeStyle = gradientFor(s, a, b, ctx); ctx.lineWidth = (1.2 + glowing) / z;
        ctx.beginPath(); ctx.moveTo(a.x, a.y);
        for (let i = 1; i <= Math.ceil(N * e); i++) { const [x, y] = qPoint(a.x, a.y, cc.cx, cc.cy, b.x, b.y, Math.min(e, i / N)); ctx.lineTo(x, y); }
        ctx.stroke();
        if (p < 1) {
          const [x, y] = qPoint(a.x, a.y, cc.cx, cc.cy, b.x, b.y, e), r = 16 / Math.min(1, z);
          const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
          rg.addColorStop(0, 'rgba(255,236,210,0.95)'); rg.addColorStop(0.25, 'rgba(244,162,97,0.55)'); rg.addColorStop(1, 'rgba(244,162,97,0)');
          ctx.globalAlpha = Math.sin(Math.PI * p) * 0.9 + 0.1; ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
        }
      }
      // Notizen: auftauchen, treiben, auf einem leichten Bogen zur Insel fliegen
      const detail = z >= LOD;
      for (const n of g.notes) {
        const o = I.notes.get(n.id);
        if (!o) continue;
        const ap = easeOut(clamp01((sec - o.appear) / 0.45));
        if (ap <= 0) continue;
        const fp = easeInOut(clamp01((sec - o.go) / I_FLY)), still = 1 - fp;
        const sx = o.sx + Math.sin(sec * 0.9 + o.i) * 5 * still, sy = o.sy + Math.cos(sec * 0.7 + o.i * 1.7) * 4 * still - (1 - ap) * 10;
        const dx = n.x - sx, dy = n.y - sy, arc = Math.sin(Math.PI * fp) * 0.18 * (o.i % 2 ? 1 : -1);
        const x = sx + dx * fp - dy * arc, y = sy + dy * fp + dx * arc;
        ctx.globalAlpha = ap;
        if (!detail && fp >= 1) {
          ctx.fillStyle = mix(islandColor(g.byId.get(n.threadIds[0])!), BG, 0.7); ctx.beginPath(); ctx.arc(x, y, Math.max(5, 2.2 / z), 0, 7); ctx.fill();
          continue;
        }
        ctx.save(); ctx.translate(x, y); ctx.rotate(o.r * still); ctx.scale(0.92 + 0.08 * ap, 0.92 + 0.08 * ap);
        pill(ctx, n, 0, 0, false, fp < 1 ? `rgba(232,220,203,${0.22 + 0.2 * fp})` : undefined);
        ctx.restore();
      }
      // Chips erscheinen, sobald ihre Linie steht; ist der Zoom fürs Normalbild zu klein, blenden sie am Ende wieder aus
      for (const s of g.sims) {
        const p = clamp01((sec - I.sims.get(s.id)! - I_SIM * 0.8) / 0.35), out = chipVisible(s) ? 1 : clamp01((I.end - sec) / 0.6);
        if (p > 0 && out > 0) simChip(s, 0.75 * easeOut(p) * out, false);
      }
      ctx.globalAlpha = 1;
      for (const t of g.threads) {
        const p = clamp01((sec - I.isles.get(t.id)! - 0.35) / 0.5);
        if (p > 0) threadLabel(t, easeOut(p), false, false);
      }
      flushLabels();
    }

    // ── Treffer unter dem Zeiger ──
    function hit(sx: number, sy: number): LNode | null {
      const g = G; if (!g) return null;
      const [x, y] = toWorld(sx, sy), z = cam.z, detail = z >= LOD;
      const inBox = (o: Box) => Math.abs(x - o.x) <= o.hw && Math.abs(y - o.y) <= o.hh;
      for (const s of g.sims) if (chipVisible(s) && inBox(s)) return s;
      for (const [id, b] of labelBoxes) if (x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]) return g.byId.get(id) ?? null;
      for (let i = g.notes.length - 1; i >= 0; i--) {
        const n = g.notes[i];
        if (detail ? inBox(n) : Math.hypot(x - n.x, y - n.y) * z < 7) return n;
      }
      // Klick auf die Inselfläche = Thread (nächster Mittelpunkt)
      let best: LThread | null = null, bd = Infinity;
      for (const t of g.threads) { const d = Math.hypot(x - t.x, y - t.y); if (d < t.R + ISLAND_PAD && d < bd) { bd = d; best = t; } }
      return best;
    }
    function tooltipFor(o: LNode | null, sx: number, sy: number) {
      const tip = propsRef.current.onTooltip;
      if (!o) return tip(null, 0, 0);
      let text: string | null = null;
      if (o.kind === 'note') {
        const title = noteTitle(o.data);
        if (cam.z < LOD || textW(title, F.pill()) > o.cw - 34) text = title;
      } else if (o.kind === 'thread') { if (!labelBoxes.has(o.id)) text = o.data.title; }
      else if (!chipVisible(o)) text = '✦ ' + o.data.label;
      tip(text, sx + 14, sy - 10);
    }

    // ── Eingaben ──
    function onPointerDown(e: PointerEvent) {
      endIntro('interrupted'); camK = CAM_K;
      canvas!.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      lastInput = performance.now();
      if (pointers.size === 2) { // Pinch-Zoom (Touch)
        const [a, b] = [...pointers.values()], [wx, wy] = toWorld((a.x + b.x) / 2, (a.y + b.y) / 2);
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: cam.z, wx, wy }; drag = null;
        return;
      }
      const h = hit(e.offsetX, e.offsetY);
      drag = { node: h?.kind === 'thread' ? h : null, sx: e.offsetX, sy: e.offsetY, cx: cam.tx, cy: cam.ty, moved: false, last: toWorld(e.offsetX, e.offsetY), clicked: h };
    }
    function onPointerMove(e: PointerEvent) {
      lastInput = performance.now();
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const nz = Math.max(Z_MIN, Math.min(Z_MAX, pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d));
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        cam.z = cam.tz = nz; cam.x = cam.tx = pinch.wx - (mx - W / 2) / nz; cam.y = cam.ty = pinch.wy - (my - H / 2) / nz;
        return;
      }
      if (drag) {
        if (!drag.moved && Math.hypot(e.offsetX - drag.sx, e.offsetY - drag.sy) > 4) { drag.moved = true; propsRef.current.onTooltip(null, 0, 0); }
        if (!drag.moved) return;
        const [wx, wy] = toWorld(e.offsetX, e.offsetY), dx = wx - drag.last[0], dy = wy - drag.last[1];
        if (drag.node) { // Insel verschieben (nur für diese Sitzung)
          const t = drag.node;
          t.x += dx; t.y += dy;
          for (const n of t.own) { n.x += dx; n.y += dy; }
          for (const s of G!.sims) if (s.a === t.id || s.b === t.id) { s.x += dx / 2; s.y += dy / 2; }
          drag.last = [wx, wy]; layoutVer++;
        } else {
          cam.tx = drag.cx - (e.offsetX - drag.sx) / cam.z; cam.ty = drag.cy - (e.offsetY - drag.sy) / cam.z; cam.x = cam.tx; cam.y = cam.ty;
        }
        canvas!.style.cursor = 'grabbing';
        return;
      }
      if (e.pointerType !== 'mouse' || intro) return;
      hover = hit(e.offsetX, e.offsetY);
      canvas!.style.cursor = hover ? 'pointer' : 'default';
      tooltipFor(hover, e.offsetX, e.offsetY);
    }
    function onPointerUp(e: PointerEvent) {
      pointers.delete(e.pointerId);
      if (pinch) { if (pointers.size < 2) pinch = null; drag = null; return; }
      const d = drag; drag = null;
      canvas!.style.cursor = hover ? 'pointer' : 'default';
      if (!d || d.moved || !d.clicked) return;
      const h = d.clicked, p = propsRef.current;
      if (h.kind === 'note') p.onNoteClick(h.data);
      else if (h.kind === 'sim') p.onSimilarityClick(h.data);
      else {
        if (p.activeThreadId === h.id) { cam.tx = fitCam.x; cam.ty = fitCam.y; cam.tz = fitCam.z; }
        else flyToThread(h);
        p.onThreadClick(h.data);
      }
    }
    function onPointerLeave() { if (!drag) { hover = null; propsRef.current.onTooltip(null, 0, 0); } }
    function onDblClick() { fit(); }
    function onWheel(e: WheelEvent) {
      e.preventDefault(); lastInput = performance.now();
      endIntro('interrupted'); camK = CAM_K;
      // Trackpad: zwei Finger schieben, Pinch (ctrlKey) zoomt. Mausrad (große Schritte) zoomt.
      const trackpadPan = !e.ctrlKey && e.deltaMode === 0 && (Math.abs(e.deltaX) > 0.5 || Math.abs(e.deltaY) < 40);
      if (trackpadPan) { cam.tx += e.deltaX / cam.z; cam.ty += e.deltaY / cam.z; cam.x = cam.tx; cam.y = cam.ty; return; }
      const dy = e.deltaY * (e.deltaMode === 1 ? 33 : 1);
      zoomAround(e.offsetX, e.offsetY, cam.tz * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)));
    }

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('dblclick', onDblClick);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', resize);
    resize();

    // Erst mit den echten Schriften messen, sonst stimmen Pillen- und Titelbreiten nicht.
    let alive = true;
    document.fonts.ready.then(() => {
      if (!alive) return;
      fonts = fontFamilies(); widths.clear(); layoutData = null; threadKey = ''; fontsOk = true;
    });

    const handle = propsRef.current.handleRef;
    if (handle) handle.current = {
      zoomBy: delta => { zoomAround(W / 2, H / 2, cam.tz * (1 + delta)); },
      zoomReset: () => { cam.tx = fitCam.x; cam.ty = fitCam.y; cam.tz = fitCam.z; camK = CAM_K; },
      flyToMatch: query => {
        const g = G, q = query.trim().toLowerCase();
        if (!g || !q) return null;
        const t = g.threads.find(x => x.data.title.toLowerCase().includes(q));
        if (t) { flyToThread(t); return { type: 'thread', thread: t.data }; }
        const n = g.notes.find(x => noteTitle(x.data).toLowerCase().includes(q));
        if (n) { flyTo(n.x, n.y, Math.max(cam.tz, LOD + 0.35)); return { type: 'note', note: n.data }; }
        return null;
      },
      skipIntro: () => endIntro('done'),
    };

    // ── Schleife: 60 Bilder/s bei Bewegung, sonst 30 (nur die laufenden Striche bewegen sich) ──
    function frame() {
      raf = requestAnimationFrame(frame);
      const now = performance.now();
      const g = ensureLayout();
      // Intro erst mit den echten Schriften starten, sonst springt das Layout mittendrin
      const k = propsRef.current.introKey ?? 0;
      if (!k && intro) endIntro('interrupted');
      if (k !== introSeen) {
        if (!k) introSeen = 0;
        else if (fontsOk) { introSeen = k; startIntro(g); }
        else { backdrop(); return; }
      }
      if (intro) {
        const sec = (now - intro.t0) / 1000;
        const step: IntroEvent = sec < I_GATHER ? 'scatter' : sec < intro.connect ? 'gather' : 'connect';
        if (step !== intro.step) { intro.step = step; propsRef.current.onIntro?.(step); }
        if (sec >= intro.end) endIntro('done');
        else { T = now / 1000; lastDraw = now; drawIntro(g, sec); return; }
      }
      const sp = propsRef.current.spotlight?.similarityId ?? null;
      if (sp !== spotSeen) { spotSeen = sp; if (sp) flyToSpotlight(g); }
      const moving = Math.abs(cam.tx - cam.x) + Math.abs(cam.ty - cam.y) > 0.05 / cam.z || Math.abs(cam.tz - cam.z) > cam.tz * 1e-4;
      cam.x += (cam.tx - cam.x) * camK; cam.y += (cam.ty - cam.y) * camK; cam.z += (cam.tz - cam.z) * camK;
      if (!moving) { cam.x = cam.tx; cam.y = cam.ty; cam.z = cam.tz; }
      const [x0, y0] = toWorld(0, 0), [x1, y1] = toWorld(W, H);
      VIEW = { x0, y0, x1, y1 };
      const fading = updateFade(g);
      const busy = moving || fading || !!drag || !!pinch || now - lastInput < 300;
      if (!busy && now - lastDraw < 33) return;
      lastDraw = now; T = now / 1000;
      draw(g);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      if (handle) handle.current = null;
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('dblclick', onDblClick);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none' }} />;
}
