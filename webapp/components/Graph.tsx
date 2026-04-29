'use client';

import { useEffect, useRef } from 'react';
import { GraphData, Thread, Note, Similarity } from '@/types';

// ── colours ────────────────────────────────────────────
const C = {
  bg:          '#0E0C09',
  amber:       '#F4A261',
  amberDim:    '#B06030',
  amberBright: '#FBCB96',
  green:       '#A8D8A8',
  greenDim:    '#3A6A3A',
  white:       '#FFFFFF',
} as const;

const TOPBAR_H         = 54;
const THREAD_R         = 15;
const NOTE_R           = 5;
const SIM_R            = 10;
const NOTE_ORBIT_SCALE = 0.11;
const LS_KEY           = 'notiz_thread_positions';

function loadPositions(): Record<string, { xf: number; yf: number }> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}'); } catch { return {}; }
}
function savePositions(pos: Record<string, { xf: number; yf: number }>) {
  localStorage.setItem(LS_KEY, JSON.stringify(pos));
}

type HitType = 'thread' | 'note' | 'similarity';
interface HitResult { type: HitType; id: string }

function noteOffset(idx: number): [number, number] {
  const offsets: [number, number][] = [
    [-0.09,-0.09],[0.10,-0.07],[0.12,0.06],[0.05,0.13],[-0.07,0.14],
    [-0.08,-0.08],[0.10,-0.11],[0.12,0.03],[-0.09,0.09],[0.03,0.13],
  ];
  return offsets[idx % offsets.length];
}

function layoutNodes(data: GraphData): GraphData {
  const saved = loadPositions();
  const n = data.threads.length;
  const threads = data.threads.map((th, i) => {
    if (saved[th.id]) return { ...th, xf: saved[th.id].xf, yf: saved[th.id].yf };
    if (th.xf !== undefined && th.yf !== undefined) return th;
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { ...th, xf: 0.5 + 0.27 * Math.cos(angle), yf: 0.5 + 0.27 * Math.sin(angle) };
  });
  const threadMap = new Map(threads.map(t => [t.id, t]));
  const noteCount = new Map<string, number>();
  const notes = data.notes.map(note => {
    if (note.xf !== undefined && note.yf !== undefined) return note;
    const th = threadMap.get(note.threadId);
    if (!th || th.xf === undefined) return note;
    const idx = noteCount.get(note.threadId) ?? 0;
    noteCount.set(note.threadId, idx + 1);
    const [ox, oy] = noteOffset(idx);
    return { ...note, xf: th.xf + ox * NOTE_ORBIT_SCALE / 0.11, yf: th.yf! + oy * NOTE_ORBIT_SCALE / 0.11 };
  });
  const similarities = data.similarities.map((s, i) => {
    const a = threadMap.get(s.threadId1), b = threadMap.get(s.threadId2);
    if (!a || !b || a.xf === undefined) return s;
    return simPos(s, a.xf, a.yf!, b.xf!, b.yf!, i);
  });
  return { threads, notes, similarities };
}

function simPos(s: Similarity, ax: number, ay: number, bx: number, by: number, i: number): Similarity {
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  const sign = i % 2 === 0 ? 1 : -1;
  return { ...s, xf: mx + sign * (-dy / len) * 0.06, yf: my + sign * (dx / len) * 0.06 };
}

function hexRgb(hex: string) {
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
}

function bezierPt(t: number, x1: number, y1: number, cpx: number, cpy: number, x2: number, y2: number) {
  const m = 1 - t;
  return { x: m*m*x1 + 2*m*t*cpx + t*t*x2, y: m*m*y1 + 2*m*t*cpy + t*t*y2 };
}

