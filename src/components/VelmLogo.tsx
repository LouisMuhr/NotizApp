import React from 'react';
import Svg, { Path, Rect, G, Defs, LinearGradient, Stop } from 'react-native-svg';

/**
 * Velm App-Icon — Bleistift schreibt ein kalligraphisches V.
 * 1:1 aus dem Design-Handoff ("Velm Icon - Final.html").
 *
 * `size`    Kantenlänge der Kachel in px.
 * `tile`    true (Default) = abgerundete Kachel mit Brand-Gradient.
 *           false = nur die weiße Glyphe (transparent).
 */
export default function VelmLogo({ size = 40, tile = true }: { size?: number; tile?: boolean }) {
  const glyph = (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d="M 10 11 C 16 42, 33 68, 43 84" stroke="#fff" strokeWidth={8} strokeLinecap="round" fill="none" />
      <Path d="M 43 84 C 53 68, 68 40, 76 11" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" fill="none" />
      <G transform="translate(43,84) rotate(45)">
        <Path d="M 0 0 L -3 -10 L 3 -10 Z" fill="#fff" fillOpacity={0.55} stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" />
        <Path d="M -3 -10 L -5.5 -19 L 5.5 -19 L 3 -10 Z" fill="#fff" fillOpacity={0.3} stroke="#fff" strokeWidth={1.8} />
        <Rect x={-5.5} y={-55} width={11} height={36} rx={1.5} fill="#fff" fillOpacity={0.15} stroke="#fff" strokeWidth={2} />
        <Rect x={-6.5} y={-58} width={13} height={4.5} fill="#fff" fillOpacity={0.4} stroke="#fff" strokeWidth={1.8} />
        <Rect x={-5} y={-68} width={10} height={12} rx={5} fill="#fff" fillOpacity={0.22} stroke="#fff" strokeWidth={2} />
      </G>
    </Svg>
  );

  if (!tile) return glyph;

  // Kachel + Glyphe in einem viewBox-0..100-Koordinatensystem — skaliert sauber für jede size.
  const r = 26;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="velmTile" x1="14.5%" y1="6.7%" x2="85.5%" y2="93.3%">
          <Stop offset="0" stopColor="#F4A261" />
          <Stop offset="0.5" stopColor="#E8874A" />
          <Stop offset="1" stopColor="#C05C20" />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={100} height={100} rx={r} fill="url(#velmTile)" />
      <G transform="translate(15,15) scale(0.7)">
        <Path d="M 10 11 C 16 42, 33 68, 43 84" stroke="#fff" strokeWidth={8} strokeLinecap="round" fill="none" />
        <Path d="M 43 84 C 53 68, 68 40, 76 11" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" fill="none" />
        <G transform="translate(43,84) rotate(45)">
          <Path d="M 0 0 L -3 -10 L 3 -10 Z" fill="#fff" fillOpacity={0.55} stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" />
          <Path d="M -3 -10 L -5.5 -19 L 5.5 -19 L 3 -10 Z" fill="#fff" fillOpacity={0.3} stroke="#fff" strokeWidth={1.8} />
          <Rect x={-5.5} y={-55} width={11} height={36} rx={1.5} fill="#fff" fillOpacity={0.15} stroke="#fff" strokeWidth={2} />
          <Rect x={-6.5} y={-58} width={13} height={4.5} fill="#fff" fillOpacity={0.4} stroke="#fff" strokeWidth={1.8} />
          <Rect x={-5} y={-68} width={10} height={12} rx={5} fill="#fff" fillOpacity={0.22} stroke="#fff" strokeWidth={2} />
        </G>
      </G>
    </Svg>
  );
}
