import React from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Text, useTheme, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThoughts } from '../context/ThoughtsContext';
import { useNotes } from '../context/NotesContext';
import { Insets, Shadows } from '../theme/gradients';
import { Tokens } from '../theme/theme';
import { Type, Fonts } from '../theme/typography';
import { groupNotesByTime } from '../utils/timeGrouping';
import TimelineSection from '../components/TimelineSection';

interface Props {
  navigation: any;
  route: any;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ThreadDetailScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { threads, loading } = useThoughts();
  const { notes } = useNotes();

  const threadId = route.params?.threadId as string;
  const thread = threads.find((t) => t.id === threadId);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!thread) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.onSurfaceVariant }}>Thread nicht gefunden</Text>
      </View>
    );
  }

  const lastSynth = thread.lastSynthesizedAt ? formatDateTime(thread.lastSynthesizedAt) : null;
  const threadNotes = notes.filter((n) => thread.noteIds.includes(n.id));
  const groupedNotes = groupNotesByTime(threadNotes, new Date());

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary card — Papier-Stil */}
        <View style={[styles.summaryCard, Insets.cardBorder, Shadows.softWarm]}>
          <View style={[styles.summaryIconWrap, { backgroundColor: Tokens.amberSoft }]}>
            <MaterialCommunityIcons name="creation" size={20} color={Tokens.amberDeep} />
          </View>

          <Text style={styles.summaryLabel}>KI-Zusammenfassung</Text>

          {thread.summary ? (
            <Text style={styles.summaryText}>{thread.summary}</Text>
          ) : (
            <Text style={styles.summaryEmpty}>
              Noch keine Zusammenfassung vorhanden.{'\n'}
              Der Worker wird sie beim nächsten Lauf erstellen.
            </Text>
          )}

          {/* Meta row */}
          <View style={styles.summaryMeta}>
            <MaterialCommunityIcons
              name="note-text-outline"
              size={13}
              color={Tokens.inkFaint}
              style={{ marginRight: 4 }}
            />
            <Text style={styles.metaText}>
              {thread.noteCount} {thread.noteCount === 1 ? 'Notiz' : 'Notizen'}
            </Text>
            {lastSynth && (
              <>
                <Text style={styles.metaDot}>·</Text>
                <MaterialCommunityIcons
                  name="sync"
                  size={12}
                  color={Tokens.inkFaint}
                  style={{ marginRight: 3 }}
                />
                <Text style={styles.metaText}>{lastSynth}</Text>
              </>
            )}
          </View>
        </View>

        {/* Timeline */}
        {groupedNotes.length > 0 && (
          <View style={styles.timeline}>
            <Text style={styles.timelineHeader}>Enthaltene Notizen</Text>
            {groupedNotes.map((group) => (
              <TimelineSection
                key={group.label}
                groupLabel={group.label}
                notes={group.notes}
                onNotePress={(noteId) => navigation.navigate('NoteDetail', { noteId })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, gap: 16 },
  summaryCard: {
    borderRadius: 16,
    padding: 18,
    gap: 10,
    backgroundColor: Tokens.paperDeep,
  },
  summaryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    fontFamily: Fonts.sansSemibold,
    fontSize: 10.5,
    textTransform: 'uppercase',
    letterSpacing: 0.84,
    color: Tokens.inkFaint,
  },
  summaryText: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: Tokens.ink,
  },
  summaryEmpty: {
    fontFamily: Fonts.serifItalic,
    fontSize: 14,
    color: Tokens.inkFaint,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  summaryMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  metaText: { fontFamily: Fonts.sans, fontSize: 12, color: Tokens.inkFaint },
  metaDot: { marginHorizontal: 5, color: Tokens.inkFaint, opacity: 0.4 },
  timeline: {
    gap: 16,
  },
  timelineHeader: {
    fontFamily: Fonts.sansSemibold,
    fontSize: 10.5,
    textTransform: 'uppercase',
    letterSpacing: 0.84,
    color: Tokens.inkFaint,
    marginBottom: -4,
  },
});
