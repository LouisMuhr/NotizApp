import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Tokens } from '../../theme/theme';
import { shared } from './shared';

export function Dots({ count, active }: { count: number; active: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: i === active ? 18 : 6,
            height: 6,
            borderRadius: 999,
            backgroundColor: i === active ? Tokens.amberDeep : Tokens.inkFaint,
            opacity: i === active ? 1 : 0.35,
          }}
        />
      ))}
    </View>
  );
}

export function SkipRow({ label, onSkip }: { label: string; onSkip: () => void }) {
  return (
    <View style={shared.skipRow}>
      <Text style={shared.pageLabel}>{label}</Text>
      <TouchableOpacity onPress={onSkip}>
        <Text style={shared.skipText}>Überspringen</Text>
      </TouchableOpacity>
    </View>
  );
}

export function NextButton({
  label,
  onPress,
  bgColor = Tokens.ink,
  fgColor = Tokens.paper,
}: {
  label: string;
  onPress: () => void;
  bgColor?: string;
  fgColor?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[shared.nextBtn, { backgroundColor: bgColor }]}
    >
      <Text style={[shared.nextBtnText, { color: fgColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}
