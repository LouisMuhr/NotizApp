import { GraphData, Note, Similarity, Thread } from '@/types';

// Layout für den Insel-Graphen, in echten Pixel-Koordinaten (kein Verzerren auf Breitbild).
//   1) Pro Thread: eigene Notizen als Scheibe (Sonnenblumen-Spirale + kurze Entzerrung) um den Titel.
//   2) Global: jeder Thread ist ein Kreis mit Radius R, per Kräften verteilt
//      (Federn = KI-Verbindungen, Abstoßung, leichte Schwerkraft, Kreis-Kollision).
//   3) Verbindungs-Labels (und Alt-Notizen in mehreren Threads) sitzen in der Lücke zwischen den Inseln.
// Kosten wachsen ~linear mit der Notizzahl; 40 Threads / 500 Notizen ≈ 0,3 s.

export interface Box { x: number; y: number; hw: number; hh: number }

export interface LThread extends Box {
  kind: 'thread'; id: string; data: Thread; idx: number;
  /** Breite des Titel-Chips (Weltpixel) */ cw: number;
  members: LNote[]; own: LNote[]; count: number;
  /** Radius der Insel inkl. eigener Notizen */ R: number;
  /** Index in ISLAND_COLORS — Nachbarn bekommen verschiedene Farben */ color: number;
  vx: number; vy: number;
}
export interface LNote extends Box {
  kind: 'note'; id: string; data: Note; threadIds: string[];
  /** Breite der Pille */ cw: number; lx: number; ly: number;
}
export interface LSim extends Box { kind: 'sim'; id: string; data: Similarity; a: string; b: string }
export type LNode = LThread | LNote | LSim;

export interface GraphLayout {
  threads: LThread[]; notes: LNote[]; sims: LSim[];
  byId: Map<string, LThread>; all: LNode[];
}

export interface Measure {
  thread: (t: Thread) => { cw: number; hw: number; hh: number };
  note: (n: Note) => { cw: number; hw: number; hh: number };
  sim: (s: Similarity) => { hw: number; hh: number };
}

const GAP = 120;   // Luft zwischen Inseln
const PAD = 8;     // Mindestabstand zwischen Elementen
const GA = Math.PI * (3 - Math.sqrt(5)); // goldener Winkel

function overlap(a: Box, b: Box, pad: number): [number, number] {
  return [a.hw + b.hw + pad - Math.abs(b.x - a.x), a.hh + b.hh + pad - Math.abs(b.y - a.y)];
}

