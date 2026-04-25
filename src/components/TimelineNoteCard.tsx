import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Note } from '../models/Note';
import { calculateReadTime, isNewNote, formatRelativeDate } from '../utils/timeGrouping';

interface Props {
  note: Note;
  onPress: () => void;
}

const PREVIEW_LENGTH = 120;

export default function TimelineNoteCard({ note, onPress }: Props) {
  const theme = useTheme();
  const fresh = isNewNote(note.createdAt);
  const readTime = calculateReadTime(note.content);
  const relDate = formatRelativeDate(note.createdAt);

  const preview = note.content.length > PREVIEW_LENGTH
    ? note.content.slice(0, PREVIEW_LENGTH).trimEnd() + '…'
    : note.content;

  const accentColor = fresh ? '#3ECFB4' : theme.colors.primary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
    >
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surfaceVariant },
        fresh && styles.cardNew,
        fresh ? { borderLeftColor: '#3ECFB4' } : { borderLeftColor: theme.colors.primary },
      ]}
    >
      <MaterialCommunityIcons
        name={fresh ? 'lightbulb-outline' : 'circle-small'}
        size={fresh ? 18 : 22}
        color={accentColor}
        style={styles.icon}
      />
      <View style={styles.body}>
        {note.title ? (
          <Text style={[styles.title, { color: theme.colors.onSurface }]} numberOfLines={1}>
            {note.title}
          </Text>
        ) : null}
        <Text
          style={[styles.preview, { color: theme.colors.onSurface }, !fresh && styles.dimmed]}
        >
          {preview}
        </Text>
        <View style={styles.meta}>
          <MaterialCommunityIcons
            name="clock-outline"
            size={11}
            color={theme.colors.onSurfaceVariant}
          />
          <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
            {' ~'}{readTime} Min. · {relDate}
          </Text>
        </View>
      </View>
    </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderLeftWidth: 3,
    padding: 12,
    paddingLeft: 10,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  cardNew: {
    opacity: 1.0,
  },
  icon: {
    marginTop: 1,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
  },
  preview: {
    fontSize: 14,
    lineHeight: 20,
  },
  dimmed: {
    opacity: 0.8,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  metaText: {
    fontSize: 11,
    opacity: 0.6,
  },
});
