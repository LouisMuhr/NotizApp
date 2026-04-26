'use client';

import { useEffect, useRef, useCallback } from 'react';
import { GraphData, Thread, Note, Similarity } from '@/types';

// ── colours ────────────────────────────────────────────
const C = {
  bg:       '#0E0C09',
  amber:    '#F4A261',
  amberDim: '#B06030',
  amberBright: '#FBCB96',
  green:    '#A8D8A8',
  greenDim: '#3A6A3A',
  white:    '#FFFFFF',
} as const;

// ── layout constants ───────────────────────────────────
const TOPBAR_H = 54;
const THREAD_R  = 15;
const NOTE_R    = 5;
const SIM_R     = 10;
const NOTE_ORBIT_SCALE = 0.11; // fractional distance from thread centre

type HitType = 'thread' | 'note' | 'similarity';
interface HitResult { type: HitType; id: string }

// ── per-note static offsets (cycling pattern) ──────────
function noteOffset(idx: number): [number, number] {
  const offsets: [number, number][] = [
    [-0.09, -0.09], [0.10, -0.07], [0.12,  0.06],
    [ 0.05,  0.13], [-0.07, 0.14], [-0.08, -0.08],
    [ 0.10, -0.11], [ 0.12,  0.03], [-0.09,  0.09],
    [ 0.03,  0.13],
  ];
  return offsets[idx % offsets.length];
}

// ── assign fractional positions to all nodes ───────────
function layoutNodes(data: GraphData): GraphData {
  // threads: spread in a circle if no xf stored
  const n = data.threads.length;
  const threads = data.threads.map((th, i) => {
    if (th.xf !== undefined && th.yf !== undefined) return th;
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = 0.27;
    return { ...th, xf: 0.5 + r * Math.cos(angle), yf: 0.5 + r * Math.sin(angle) };
  });

  // notes: radial orbit around their thread
  const threadMap = new Map(threads.map(t => [t.id, t]));
  const noteCountPerThread = new Map<string, number>();
  const notes = data.notes.map((note) => {
    if (note.xf !== undefined && note.yf !== undefined) return note;
    const th = threadMap.get(note.threadId);
    if (!th || th.xf === undefined || th.yf === undefined) return note;
    const idx = noteCountPerThread.get(note.threadId) ?? 0;
    noteCountPerThread.set(note.threadId, idx + 1);
    const [ox, oy] = noteOffset(idx);
    return { ...note, xf: th.xf + ox * NOTE_ORBIT_SCALE / 0.11, yf: th.yf + oy * NOTE_ORBIT_SCALE / 0.11 };
  });

  // similarities: midpoint + small perpendicular offset
  const similarities = data.similarities.map((s, i) => {
    if (s.xf !== undefined && s.yf !== undefined) return s;
    const a = threadMap.get(s.threadId1);
    const b = threadMap.get(s.threadId2);
    if (!a || !b || a.xf === undefined || b.xf === undefined) return s;
    const mx = (a.xf + b.xf) / 2;
    const my = (a.yf! + b.yf!) / 2;
    const dx = b.xf - a.xf, dy = b.yf! - a.yf!;
    const len = Math.hypot(dx, dy) || 1;
    const sign = i % 2 === 0 ? 1 : -1;
    return {
      ...s,
      xf: mx + sign * (-dy / len) * 0.06,
      yf: my + sign * ( dx / len) * 0.06,
    };
  });

  return { threads, notes, similarities };
}

// ── bezier helpers ─────────────────────────────────────
function hexRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

function bezierPt(t: number, x1: number, y1: number, cpx: number, cpy: number, x2: number, y2: number) {
  const mt = 1 - t;
  return { x: mt * mt * x1 + 2 * mt * t * cpx + t * t * x2, y: mt * mt * y1 + 2 * mt * t * cpy + t * t * y2 };
}

