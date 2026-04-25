'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { GraphData, GraphNode } from '@/types';

const THREAD_COLOR = '#7B6EF6';
const NOTE_COLOR = '#5B5B8A';
const BG_COLOR = '#0F1117';
const LINK_COLOR = 'rgba(123,110,246,0.2)';
const SCREEN_THRESHOLD_PX = 24;

interface Props {
  data: GraphData;
  onNodeClick: (node: GraphNode) => void;
}

export default function Graph({ data, onNodeClick }: Props) {
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredNode, setHoveredNode] = useState<any>(null);
  const [tooltip, setTooltip] = useState<{ label: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const update = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Reduce repulsion so clusters sit closer together
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force('charge')?.strength(-20);
    fg.d3Force('link')?.distance(40).strength(0.6);
    fg.d3ReheatSimulation();
  }, []);

  const findNearestNode = useCallback((clientX: number, clientY: number, rect: DOMRect) => {
    const fg = fgRef.current;
    if (!fg) return null;
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    let nearest: any = null;
    let minDist = Infinity;
    for (const node of (data as any).nodes) {
      if (node.x == null || node.y == null) continue;
      const screenPos = fg.graph2ScreenCoords(node.x, node.y);
      const d = Math.hypot(screenPos.x - mx, screenPos.y - my);
      if (d < SCREEN_THRESHOLD_PX && d < minDist) {
        minDist = d;
        nearest = node;
      }
    }
    return nearest;
  }, [data]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const nearest = findNearestNode(e.clientX, e.clientY, rect);

    setHoveredNode((prev: any) => prev?.id === nearest?.id ? prev : nearest);

    if (nearest?.type === 'note') {
      setTooltip({ label: nearest.label, x: mx + 16, y: my - 12 });
    } else {
      setTooltip(null);
    }
  }, [findNearestNode]);

  const handleMouseLeave = useCallback(() => {
    setHoveredNode(null);
    setTooltip(null);
  }, []);

  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D) => {
    const isThread = node.type === 'thread';
    const isHovered = hoveredNode?.id === node.id;
    const r = isThread ? (isHovered ? 17 : 14) : (isHovered ? 10 : 8);
    const color = isThread ? THREAD_COLOR : NOTE_COLOR;
    const litColor = isThread ? '#9B8EFF' : '#5AEFCE';

    ctx.shadowColor = color;
    ctx.shadowBlur = isHovered ? (isThread ? 32 : 22) : (isThread ? 18 : 10);
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = isHovered ? litColor : color;
    ctx.fill();
    ctx.shadowBlur = 0;

    if (isThread) {
      ctx.font = `${isHovered ? 'bold ' : ''}11px Inter, sans-serif`;
      ctx.fillStyle = isHovered ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.85)';
      ctx.textAlign = 'center';
      ctx.fillText(node.label, node.x, node.y + r + 8);
    }
  }, [hoveredNode]);

  const handleWrapperClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const fg = fgRef.current;
    if (!fg) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nearest = findNearestNode(e.clientX, e.clientY, rect);
    if (nearest) {
      e.stopPropagation();
      onNodeClick(nearest as GraphNode);
      fg.centerAt(nearest.x, nearest.y, 600);
      fg.zoom(2.5, 600);
    }
  }, [findNearestNode, onNodeClick]);

  if (dimensions.width === 0) return null;

  return (
    <div
      style={{ width: dimensions.width, height: dimensions.height, cursor: hoveredNode ? 'pointer' : 'default', position: 'relative' }}
      onClick={handleWrapperClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={data as any}
        backgroundColor={BG_COLOR}
        nodeCanvasObject={paintNode}
        nodeCanvasObjectMode={() => 'replace'}
        nodePointerAreaPaint={() => {}}
        linkColor={() => LINK_COLOR}
        linkWidth={1}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.004}
        linkDirectionalParticleColor={() => THREAD_COLOR}
        cooldownTicks={120}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
      />

      {tooltip && (
        <div
          style={{ position: 'absolute', left: tooltip.x, top: tooltip.y, pointerEvents: 'none' }}
          className="bg-[#181B23] border border-[#3ECFB430] rounded-lg px-3 py-1.5 text-xs text-white/80 max-w-[200px] shadow-lg backdrop-blur-sm"
        >
          {tooltip.label}
        </div>
      )}
    </div>
  );
}
