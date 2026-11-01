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

const BG = '#0E0C09';
const LOD = 0.55;        // ab diesem Zoom: Pillen mit Titel statt Punkte
const CHIP_ZOOM = 0.9;   // ab diesem Zoom: KI-Verbindungen auch ohne Fokus beschriftet
const DIM = 0.18;        // Deckkraft von allem außerhalb des Fokus
const ISLAND_PAD = 26;   // Rand der Insel um ihre Notizen
const MAX_DPR = 2;
const Z_MIN = 0.08, Z_MAX = 3;
const DEFAULT_INSETS: GraphInsets = { top: 70, right: 24, bottom: 90, left: 24 };

export interface GraphInsets { top: number; right: number; bottom: number; left: number }

export type GraphMatch = { type: 'note'; note: Note } | { type: 'thread'; thread: Thread };

export interface GraphHandle {
  zoomBy: (delta: number) => void;
  zoomReset: () => void;
  /** Springt zum ersten Treffer (Thread-Titel vor Notiz-Titel) und gibt ihn zurück. */
  flyToMatch: (query: string) => GraphMatch | null;
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

    function fit(instant = false) {
      if (!G || !G.all.length) { Object.assign(fitCam, { x: 0, y: 0, z: 1 }); }
      else {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const p of G.all) { x0 = Math.min(x0, p.x - p.hw); x1 = Math.max(x1, p.x + p.hw); y0 = Math.min(y0, p.y - p.hh); y1 = Math.max(y1, p.y + p.hh); }
        const ins = propsRef.current.insets ?? DEFAULT_INSETS;
        const left = W > 900 ? ins.left : DEFAULT_INSETS.left; // schmale Bildschirme: Hinweiskarte darf überlappen
        const aw = Math.max(100, W - left - ins.right), ah = Math.max(100, H - ins.top - ins.bottom), m = ISLAND_PAD + 10;
        const z = Math.max(Z_MIN, Math.min(1.2, Math.min(aw / (x1 - x0 + m * 2), ah / (y1 - y0 + m * 2))));
        Object.assign(fitCam, { x: (x0 + x1) / 2 - (left + aw / 2 - W / 2) / z, y: (y0 + y1) / 2 - (ins.top + ah / 2 - H / 2) / z, z });
      }
      cam.tx = fitCam.x; cam.ty = fitCam.y; cam.tz = fitCam.z;
      if (instant) { cam.x = cam.tx; cam.y = cam.ty; cam.z = cam.tz; }
    }
    function flyTo(x: number, y: number, z: number) {
      cam.tz = Math.max(Z_MIN, Math.min(Z_MAX, z)); cam.tx = x; cam.ty = y;
    }
    function flyToThread(t: LThread) {
      flyTo(t.x, t.y, Math.min(1.1, Math.min(W - 120, H - 160) / (2 * t.R + 2 * ISLAND_PAD + 80)));
    }
    function zoomAround(sx: number, sy: number, nz: number) {
      const [wx, wy] = toWorld(sx, sy);
      nz = Math.max(Z_MIN, Math.min(Z_MAX, nz));
      cam.tx = wx - (sx - W / 2) / nz; cam.ty = wy - (sy - H / 2) / nz; cam.tz = nz;
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
      return null;
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
      else { s.add(f.a); s.add(f.b); }
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
    function draw(g: GraphLayout) {
      screenT(ctx);
      ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
      const glow = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.7);
      glow.addColorStop(0, 'rgba(60,46,30,0.35)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

      const z = cam.z, detail = z >= LOD;
      const sel = selectedNode(g);
      const key = `${detail}|${hover?.id ?? ''}|${sel?.id ?? ''}|${search.q}`;

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
          const h = hover?.id === n.id, cols = n.threadIds.map(id => islandColor(g.byId.get(id)!));
          c.globalAlpha = al(n.id);
          if (!detail && !h) { c.fillStyle = mix(cols[0], BG, 0.7); c.beginPath(); c.arc(n.x, n.y, Math.max(5, 2.2 / z), 0, 7); c.fill(); continue; }
          rr(c, n.x - n.cw / 2, n.y - 14, n.cw, 28, 14);
          c.fillStyle = h ? '#2E261E' : '#1E1913'; c.fill();
          if (cols.length > 1) {
            const lg = c.createLinearGradient(n.x - n.cw / 2, 0, n.x + n.cw / 2, 0);
            cols.forEach((col, i) => lg.addColorStop(i / (cols.length - 1), col)); c.strokeStyle = lg; c.lineWidth = 1.6;
          } else { c.strokeStyle = rgba(cols[0], h ? 0.9 : 0.4); c.lineWidth = 1; }
          c.stroke();
          c.fillStyle = categoryAccent(n.data.category); c.beginPath(); c.arc(n.x - n.cw / 2 + 14, n.y, 3.2, 0, 7); c.fill();
          c.font = F.pill(); c.fillStyle = h ? '#FFFFFF' : '#E8DCCB'; c.textAlign = 'left'; c.textBaseline = 'middle';
          c.fillText(trunc(noteTitle(n.data), F.pill(), n.cw - 34), n.x - n.cw / 2 + 24, n.y + 0.5);
        }
        c.globalAlpha = 1;
      });

      // Live-Ebene: Fokus-Brücken (laufende Striche) + Beschriftungen
      for (const s of g.sims) {
        const a = g.byId.get(s.a)!, b = g.byId.get(s.b)!, hot = inFocus(s), aa = al(s.id);
        if (hot) {
          const cc = simCurve(s, a, b);
          ctx.strokeStyle = gradientFor(s, a, b, ctx); ctx.lineCap = 'round';
          ctx.globalAlpha = aa * 0.9; ctx.lineWidth = 1.3 / z; ctx.setLineDash([6 / z, 5 / z]); ctx.lineDashOffset = -T * 10 / z;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(cc.cx, cc.cy, b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
        }
        if (!chipVisible(s) || !vis(s)) continue;
        const sh = isHot(s) || hot, w = s.hw * 2;
        ctx.globalAlpha = aa * (hot ? 1 : 0.75);
        rr(ctx, s.x - w / 2, s.y - 13, w, 26, 13); ctx.fillStyle = sh ? '#F2EDE6' : '#221C16'; ctx.fill();
        ctx.strokeStyle = 'rgba(242,237,230,0.25)'; ctx.lineWidth = 1 / z; ctx.stroke();
        ctx.font = F.chip(); ctx.fillStyle = sh ? '#15110D' : '#E8DCCB'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('✦ ' + s.data.label, s.x, s.y + 0.5);
      }
      ctx.globalAlpha = 1;
      // Insel-Namen: konstante Bildschirmgröße, große/fokussierte Threads gewinnen bei Platzmangel
      for (const t of g.threads) {
        if (!vis(t, 80)) continue;
        const a = al(t.id), h = isHot(t), col = islandColor(t), px = Math.max(24, sf(17)), font = F.title(px);
        labels.push({
          text: t.data.title, x: t.x, y: t.y - px * 0.55, font, h: px, w: textW(t.data.title, font), color: h ? '#15110D' : col, a,
          pri: h ? 2000 : inFocus(t) ? 1000 : 100 + t.count, padX: px * 0.7, padY: px * 0.25, id: t.id,
          bg: box => {
            rr(ctx, box[0], box[1], box[2] - box[0], box[3] - box[1], (box[3] - box[1]) / 2);
            ctx.fillStyle = h ? col : mix(col, BG, 0.22); ctx.fill();
            ctx.strokeStyle = rgba(col, 0.7); ctx.lineWidth = 1.2 / z; ctx.stroke();
          },
        });
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
      if (e.pointerType !== 'mouse') return;
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
      fonts = fontFamilies(); widths.clear(); layoutData = null; threadKey = '';
    });

    const handle = propsRef.current.handleRef;
    if (handle) handle.current = {
      zoomBy: delta => { zoomAround(W / 2, H / 2, cam.tz * (1 + delta)); },
      zoomReset: () => { cam.tx = fitCam.x; cam.ty = fitCam.y; cam.tz = fitCam.z; },
      flyToMatch: query => {
        const g = G, q = query.trim().toLowerCase();
        if (!g || !q) return null;
        const t = g.threads.find(x => x.data.title.toLowerCase().includes(q));
        if (t) { flyToThread(t); return { type: 'thread', thread: t.data }; }
        const n = g.notes.find(x => noteTitle(x.data).toLowerCase().includes(q));
        if (n) { flyTo(n.x, n.y, Math.max(cam.tz, LOD + 0.35)); return { type: 'note', note: n.data }; }
        return null;
      },
    };

    // ── Schleife: 60 Bilder/s bei Bewegung, sonst 30 (nur die laufenden Striche bewegen sich) ──
    function frame() {
      raf = requestAnimationFrame(frame);
      const now = performance.now();
      const g = ensureLayout();
      const moving = Math.abs(cam.tx - cam.x) + Math.abs(cam.ty - cam.y) > 0.05 / cam.z || Math.abs(cam.tz - cam.z) > cam.tz * 1e-4;
      cam.x += (cam.tx - cam.x) * 0.12; cam.y += (cam.ty - cam.y) * 0.12; cam.z += (cam.tz - cam.z) * 0.12;
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