// ── draw wobbling organic blob ─────────────────────────
function drawOrb(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number,
  hex: string, wobble: number, animT: number,
  active: boolean, hovered: boolean,
) {
  const rp = r * (active ? 1 + 0.05 * Math.sin(animT * 1.3) : 1) * (hovered ? 1.18 : 1);

  // glow
  const gr = ctx.createRadialGradient(x, y, 0, x, y, rp * (active ? 5.5 : hovered ? 4.5 : 3.5));
  gr.addColorStop(0, `rgba(${hexRgb(hex)},${active ? 0.28 : hovered ? 0.22 : 0.1})`);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.arc(x, y, rp * 5.5, 0, Math.PI * 2); ctx.fill();

  // blob
  ctx.save(); ctx.translate(x, y);
  const w2 = wobble * (hovered ? 1.5 : 1);
  ctx.beginPath();
  const steps = 28;
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const wr = rp * (1 + w2 * Math.sin(angle * 3 + animT * 0.9 + r));
    if (i === 0) ctx.moveTo(Math.cos(angle) * wr, Math.sin(angle) * wr);
    else ctx.lineTo(Math.cos(angle) * wr, Math.sin(angle) * wr);
  }
  ctx.closePath();
  ctx.fillStyle = hovered ? C.white : hex;
  ctx.globalAlpha = active ? 0.95 : hovered ? 0.9 : 0.7;
  ctx.fill();

  // inner highlight
  const hl = ctx.createRadialGradient(-rp * 0.25, -rp * 0.25, 0, 0, 0, rp);
  hl.addColorStop(0, 'rgba(255,255,255,0.38)');
  hl.addColorStop(0.5, 'rgba(255,255,255,0.06)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl; ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.arc(0, 0, rp, 0, Math.PI * 2); ctx.fill();
  ctx.restore(); ctx.globalAlpha = 1;
}

