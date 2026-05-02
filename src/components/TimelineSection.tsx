import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Note } from '../models/Note';
import TimelineNoteCard from './TimelineNoteCard';
import { Tokens } from '../theme/theme';
import { Fonts } from '../theme/typography';
import { Text } from 'react-native-paper';

interface Props {
  groupLabel: string;
  notes: Note[];
  onNotePress: (noteId: string) => void;
}

export default function TimelineSection({ groupLabel, notes, onNotePress }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons
          name="calendar-outline"
          size={13}
          color={Tokens.amber}
        />
        <Text style={styles.label}>
          {groupLabel}
        </Text>
      </View>
      <View style={styles.cards}>
        {notes.map((note) => (
          <TimelineNoteCard key={note.id} note={note} onPress={() => onNotePress(note.id)} />
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
    fontFamily: Fonts.sansSemibold,
    fontSize: 10.5,
    textTransform: 'uppercase',
    letterSpacing: 0.84,
    color: Tokens.amber,
    opacity: 0.85,
  },
  cards: {
    gap: 8,
  },
});
