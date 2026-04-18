import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Note } from '../models/Note';
import TimelineNoteCard from './TimelineNoteCard';

interface Props {
  groupLabel: string;
  notes: Note[];
}

export default function TimelineSection({ groupLabel, notes }: Props) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons
          name="calendar-outline"
          size={13}
          color={theme.colors.primary}
        />
        <Text style={[styles.label, { color: theme.colors.primary }]}>
          {groupLabel}
        </Text>
      </View>
      <View style={styles.cards}>
        {notes.map((note) => (
          <TimelineNoteCard key={note.id} note={note} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    opacity: 0.85,
  },
  cards: {
    gap: 8,
  },
});