function drawCurve(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  cpx: number, cpy: number,
  col: string, alpha: number, width: number,
) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = col;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(cpx, cpy, x2, y2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ── noise texture (created once) ──────────────────────
function buildNoiseTexture(): HTMLCanvasElement {
  const nc = document.createElement('canvas');
  nc.width = 256; nc.height = 256;
  const nctx = nc.getContext('2d')!;
  for (let i = 0; i < 256 * 256; i++) {
    const x = i % 256, y = Math.floor(i / 256);
    nctx.fillStyle = `rgba(255,200,140,${Math.random() * 0.018})`;
    nctx.fillRect(x, y, 1, 1);
  }
  return nc;
}

// ── component props ────────────────────────────────────
interface Particle { threadId1: string; threadId2: string; simId: string; cx: number; cy: number; p: number; s: number }

interface Props {
  data: GraphData;
  activeFilter: string;
  zoom: number;
  onThreadClick: (thread: Thread) => void;
  onNoteClick: (note: Note) => void;
  onSimilarityClick: (sim: Similarity) => void;
  activeThreadId: string | null;
  activeSimilarityId: string | null;
  panelOpen: boolean;
  onTooltip: (label: string | null, x: number, y: number) => void;
}

export default function Graph({
  data,
  activeFilter,
  zoom,
  onThreadClick,
  onNoteClick,
  onSimilarityClick,
  activeThreadId,
  activeSimilarityId,
  panelOpen,
  onTooltip,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    animT: 0,
    hoveredNode: null as HitResult | null,
    noiseTexture: null as HTMLCanvasElement | null,
    particles: [] as Particle[],
    layout: null as GraphData | null,
  });

  // re-compute layout when data changes
  const getLayout = useCallback((): GraphData => {
    const s = stateRef.current;
    if (!s.layout || s.layout.threads !== data.threads) {
      s.layout = layoutNodes(data);
      // init particles
      s.particles = s.layout.similarities.map((sim) => {
        const a = s.layout!.threads.find(t => t.id === sim.threadId1);
        const b = s.layout!.threads.find(t => t.id === sim.threadId2);
        if (!a || !b || a.xf === undefined || b.xf === undefined) return null;
        const mx = ((a.xf + b.xf) / 2 + (sim.xf ?? 0.5)) / 2;
        const my = ((a.yf! + b.yf!) / 2 + (sim.yf ?? 0.5)) / 2;
        return { threadId1: sim.threadId1, threadId2: sim.threadId2, simId: sim.id, cx: mx, cy: my, p: Math.random(), s: 0.001 + Math.random() * 0.0015 };
      }).filter(Boolean) as Particle[];
    }
    return s.layout;
  }, [data]);

  // hit testing
  const getNodeAt = useCallback((mx: number, my: number, canvas: HTMLCanvasElement): HitResult | null => {
    const layout = getLayout();
    const gw = canvas.width - (panelOpen ? 360 : 0);
    const gh = canvas.height;
    const GX = (f: number) => f * gw;
    const GY = (f: number) => TOPBAR_H + f * (gh - TOPBAR_H);

    // similarity nodes first
    for (const s of layout.similarities) {
      if (s.xf === undefined) continue;
      const d = Math.hypot(mx - GX(s.xf), my - GY(s.yf!));
      if (d <= 14 * zoom) return { type: 'similarity', id: s.id };
    }
    // threads
    for (const th of layout.threads) {
      if (th.xf === undefined) continue;
      const d = Math.hypot(mx - GX(th.xf), my - GY(th.yf!));
      if (d <= THREAD_R * zoom + 4) return { type: 'thread', id: th.id };
    }
    // notes
    for (const n of layout.notes) {
      if (n.xf === undefined) continue;
      if (activeFilter !== 'all' && n.category !== activeFilter) continue;
      const d = Math.hypot(mx - GX(n.xf), my - GY(n.yf!));
      const r = (activeThreadId === n.threadId ? 7 : NOTE_R) * zoom;
      if (d <= r + 6) return { type: 'note', id: n.id };
    }
    return null;
  }, [getLayout, zoom, activeFilter, activeThreadId, panelOpen]);

  // expose hit test for parent pointer events via ref forwarding would add complexity,
  // so we handle mousemove / click inside this component:
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function onMouseMove(e: MouseEvent) {
      const hit = getNodeAt(e.clientX, e.clientY, canvas!);
      stateRef.current.hoveredNode = hit;
      canvas!.style.cursor = hit ? 'pointer' : 'default';
      if (hit) {
        const layout = getLayout();
        const label =
          hit.type === 'thread'     ? (layout.threads.find(t => t.id === hit.id)?.title ?? '') :
          hit.type === 'similarity' ? `✦ ${layout.similarities.find(s => s.id === hit.id)?.label ?? ''}` :
                                      (layout.notes.find(n => n.id === hit.id)?.title ?? '');
        onTooltip(label, e.clientX + 14, e.clientY - 10);
      } else {
        onTooltip(null, 0, 0);
      }
    }

    function onMouseLeave() {
      stateRef.current.hoveredNode = null;
      canvas!.style.cursor = 'default';
      onTooltip(null, 0, 0);
    }

    function onClick(e: MouseEvent) {
      const hit = getNodeAt(e.clientX, e.clientY, canvas!);
      if (!hit) return;
      const layout = getLayout();
      if (hit.type === 'thread') {
        const th = layout.threads.find(t => t.id === hit.id);
        if (th) onThreadClick(th);
      } else if (hit.type === 'note') {
        const n = layout.notes.find(n => n.id === hit.id);
        if (n) onNoteClick(n);
      } else {
        const s = layout.similarities.find(s => s.id === hit.id);
        if (s) onSimilarityClick(s);
      }
    }

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('click', onClick);
    return () => {
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('click', onClick);
    };
  }, [getNodeAt, getLayout, onThreadClick, onNoteClick, onSimilarityClick, onTooltip]);

  // animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    if (!stateRef.current.noiseTexture) {
      stateRef.current.noiseTexture = buildNoiseTexture();
    }

    let raf = 0;

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      const { animT, hoveredNode, noiseTexture, particles } = stateRef.current;
      const layout = getLayout();

      const W = canvas!.width;
      const H = canvas!.height;
      const GW = W - (panelOpen ? 360 : 0);
      const GH = H;
      const GX = (f: number) => f * GW;
      const GY = (f: number) => TOPBAR_H + f * (GH - TOPBAR_H);

      ctx.clearRect(0, 0, W, H);

      // background
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, W, H);
      const bgGrad = ctx.createRadialGradient(GX(0.42), GY(0.48), 0, GX(0.42), GY(0.48), Math.min(GW, GH) * 0.7);
      bgGrad.addColorStop(0, 'rgba(70,40,10,0.22)');
      bgGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);
      if (noiseTexture) {
        const pat = ctx.createPattern(noiseTexture, 'repeat');
        if (pat) { ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H); }
      }

      ctx.save();
      ctx.beginPath(); ctx.rect(0, TOPBAR_H, GW, H - TOPBAR_H); ctx.clip();

      // ── lit helpers ──────────────────────────────────
      function linkIsLit(simId: string, t1id: string, t2id: string) {
        if (activeThreadId && (activeThreadId === t1id || activeThreadId === t2id)) return true;
        if (activeSimilarityId === simId) return true;
        if (!hoveredNode) return false;
        if (hoveredNode.type === 'thread' && (hoveredNode.id === t1id || hoveredNode.id === t2id)) return true;
        if (hoveredNode.type === 'similarity' && hoveredNode.id === simId) return true;
        if (hoveredNode.type === 'note') {
          const n = layout.notes.find(n => n.id === hoveredNode!.id);
          if (n && (n.threadId === t1id || n.threadId === t2id)) return true;
        }
        return false;
      }

      function noteIsLit(note: Note) {
        if (activeThreadId === note.threadId) return true;
        if (!hoveredNode) return false;
        if (hoveredNode.type === 'note' && hoveredNode.id === note.id) return true;
        if (hoveredNode.type === 'thread' && hoveredNode.id === note.threadId) return true;
        if (hoveredNode.type === 'similarity') {
          const s = layout.similarities.find(s => s.id === hoveredNode!.id);
          if (s && (s.threadId1 === note.threadId || s.threadId2 === note.threadId)) return true;
        }
        return false;
      }

      function simIsLit(s: Similarity) {
        if (activeSimilarityId === s.id) return true;
        if (!hoveredNode) return false;
        if (hoveredNode.type === 'similarity' && hoveredNode.id === s.id) return true;
        if (hoveredNode.type === 'thread' && (hoveredNode.id === s.threadId1 || hoveredNode.id === s.threadId2)) return true;
        if (hoveredNode.type === 'note') {
          const n = layout.notes.find(n => n.id === hoveredNode!.id);
          if (n && (n.threadId === s.threadId1 || n.threadId === s.threadId2)) return true;
        }
        return false;
      }

      // ── thread–similarity–thread curves ─────────────
      for (const sim of layout.similarities) {
        if (sim.xf === undefined) continue;
        const a = layout.threads.find(t => t.id === sim.threadId1);
        const b = layout.threads.find(t => t.id === sim.threadId2);
        if (!a || !b || a.xf === undefined || b.xf === undefined) continue;
        const lit = linkIsLit(sim.id, sim.threadId1, sim.threadId2);
        const col   = lit ? C.amber : 'rgba(150,100,50,0.4)';
        const alpha = lit ? 0.38 : 0.07;
        const width = lit ? 1.6 * zoom : 0.55 * zoom;
        const sx = GX(sim.xf), sy = GY(sim.yf!);
        drawCurve(ctx, GX(a.xf), GY(a.yf!), sx, sy, GX((a.xf + sim.xf) / 2), GY((a.yf! + sim.yf!) / 2), col, alpha, width);
        drawCurve(ctx, GX(b.xf), GY(b.yf!), sx, sy, GX((b.xf + sim.xf) / 2), GY((b.yf! + sim.yf!) / 2), col, alpha, width);
      }

      // ── note–thread curves ───────────────────────────
      for (const note of layout.notes) {
        if (note.xf === undefined) continue;
        if (activeFilter !== 'all' && note.category !== activeFilter) continue;
        const th = layout.threads.find(t => t.id === note.threadId);
        if (!th || th.xf === undefined) continue;
        const lit  = noteIsLit(note);
        const isHovN = hoveredNode?.type === 'note' && hoveredNode.id === note.id;
        const cpx = (note.xf + th.xf) / 2 + (Math.random() - 0.5) * 0.0001; // stable enough for display
        const cpy = (note.yf! + th.yf!) / 2 + (Math.random() - 0.5) * 0.0001;
        drawCurve(ctx,
          GX(note.xf), GY(note.yf!), GX(th.xf), GY(th.yf!), GX(cpx), GY(cpy),
          isHovN ? C.white : lit ? C.green : 'rgba(100,140,80,0.3)',
          isHovN ? 0.6 : lit ? 0.3 : 0.07,
          isHovN ? 1.4 * zoom : lit ? 1.0 * zoom : 0.45 * zoom,
        );
      }

      // ── particles ───────────────────────────────────
      for (const p of particles) {
        p.p = (p.p + p.s) % 1;
        if (!linkIsLit(p.simId, p.threadId1, p.threadId2)) continue;
        const sim = layout.similarities.find(s => s.id === p.simId);
        const a = layout.threads.find(t => t.id === p.threadId1);
        const b = layout.threads.find(t => t.id === p.threadId2);
        if (!sim || !a || !b || sim.xf === undefined || a.xf === undefined || b.xf === undefined) continue;
        const sx = GX(sim.xf), sy = GY(sim.yf!);
        let pt;
        if (p.p < 0.5) {
          pt = bezierPt(p.p * 2, GX(a.xf), GY(a.yf!), GX((a.xf + sim.xf) / 2), GY((a.yf! + sim.yf!) / 2), sx, sy);
        } else {
          pt = bezierPt((p.p - 0.5) * 2, sx, sy, GX((sim.xf + b.xf) / 2), GY((sim.yf! + b.yf!) / 2), GX(b.xf), GY(b.yf!));
        }
        ctx.globalAlpha = 0.9 * Math.sin(p.p * Math.PI);
        ctx.fillStyle = C.amberBright;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 2.2 * zoom, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }

      // ── note nodes ───────────────────────────────────
      for (const note of layout.notes) {
        if (note.xf === undefined) continue;
        if (activeFilter !== 'all' && note.category !== activeFilter) continue;
        const lit   = noteIsLit(note);
        const isHov = hoveredNode?.type === 'note' && hoveredNode.id === note.id;
        const col   = isHov ? C.white : lit ? C.green : C.greenDim;
        drawOrb(ctx, GX(note.xf), GY(note.yf!), lit ? 7 : NOTE_R, col, 0.08, animT, lit, isHov);
      }

      // ── similarity nodes ─────────────────────────────
      for (const sim of layout.similarities) {
        if (sim.xf === undefined) continue;
        const x = GX(sim.xf), y = GY(sim.yf!);
        const lit   = simIsLit(sim);
        const isHov = hoveredNode?.type === 'similarity' && hoveredNode.id === sim.id;
        const r     = (lit ? 12 : SIM_R) * zoom;

        // dashed ring
        ctx.globalAlpha = lit ? 0.35 : 0.12;
        ctx.strokeStyle = C.amber;
        ctx.lineWidth = lit ? 1.4 : 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.arc(x, y, r * 2.5, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;

        // glow
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
        g.addColorStop(0, `rgba(244,162,97,${lit ? 0.45 : 0.12})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 5, 0, Math.PI * 2); ctx.fill();

        // rotating diamond
        ctx.save(); ctx.translate(x, y);
        ctx.rotate(Math.PI / 4 + animT * (lit ? 0.55 : 0.22));
        const d = r * 0.92;
        ctx.fillStyle = lit ? C.amberBright : C.amberDim;
        ctx.globalAlpha = lit ? 1 : 0.6;
        ctx.beginPath();
        ctx.moveTo(0, -d); ctx.lineTo(d, 0); ctx.lineTo(0, d); ctx.lineTo(-d, 0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.beginPath(); ctx.moveTo(0, -d * 0.5); ctx.lineTo(d * 0.45, 0); ctx.lineTo(0, -d * 0.08); ctx.closePath(); ctx.fill();
        ctx.restore(); ctx.globalAlpha = 1;

        // label
        const labelY = y + r * 2.8 + 8;
        ctx.font = `${lit ? '700' : '600'} ${(lit ? 15 : 13) * zoom}px Inter, sans-serif`;
        ctx.fillStyle = lit ? C.amberBright : `rgba(244,162,97,${isHov ? 0.85 : 0.5})`;
        ctx.textAlign = 'center';
        ctx.fillText(sim.label, x, labelY);
        ctx.font = `500 ${(lit ? 11 : 9.5) * zoom}px Inter, sans-serif`;
        ctx.fillStyle = `rgba(244,162,97,${lit ? 0.55 : 0.22})`;
        ctx.fillText('✦ KI-Verbindung', x, labelY + (lit ? 17 : 14) * zoom);
      }

      // ── thread nodes ─────────────────────────────────
      for (const th of layout.threads) {
        if (th.xf === undefined) continue;
        const isClicked = activeThreadId === th.id;
        const isHov     = hoveredNode?.type === 'thread' && hoveredNode.id === th.id;
        const simHov    = hoveredNode?.type === 'similarity' && (() => {
          const s = layout.similarities.find(s => s.id === hoveredNode!.id);
          return s && (s.threadId1 === th.id || s.threadId2 === th.id);
        })();
        const lit = isClicked || isHov || !!simHov;
        drawOrb(ctx, GX(th.xf), GY(th.yf!), THREAD_R, C.amber, 0.1, animT, lit, isHov || !!simHov);
        const rLabel = THREAD_R * zoom * (lit ? 1.08 : 1);
        ctx.font = `${lit ? '600' : '500'} ${(lit ? 13 : 11) * zoom}px Inter, sans-serif`;
        ctx.fillStyle = lit ? C.amber : `rgba(${hexRgb(C.amber)},0.5)`;
        ctx.textAlign = 'center';
        ctx.fillText(th.title, GX(th.xf), GY(th.yf!) + rLabel + 16 * zoom);
      }

      ctx.restore();
      stateRef.current.animT += 0.016;
      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [data, getLayout, activeFilter, zoom, activeThreadId, activeSimilarityId, panelOpen]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0 }}
    />
  );
}