export function computeLayout(data: GraphData, m: Measure): GraphLayout {
  const threadIds = new Set(data.threads.map(t => t.id));
  const notes: LNote[] = [];
  for (const n of data.notes) {
    const ids = (n.threadIds?.length ? n.threadIds : [n.threadId]).filter(id => threadIds.has(id));
    if (!ids.length) continue;
    notes.push({ kind: 'note', id: n.id, data: n, threadIds: ids, x: 0, y: 0, lx: 0, ly: 0, ...m.note(n) });
  }
  const threads: LThread[] = data.threads.map((t, idx) => ({
    kind: 'thread', id: t.id, data: t, idx, x: 0, y: 0, vx: 0, vy: 0,
    members: [], own: [], count: 0, R: 0, color: 0, ...m.thread(t),
  }));
  const byId = new Map(threads.map(t => [t.id, t]));
  for (const n of notes) for (const id of n.threadIds) byId.get(id)!.members.push(n);

  // 1) Inseln: eigene Notizen um den Titel packen
  for (const t of threads) {
    t.count = t.members.length;
    const own = t.members.filter(n => n.threadIds.length === 1);
    const area = own.length ? own.reduce((s, n) => s + (2 * n.hw + PAD) * (2 * n.hh + PAD), 0) / own.length : 1;
    const r0 = Math.max(t.hw, t.hh) + PAD + 14;
    own.forEach((n, i) => {
      const r = Math.sqrt(r0 * r0 + (i + 0.5) * area / Math.PI * 1.15), a = i * GA;
      n.lx = Math.cos(a) * r; n.ly = Math.sin(a) * r;
    });
    const center: Box = { x: 0, y: 0, hw: t.hw, hh: t.hh };
    for (let it = 0; it < 60; it++) {
      for (const n of own) { n.lx *= 0.985; n.ly *= 0.985; }
      for (let i = 0; i < own.length; i++) {
        const a = own[i];
        const [cx, cy] = overlap(center, { x: a.lx, y: a.ly, hw: a.hw, hh: a.hh }, PAD);
        if (cx > 0 && cy > 0) { if (cx < cy) a.lx += Math.sign(a.lx || 1) * cx; else a.ly += Math.sign(a.ly || 1) * cy; }
        for (let j = i + 1; j < own.length; j++) {
          const b = own[j];
          const [ox, oy] = overlap({ x: a.lx, y: a.ly, hw: a.hw, hh: a.hh }, { x: b.lx, y: b.ly, hw: b.hw, hh: b.hh }, PAD);
          if (ox > 0 && oy > 0) {
            if (ox < oy) { const s = (b.lx >= a.lx ? 1 : -1) * ox / 2; a.lx -= s; b.lx += s; }
            else { const s = (b.ly >= a.ly ? 1 : -1) * oy / 2; a.ly -= s; b.ly += s; }
          }
        }
      }
    }
    t.own = own;
    t.R = Math.max(r0, ...own.map(n => Math.hypot(n.lx, n.ly) + Math.max(n.hw, n.hh)));
  }

  // 2) Inseln verteilen
  const sims0 = data.similarities.filter(s => byId.has(s.threadId1) && byId.has(s.threadId2) && s.threadId1 !== s.threadId2);
  if (threads.length) {
    const avgR = threads.reduce((s, t) => s + t.R, 0) / threads.length;
    threads.forEach((t, i) => { const r = avgR * 2.2 * Math.sqrt(i + 0.5), a = i * GA; t.x = Math.cos(a) * r; t.y = Math.sin(a) * r * 0.8; });
  }
  const springs: Array<[LThread, LThread, number]> = sims0.map(s => [byId.get(s.threadId1)!, byId.get(s.threadId2)!, 0.04]);
  for (const n of notes) if (n.threadIds.length > 1) springs.push([byId.get(n.threadIds[0])!, byId.get(n.threadIds[1])!, 0.02]);
  const ITER = 450;
  for (let it = 0; it < ITER; it++) {
    const al = 1 - it / ITER;
    for (const [a, b, k] of springs) {
      const dx = b.x - a.x, dy = b.y - a.y, dd = Math.hypot(dx, dy) || 1, f = (dd - (a.R + b.R + GAP)) / dd * k * al;
      a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
    }
    for (let i = 0; i < threads.length; i++) for (let j = i + 1; j < threads.length; j++) {
      const a = threads[i], b = threads[j], dx = b.x - a.x, dy = b.y - a.y, d2 = Math.max(dx * dx + dy * dy, 100);
      const f = 0.01 * (a.R + b.R) * (a.R + b.R) * al / d2;
      a.vx -= dx * f; a.vy -= dy * f; b.vx += dx * f; b.vy += dy * f;
    }
    for (const t of threads) { t.vx -= t.x * 0.03 * al; t.vy -= t.y * 0.042 * al; t.x += t.vx; t.y += t.vy; t.vx *= 0.6; t.vy *= 0.6; }
    for (let k = 0; k < 2; k++) for (let i = 0; i < threads.length; i++) for (let j = i + 1; j < threads.length; j++) {
      const a = threads[i], b = threads[j], dx = b.x - a.x, dy = b.y - a.y, dd = Math.hypot(dx, dy) || 1, min = a.R + b.R + GAP * 0.45;
      if (dd < min) { const s = (min - dd) / dd / 2; a.x -= dx * s; a.y -= dy * s; b.x += dx * s; b.y += dy * s; }
    }
  }
  for (const t of threads) for (const n of t.own) { n.x = t.x + n.lx; n.y = t.y + n.ly; }

  // 3) Labels + Alt-Notizen in mehreren Threads in die Lücke zwischen den Inseln
  const between = (ts: LThread[]): [number, number] => {
    if (ts.length === 2) {
      const [a, b] = ts, dx = b.x - a.x, dy = b.y - a.y, dd = Math.hypot(dx, dy) || 1, u = (a.R + (dd - a.R - b.R) / 2) / dd;
      return [a.x + dx * u, a.y + dy * u];
    }
    return [ts.reduce((s, t) => s + t.x, 0) / ts.length, ts.reduce((s, t) => s + t.y, 0) / ts.length];
  };
  const movable: Box[] = [];
  for (const n of notes) if (n.threadIds.length > 1) { [n.x, n.y] = between(n.threadIds.map(id => byId.get(id)!)); movable.push(n); }
  const sims: LSim[] = sims0.map(s => {
    const o: LSim = { kind: 'sim', id: s.id, data: s, a: s.threadId1, b: s.threadId2, x: 0, y: 0, ...m.sim(s) };
    [o.x, o.y] = between([byId.get(o.a)!, byId.get(o.b)!]);
    movable.push(o);
    return o;
  });
  const fixed: Box[] = [...threads, ...notes.filter(n => n.threadIds.length === 1)];
  for (let pass = 0; pass < 40; pass++) {
    let moved = false;
    for (const mv of movable) for (const o of [...fixed, ...movable]) {
      if (o === mv) continue;
      const [ox, oy] = overlap(mv, o, PAD);
      if (ox > 0 && oy > 0) { moved = true; if (ox < oy) mv.x += (mv.x >= o.x ? 1 : -1) * ox; else mv.y += (mv.y >= o.y ? 1 : -1) * oy; }
    }
    if (!moved) break;
  }

  assignColors(threads, sims);
  return { threads, notes, sims, byId, all: [...threads, ...notes, ...sims] };
}