function drawOrb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number,
  hex: string, wobble: number, animT: number, active: boolean, hovered: boolean) {
  const rp = r * (active ? 1 + 0.05 * Math.sin(animT * 1.3) : 1) * (hovered ? 1.18 : 1);
  const gr = ctx.createRadialGradient(x, y, 0, x, y, rp * (active ? 5.5 : hovered ? 4.5 : 3.5));
  gr.addColorStop(0, `rgba(${hexRgb(hex)},${active ? 0.28 : hovered ? 0.22 : 0.1})`);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, rp * 5.5, 0, Math.PI*2); ctx.fill();
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const wr = rp * (1 + wobble * (hovered ? 1.5 : 1) * Math.sin(a * 3 + animT * 0.9 + r));
    i === 0 ? ctx.moveTo(Math.cos(a)*wr, Math.sin(a)*wr) : ctx.lineTo(Math.cos(a)*wr, Math.sin(a)*wr);
  }
  ctx.closePath();
  ctx.fillStyle = hovered ? C.white : hex;
  ctx.globalAlpha = active ? 0.95 : hovered ? 0.9 : 0.7; ctx.fill();
  const hl = ctx.createRadialGradient(-rp*.25, -rp*.25, 0, 0, 0, rp);
  hl.addColorStop(0,'rgba(255,255,255,0.38)'); hl.addColorStop(.5,'rgba(255,255,255,0.06)'); hl.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle = hl; ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(0,0,rp,0,Math.PI*2); ctx.fill();
  ctx.restore(); ctx.globalAlpha = 1;
}

function drawCurve(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number,
  cpx: number, cpy: number, col: string, alpha: number, width: number) {
  ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = width;
  ctx.lineCap = 'round'; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cpx, cpy, x2, y2); ctx.stroke();
  ctx.globalAlpha = 1;
}

function buildNoise(): HTMLCanvasElement {
  const nc = document.createElement('canvas'); nc.width = 256; nc.height = 256;
  const nctx = nc.getContext('2d')!;
  for (let i = 0; i < 256*256; i++) {
    nctx.fillStyle = `rgba(255,200,140,${Math.random()*0.018})`;
    nctx.fillRect(i%256, Math.floor(i/256), 1, 1);
  }
  return nc;
}

interface Particle { threadId1: string; threadId2: string; simId: string; p: number; s: number }
interface DragState { threadId: string; startMouseX: number; startMouseY: number; startXf: number; startYf: number; moved: boolean }

interface Props {
  data: GraphData;
  activeFilter: string;
  zoom: number;
  onThreadClick: (t: Thread) => void;
  onNoteClick: (n: Note) => void;
  onSimilarityClick: (s: Similarity) => void;
  activeThreadId: string | null;
  activeSimilarityId: string | null;
  panelOpen: boolean;
  onTooltip: (label: string | null, x: number, y: number) => void;
  onZoomChange?: (z: number) => void;
}

