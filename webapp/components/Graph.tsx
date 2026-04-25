'use client';

import dynamic from 'next/dynamic';
import { useCallback, useRef } from 'react';
import { GraphData, GraphNode } from '@/types';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

const THREAD_COLOR = '#7B6EF6';
const NOTE_COLOR = '#3ECFB4';
const BG_COLOR = '#0F1117';
const LINK_COLOR = 'rgba(123,110,246,0.35)';

interface Props {
  data: GraphData;
  onNodeClick: (node: GraphNode) => void;
}

export default function Graph({ data, onNodeClick }: Props) {
  const fgRef = useRef<any>(null);

  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D) => {
    const isThread = node.type === 'thread';
    const r = isThread ? 14 : 8;
    const color = isThread ? THREAD_COLOR : NOTE_COLOR;

    // Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = isThread ? 18 : 10;

    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.shadowBlur = 0;

    // Label for threads only
    if (isThread) {
      ctx.font = '5px Inter, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.textAlign = 'center';
      ctx.fillText(node.label, node.x, node.y + r + 7);
    }
  }, []);

  const handleClick = useCallback(
    (node: any) => {
      onNodeClick(node as GraphNode);
      fgRef.current?.centerAt(node.x, node.y, 600);
      fgRef.current?.zoom(2.5, 600);
    },
    [onNodeClick],
  );

  return (
    <ForceGraph2D
      ref={fgRef}
      graphData={data as any}
      backgroundColor={BG_COLOR}
      nodeCanvasObject={paintNode}
      nodeCanvasObjectMode={() => 'replace'}
      linkColor={() => LINK_COLOR}
      linkWidth={1}
      linkDirectionalParticles={2}
      linkDirectionalParticleSpeed={0.004}
      linkDirectionalParticleColor={() => THREAD_COLOR}
      onNodeClick={handleClick}
      nodePointerAreaPaint={(node: any, color, ctx) => {
        const r = node.type === 'thread' ? 16 : 10;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
      }}
      cooldownTicks={120}
      d3AlphaDecay={0.02}
      d3VelocityDecay={0.3}
    />
  );
}