// ── Farben: Amber-Töne, Nachbarn verschieden ────────────────────────────────
// Amber ist der einzige Akzent der Marke; die Inseln unterscheiden sich daher nur über Helligkeit und
// leichte Farbton-Verschiebung um Amber herum (oklch, Hue 42–85°).
export const ISLAND_COLORS = [
  '#efc189', // oklch(0.84 0.09 72) hell
  '#e99e5e', // oklch(0.76 0.12 60) Amber
  '#cf8358', // oklch(0.68 0.11 50) dunkel
  '#d3bb8a', // oklch(0.80 0.07 85) sandig
  '#d0947d', // oklch(0.72 0.08 42) rötlich
  '#ead4b3', // oklch(0.88 0.05 78) fast Creme
];

function assignColors(threads: LThread[], sims: LSim[]) {
  const nb = new Map<string, Set<string>>(threads.map(t => [t.id, new Set<string>()]));
  const link = (a: string, b: string) => { nb.get(a)!.add(b); nb.get(b)!.add(a); };
  for (const s of sims) link(s.a, s.b);
  for (let i = 0; i < threads.length; i++) for (let j = i + 1; j < threads.length; j++) {
    const a = threads[i], b = threads[j];
    if (Math.hypot(b.x - a.x, b.y - a.y) < a.R + b.R + GAP * 1.6) link(a.id, b.id);
  }
  const used = new Array(ISLAND_COLORS.length).fill(0);
  const byId = new Map(threads.map(t => [t.id, t]));
  const done = new Set<string>();
  // Größte Inseln zuerst: sie bekommen Amber & Co. am ehesten
  for (const t of [...threads].sort((a, b) => b.count - a.count)) {
    const taken = new Set([...nb.get(t.id)!].filter(id => done.has(id)).map(id => byId.get(id)!.color));
    let best = -1;
    for (let c = 0; c < ISLAND_COLORS.length; c++) if (!taken.has(c) && (best < 0 || used[c] < used[best])) best = c;
    t.color = best < 0 ? t.idx % ISLAND_COLORS.length : best;
    used[t.color]++; done.add(t.id);
  }
}

// ── Geometrie-Helfer fürs Zeichnen ──────────────────────────────────────────
export function hull(pts: Array<[number, number]>): Array<[number, number]> {
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Array<[number, number]> = [], up: Array<[number, number]> = [];
  for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of pts.slice().reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

/** Kontrollpunkt, damit die Kurve zwischen zwei Threads genau durch das Label läuft. */
export function simCurve(s: Box, a: Box, b: Box) {
  return { cx: 2 * s.x - (a.x + b.x) / 2, cy: 2 * s.y - (a.y + b.y) / 2 };
}
