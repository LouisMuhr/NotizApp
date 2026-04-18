import React from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Text, useTheme, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThoughts } from '../context/ThoughtsContext';
import { useNotes } from '../context/NotesContext';
import { Gradients } from '../theme/gradients';

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

export default function ThreadDetailScreen({ route }: Props) {
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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary card */}
        <View style={[styles.summaryCard, { backgroundColor: theme.colors.surfaceVariant }]}>
          <LinearGradient
            colors={Gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.summaryIconWrap}
          >
            <MaterialCommunityIcons name="brain" size={20} color="#FFFFFF" />
          </LinearGradient>

          <Text style={[styles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>
            KI-Zusammenfassung
          </Text>

          {thread.summary ? (
            <Text style={[styles.summaryText, { color: theme.colors.onSurface }]}>
              {thread.summary}
            </Text>
          ) : (
            <Text style={[styles.summaryEmpty, { color: theme.colors.onSurfaceVariant }]}>
              Noch keine Zusammenfassung vorhanden.{'\n'}
              Der Worker wird sie beim nächsten Lauf erstellen.
            </Text>
          )}

          {/* Meta row */}
          <View style={styles.summaryMeta}>
            <MaterialCommunityIcons
              name="note-text-outline"
              size={13}
              color={theme.colors.onSurfaceVariant}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
              {thread.noteCount} {thread.noteCount === 1 ? 'Notiz' : 'Notizen'}
            </Text>
            {lastSynth && (
              <>
                <Text style={[styles.metaDot, { color: theme.colors.onSurfaceVariant }]}>·</Text>
                <MaterialCommunityIcons
                  name="sync"
                  size={12}
                  color={theme.colors.onSurfaceVariant}
                  style={{ marginRight: 3 }}
                />
                <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
                  {lastSynth}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Source notes */}
        {threadNotes.length > 0 && (
          <View style={styles.notesSection}>
            <Text style={[styles.notesSectionLabel, { color: theme.colors.onSurfaceVariant }]}>
              Enthaltene Notizen
            </Text>
            {threadNotes.map((note) => (
              <View
                key={note.id}
                style={[styles.noteCard, { backgroundColor: theme.colors.surfaceVariant }]}
              >
                <MaterialCommunityIcons
                  name="note-text-outline"
                  size={14}
                  color={theme.colors.primary}
                  style={{ marginTop: 2 }}
                />
                <Text
                  style={[styles.noteText, { color: theme.colors.onSurface }]}
                >
                  {note.title ? `${note.title}\n${note.content}` : note.content}
                </Text>
              </View>
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
    borderRadius: 20,
    padding: 18,
    gap: 10,
  },
  summaryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    opacity: 0.7,
  },
  summaryText: { fontSize: 15, lineHeight: 22 },
  summaryEmpty: { fontSize: 13, fontStyle: 'italic', opacity: 0.5, lineHeight: 20 },
  summaryMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  metaText: { fontSize: 12, opacity: 0.6 },
  metaDot: { marginHorizontal: 5, opacity: 0.4 },
  notesSection: {
    gap: 8,
  },
  notesSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    opacity: 0.7,
    marginBottom: 2,
  },
  noteCard: {
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  noteText: { flex: 1, fontSize: 14, lineHeight: 20 },
});