export default function Graph(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // All mutable runtime state lives here — never triggers re-renders
  const rt = useRef({
    animT: 0,
    hovered: null as HitResult | null,
    drag: null as DragState | null,
    noise: null as HTMLCanvasElement | null,
    particles: [] as Particle[],
    layout: null as GraphData | null,
    layoutData: null as GraphData | null,
    // camera (fractional offset + zoom, lerped each frame like the mockup)
    camX: 0, camY: 0, camZ: 1,
    camXt: 0, camYt: 0, camZt: 1,
  });

  // Props mirror — always current, no stale closures
  const propsRef = useRef(props);
  propsRef.current = props;

  // One-time setup: animation loop + all event listeners
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas: HTMLCanvasElement = canvasRef.current;

    const ctx = canvas.getContext('2d')!;
    rt.current.noise = buildNoise();

    // ── helpers ─────────────────────────────────────────

    // Camera: same lerp as the mockup (camX/camY are fractional offsets, camZ is scale)
    function lerpCam() {
      const r = rt.current, s = 0.09;
      r.camX += (r.camXt - r.camX) * s;
      r.camY += (r.camYt - r.camY) * s;
      r.camZ += (r.camZt - r.camZ) * s;
    }

    function GW() { return canvas.width; }
    function GH() { return canvas.height - TOPBAR_H; }
    // Map fractional node position → canvas pixel, applying camera transform
    function GX(f: number) { return (f - rt.current.camX) * rt.current.camZ * GW(); }
    function GY(f: number) { return TOPBAR_H + (f - rt.current.camY) * rt.current.camZ * GH(); }

    function getLayout(): GraphData {
      const r = rt.current;
      const p = propsRef.current;
      if (!r.layout || r.layoutData !== p.data) {
        r.layout = layoutNodes(p.data);
        r.layoutData = p.data;
        r.particles = r.layout.similarities.map(s => ({
          threadId1: s.threadId1, threadId2: s.threadId2, simId: s.id,
          p: Math.random(), s: 0.001 + Math.random() * 0.0015,
        }));
      }
      return r.layout;
    }

    function moveThread(threadId: string, xf: number, yf: number) {
      const layout = rt.current.layout;
      if (!layout) return;
      const cxf = Math.max(0.02, Math.min(0.98, xf));
      const cyf = Math.max(0.02, Math.min(0.98, yf));
      const threads = layout.threads.map(t => t.id === threadId ? { ...t, xf: cxf, yf: cyf } : t);
      const tm = new Map(threads.map(t => [t.id, t]));
      const nc = new Map<string, number>();
      const notes = layout.notes.map(note => {
        if (note.threadId !== threadId) return note;
        const th = tm.get(note.threadId)!;
        const idx = nc.get(note.threadId) ?? 0; nc.set(note.threadId, idx + 1);
        const [ox, oy] = noteOffset(idx);
        return { ...note, xf: cxf + ox * NOTE_ORBIT_SCALE / 0.11, yf: cyf + oy * NOTE_ORBIT_SCALE / 0.11 };
      });
      const similarities = layout.similarities.map((s, i) => {
        if (s.threadId1 !== threadId && s.threadId2 !== threadId) return s;
        const a = tm.get(s.threadId1), b = tm.get(s.threadId2);
        if (!a || !b || a.xf === undefined) return s;
        return simPos(s, a.xf, a.yf!, b.xf!, b.yf!, i);
      });
      rt.current.layout = { threads, notes, similarities };
    }

    function getNodeAt(mx: number, my: number): HitResult | null {
      const layout = getLayout();
      const { activeFilter, activeThreadId } = propsRef.current;
      const z = rt.current.camZ;
      for (const s of layout.similarities) {
        if (s.xf === undefined) continue;
        if (Math.hypot(mx - GX(s.xf), my - GY(s.yf!)) <= 14 * z) return { type: 'similarity', id: s.id };
      }
      for (const th of layout.threads) {
        if (th.xf === undefined) continue;
        if (Math.hypot(mx - GX(th.xf), my - GY(th.yf!)) <= THREAD_R * z + 4) return { type: 'thread', id: th.id };
      }
      for (const n of layout.notes) {
        if (n.xf === undefined) continue;
        if (activeFilter !== 'all' && n.category !== activeFilter) continue;
        const r = (activeThreadId === n.threadId ? 7 : NOTE_R) * z;
        if (Math.hypot(mx - GX(n.xf), my - GY(n.yf!)) <= r + 6) return { type: 'note', id: n.id };
      }
      return null;
    }

    // ── events ───────────────────────────────────────────

    function onMouseDown(e: MouseEvent) {
      const hit = getNodeAt(e.clientX, e.clientY);
      if (hit?.type !== 'thread') return;
      const th = getLayout().threads.find(t => t.id === hit.id);
      if (!th || th.xf === undefined) return;
      rt.current.drag = { threadId: th.id, startMouseX: e.clientX, startMouseY: e.clientY, startXf: th.xf, startYf: th.yf!, moved: false };
      canvas.style.cursor = 'grabbing';
      e.preventDefault();
    }

    function onWindowMouseMove(e: MouseEvent) {
      const { drag } = rt.current;
      if (drag) {
        const z = rt.current.camZ;
        const dx = e.clientX - drag.startMouseX, dy = e.clientY - drag.startMouseY;
        if (!drag.moved && Math.hypot(dx, dy) > 4) drag.moved = true;
        if (drag.moved) {
          // convert pixel delta to fractional delta, accounting for camera zoom
          moveThread(drag.threadId, drag.startXf + dx / (GW() * z), drag.startYf + dy / (GH() * z));
          propsRef.current.onTooltip(null, 0, 0);
        }
        return;
      }
      const hit = getNodeAt(e.clientX, e.clientY);
      rt.current.hovered = hit;
      canvas.style.cursor = hit?.type === 'thread' ? 'grab' : hit ? 'pointer' : 'default';
      if (hit) {
        const layout = getLayout();
        const label = hit.type === 'thread' ? layout.threads.find(t => t.id === hit.id)?.title ?? ''
          : hit.type === 'similarity' ? `✦ ${layout.similarities.find(s => s.id === hit.id)?.label ?? ''}`
          : layout.notes.find(n => n.id === hit.id)?.title ?? '';
        propsRef.current.onTooltip(label, e.clientX + 14, e.clientY - 10);
      } else {
        propsRef.current.onTooltip(null, 0, 0);
      }
    }

    function onWindowMouseUp() {
      const { drag } = rt.current;
      if (!drag) return;
      if (drag.moved) {
        const saved = loadPositions();
        for (const th of getLayout().threads) if (th.xf !== undefined) saved[th.id] = { xf: th.xf, yf: th.yf! };
        savePositions(saved);
      } else {
        const th = getLayout().threads.find(t => t.id === drag.threadId);
        if (th && th.xf !== undefined) {
          const { activeThreadId } = propsRef.current;
          if (activeThreadId === th.id) {
            // deselect → zoom back out
            rt.current.camXt = 0;
            rt.current.camYt = 0;
            rt.current.camZt = 1.0;
          } else {
            // zoom toward the clicked thread — same formula as the mockup
            const targetZ = 1.5;
            rt.current.camXt = th.xf - 0.28 / targetZ;
            rt.current.camYt = th.yf! - 0.36 / targetZ;
            rt.current.camZt = targetZ;
          }
          propsRef.current.onThreadClick(th);
        }
      }
      rt.current.drag = null;
      canvas.style.cursor = 'default';
    }

    function onMouseLeave() {
      if (!rt.current.drag) { rt.current.hovered = null; canvas.style.cursor = 'default'; propsRef.current.onTooltip(null, 0, 0); }
    }

    function onClick(e: MouseEvent) {
      if (rt.current.drag) return;
      const hit = getNodeAt(e.clientX, e.clientY);
      if (!hit || hit.type === 'thread') return;
      const layout = getLayout();
      if (hit.type === 'note') { const n = layout.notes.find(n => n.id === hit.id); if (n) propsRef.current.onNoteClick(n); }
      else { const s = layout.similarities.find(s => s.id === hit.id); if (s) propsRef.current.onSimilarityClick(s); }
    }

    canvas.addEventListener('mousedown',  onMouseDown);
    window.addEventListener('mousemove',  onWindowMouseMove);
    window.addEventListener('mouseup',    onWindowMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('click',      onClick);

    // ── resize ───────────────────────────────────────────
    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resize();
    window.addEventListener('resize', resize);

    // ── draw loop ────────────────────────────────────────
    let raf = 0;
    function draw() {
      lerpCam();
      const { animT, hovered, drag, noise, particles } = rt.current;
      const z = rt.current.camZ;
      const layout = getLayout();
      const { activeFilter, activeThreadId, activeSimilarityId } = propsRef.current;
      const W = canvas.width, H = canvas.height;

      ctx.clearRect(0,0,W,H);
      ctx.fillStyle = C.bg; ctx.fillRect(0,0,W,H);
      const bg = ctx.createRadialGradient(GX(0.42),GY(0.48),0,GX(0.42),GY(0.48),Math.min(GW(),H)*0.7);
      bg.addColorStop(0,'rgba(70,40,10,0.22)'); bg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);
      if (noise) { const pat = ctx.createPattern(noise,'repeat'); if (pat) { ctx.fillStyle=pat; ctx.fillRect(0,0,W,H); } }

      ctx.save(); ctx.beginPath(); ctx.rect(0,TOPBAR_H,GW(),H-TOPBAR_H); ctx.clip();

      function linkLit(simId: string, t1: string, t2: string) {
        if (activeThreadId && (activeThreadId===t1||activeThreadId===t2)) return true;
        if (activeSimilarityId===simId) return true;
        if (!hovered) return false;
        if (hovered.type==='thread' && (hovered.id===t1||hovered.id===t2)) return true;
        if (hovered.type==='similarity' && hovered.id===simId) return true;
        if (hovered.type==='note') { const n=layout.notes.find(n=>n.id===hovered!.id); if (n&&(n.threadId===t1||n.threadId===t2)) return true; }
        return false;
      }
      function noteLit(note: Note) {
        if (activeThreadId===note.threadId) return true;
        if (!hovered) return false;
        if (hovered.type==='note'&&hovered.id===note.id) return true;
        if (hovered.type==='thread'&&hovered.id===note.threadId) return true;
        if (hovered.type==='similarity') { const s=layout.similarities.find(s=>s.id===hovered!.id); if (s&&(s.threadId1===note.threadId||s.threadId2===note.threadId)) return true; }
        return false;
      }
      function simLit(s: Similarity) {
        if (activeSimilarityId===s.id) return true;
        if (!hovered) return false;
        if (hovered.type==='similarity'&&hovered.id===s.id) return true;
        if (hovered.type==='thread'&&(hovered.id===s.threadId1||hovered.id===s.threadId2)) return true;
        if (hovered.type==='note') { const n=layout.notes.find(n=>n.id===hovered!.id); if (n&&(n.threadId===s.threadId1||n.threadId===s.threadId2)) return true; }
        return false;
      }

      // curves: thread–sim
      for (const sim of layout.similarities) {
        if (sim.xf===undefined) continue;
        const a=layout.threads.find(t=>t.id===sim.threadId1), b=layout.threads.find(t=>t.id===sim.threadId2);
        if (!a||!b||a.xf===undefined||b.xf===undefined) continue;
        const lit=linkLit(sim.id,sim.threadId1,sim.threadId2);
        const col=lit?C.amber:'rgba(150,100,50,0.4)', al=lit?0.38:0.07, w=lit?1.6*z:0.55*z;
        const sx=GX(sim.xf),sy=GY(sim.yf!);
        drawCurve(ctx,GX(a.xf),GY(a.yf!),sx,sy,GX((a.xf+sim.xf)/2),GY((a.yf!+sim.yf!)/2),col,al,w);
        drawCurve(ctx,GX(b.xf),GY(b.yf!),sx,sy,GX((b.xf+sim.xf)/2),GY((b.yf!+sim.yf!)/2),col,al,w);
      }

      // curves: note–thread
      for (const note of layout.notes) {
        if (note.xf===undefined) continue;
        if (activeFilter!=='all'&&note.category!==activeFilter) continue;
        const th=layout.threads.find(t=>t.id===note.threadId);
        if (!th||th.xf===undefined) continue;
        const lit=noteLit(note), hovN=hovered?.type==='note'&&hovered.id===note.id;
        drawCurve(ctx,GX(note.xf),GY(note.yf!),GX(th.xf),GY(th.yf!),GX((note.xf+th.xf)/2),GY((note.yf!+th.yf!)/2),
          hovN?C.white:lit?C.green:'rgba(100,140,80,0.3)', hovN?0.6:lit?0.3:0.07, hovN?1.4*z:lit?1.0*z:0.45*z);
      }

      // particles
      for (const p of particles) {
        p.p=(p.p+p.s)%1;
        if (!linkLit(p.simId,p.threadId1,p.threadId2)) continue;
        const sim=layout.similarities.find(s=>s.id===p.simId);
        const a=layout.threads.find(t=>t.id===p.threadId1), b=layout.threads.find(t=>t.id===p.threadId2);
        if (!sim||!a||!b||sim.xf===undefined||a.xf===undefined||b.xf===undefined) continue;
        const sx=GX(sim.xf),sy=GY(sim.yf!);
        const pt=p.p<0.5
          ?bezierPt(p.p*2,GX(a.xf),GY(a.yf!),GX((a.xf+sim.xf)/2),GY((a.yf!+sim.yf!)/2),sx,sy)
          :bezierPt((p.p-.5)*2,sx,sy,GX((sim.xf+b.xf)/2),GY((sim.yf!+b.yf!)/2),GX(b.xf),GY(b.yf!));
        ctx.globalAlpha=0.9*Math.sin(p.p*Math.PI); ctx.fillStyle=C.amberBright;
        ctx.beginPath(); ctx.arc(pt.x,pt.y,2.2*z,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
      }

      // note nodes
      for (const note of layout.notes) {
        if (note.xf===undefined) continue;
        if (activeFilter!=='all'&&note.category!==activeFilter) continue;
        const lit=noteLit(note), isHov=hovered?.type==='note'&&hovered.id===note.id;
        drawOrb(ctx,GX(note.xf),GY(note.yf!),lit?7:NOTE_R,isHov?C.white:lit?C.green:C.greenDim,0.08,animT,lit,isHov);
      }

      // similarity nodes
      for (const sim of layout.similarities) {
        if (sim.xf===undefined) continue;
        const x=GX(sim.xf),y=GY(sim.yf!),lit=simLit(sim),isHov=hovered?.type==='similarity'&&hovered.id===sim.id;
        const r=(lit?12:SIM_R)*z;
        ctx.globalAlpha=lit?0.35:0.12; ctx.strokeStyle=C.amber; ctx.lineWidth=lit?1.4:1; ctx.setLineDash([3,4]);
        ctx.beginPath(); ctx.arc(x,y,r*2.5,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1;
        const g=ctx.createRadialGradient(x,y,0,x,y,r*5);
        g.addColorStop(0,`rgba(244,162,97,${lit?0.45:0.12})`); g.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r*5,0,Math.PI*2); ctx.fill();
        ctx.save(); ctx.translate(x,y); ctx.rotate(Math.PI/4+animT*(lit?0.55:0.22));
        const d=r*0.92; ctx.fillStyle=lit?C.amberBright:C.amberDim; ctx.globalAlpha=lit?1:0.6;
        ctx.beginPath(); ctx.moveTo(0,-d); ctx.lineTo(d,0); ctx.lineTo(0,d); ctx.lineTo(-d,0); ctx.closePath(); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.28)';
        ctx.beginPath(); ctx.moveTo(0,-d*.5); ctx.lineTo(d*.45,0); ctx.lineTo(0,-d*.08); ctx.closePath(); ctx.fill();
        ctx.restore(); ctx.globalAlpha=1;
        const ly=y+r*2.8+8;
        ctx.font=`${lit?'700':'600'} ${(lit?15:13)*z}px Inter,sans-serif`;
        ctx.fillStyle=lit?C.amberBright:`rgba(244,162,97,${isHov?0.85:0.5})`; ctx.textAlign='center'; ctx.fillText(sim.label,x,ly);
        ctx.font=`500 ${(lit?11:9.5)*z}px Inter,sans-serif`; ctx.fillStyle=`rgba(244,162,97,${lit?0.55:0.22})`;
        ctx.fillText('✦ KI-Verbindung',x,ly+(lit?17:14)*z);
      }

      // thread nodes
      for (const th of layout.threads) {
        if (th.xf===undefined) continue;
        const isDragging=drag?.threadId===th.id, isClicked=activeThreadId===th.id;
        const isHov=hovered?.type==='thread'&&hovered.id===th.id;
        const simHov=!isHov&&hovered?.type==='similarity'&&(()=>{const s=layout.similarities.find(s=>s.id===hovered!.id);return s&&(s.threadId1===th.id||s.threadId2===th.id);})();
        const lit=isClicked||isHov||!!simHov||isDragging;
        if (isDragging) { ctx.globalAlpha=0.25; ctx.fillStyle=C.amber; ctx.beginPath(); ctx.arc(GX(th.xf)+4,GY(th.yf!)+6,THREAD_R*z*1.1,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; }
        drawOrb(ctx,GX(th.xf),GY(th.yf!),THREAD_R,C.amber,0.1,animT,lit,isHov||!!simHov);
        const rl=THREAD_R*z*(lit?1.08:1);
        ctx.font=`${lit?'600':'500'} ${(lit?13:11)*z}px Inter,sans-serif`;
        ctx.fillStyle=lit?C.amber:`rgba(${hexRgb(C.amber)},0.5)`; ctx.textAlign='center';
        ctx.fillText(th.title,GX(th.xf),GY(th.yf!)+rl+16*z);
      }

      ctx.restore();
      rt.current.animT += 0.016;
      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('mousedown',  onMouseDown);
      window.removeEventListener('mousemove',  onWindowMouseMove);
      window.removeEventListener('mouseup',    onWindowMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('click',      onClick);
      window.removeEventListener('resize',     resize);
    };
  // runs exactly once after mount — propsRef keeps values current
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />;
}
