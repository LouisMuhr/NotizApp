import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Note } from '../models/Note';
import { calculateReadTime, isNewNote, formatRelativeDate } from '../utils/timeGrouping';
import { Tokens } from '../theme/theme';
import { Fonts } from '../theme/typography';

interface Props {
  note: Note;
  onPress: () => void;
}

const PREVIEW_LENGTH = 120;

export default function TimelineNoteCard({ note, onPress }: Props) {
  const fresh = isNewNote(note.createdAt);
  const readTime = calculateReadTime(note.content);
  const relDate = formatRelativeDate(note.createdAt);

  const preview = note.content.length > PREVIEW_LENGTH
    ? note.content.slice(0, PREVIEW_LENGTH).trimEnd() + '…'
    : note.content;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={[
        styles.card,
        fresh ? { borderLeftColor: Tokens.amber } : { borderLeftColor: Tokens.rule },
      ]}>
        <MaterialCommunityIcons
          name={fresh ? 'lightbulb-outline' : 'circle-small'}
          size={fresh ? 18 : 22}
          color={fresh ? Tokens.amber : Tokens.inkFaint}
          style={styles.icon}
        />
        <View style={styles.body}>
          {note.title ? (
            <Text style={styles.title} numberOfLines={1}>
              {note.title}
            </Text>
          ) : null}
          <Text style={[styles.preview, !fresh && styles.dimmed]}>
            {preview}
          </Text>
          <View style={styles.meta}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={11}
              color={Tokens.inkFaint}
            />
            <Text style={styles.metaText}>
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
    backgroundColor: Tokens.paperDeep,
    borderRadius: 10,
    borderLeftWidth: 2,
    padding: 12,
    paddingLeft: 10,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  icon: {
    marginTop: 1,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: Fonts.sansSemibold,
    fontSize: 13,
    color: Tokens.ink,
  },
  preview: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: Tokens.inkDim,
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
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Tokens.inkFaint,
    opacity: 0.6,
  },
});
