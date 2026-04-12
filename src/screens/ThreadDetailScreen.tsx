import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Modal,
  FlatList,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { Text, useTheme, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThoughts } from '../context/ThoughtsContext';
import { Thought } from '../models/Thought';
import { Gradients } from '../theme/gradients';
import * as haptics from '../utils/haptics';

interface Props {
  navigation: any;
  route: any;
}

const SOURCE_ICON: Record<string, string> = {
  voice: 'microphone-outline',
  app: 'pencil-outline',
  share: 'share-outline',
  bridge: 'link-variant',
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (minutes < 1) return 'gerade eben';
  if (minutes < 60) return `vor ${minutes} Min.`;
  if (hours < 24) return `vor ${hours} Std.`;
  if (days === 1) return 'gestern';
  return `vor ${days} Tagen`;
}

interface ThoughtItemProps {
  thought: Thought;
  isLast: boolean;
}

function ThoughtItem({ thought, isLast }: ThoughtItemProps) {
  const theme = useTheme();
  const icon = SOURCE_ICON[thought.source] ?? 'circle-small';

  return (
    <View style={styles.thoughtRow}>
      {/* Timeline line */}
      <View style={styles.timelineCol}>
        <LinearGradient
          colors={Gradients.primary}
          style={styles.timelineDot}
        />
        {!isLast && (
          <View style={[styles.timelineLine, { backgroundColor: theme.colors.surfaceVariant }]} />
        )}
      </View>

      {/* Content */}
      <View style={[styles.thoughtContent, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Text style={[styles.thoughtText, { color: theme.colors.onSurface }]}>
          {thought.content}
        </Text>
        <View style={styles.thoughtMeta}>
          <MaterialCommunityIcons
            name={icon as any}
            size={12}
            color={theme.colors.onSurfaceVariant}
            style={{ marginRight: 3 }}
          />
          <Text style={[styles.thoughtMetaText, { color: theme.colors.onSurfaceVariant }]}>
            {formatDateTime(thought.createdAt)}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function ThreadDetailScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { thoughts, threads, links, loading, getThoughtsForThread, linkThoughtToThread } = useThoughts();
  const [showLinkModal, setShowLinkModal] = useState(false);

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

  const linkedThoughts = getThoughtsForThread(threadId);
  const linkedIds = new Set(linkedThoughts.map((t) => t.id));

  // Thoughts that are not yet linked to this thread, sorted newest first
  const unlinkableThoughts = thoughts
    .filter((t) => !linkedIds.has(t.id))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const lastSynth = thread.lastSynthesizedAt
    ? formatDateTime(thread.lastSynthesizedAt)
    : null;

  const handleLink = (thought: Thought) => {
    haptics.medium();
    linkThoughtToThread(thought.id, threadId);
    setShowLinkModal(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary card */}
        <View style={[styles.summaryCard, { backgroundColor: theme.colors.surfaceVariant }]}>
          {/* Header icon */}
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
              name="thought-bubble-outline"
              size={13}
              color={theme.colors.onSurfaceVariant}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
              {thread.thoughtCount} {thread.thoughtCount === 1 ? 'Gedanke' : 'Gedanken'}
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

        {/* Thoughts section header */}
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          Gedanken ({linkedThoughts.length})
        </Text>

        {linkedThoughts.length === 0 ? (
          <View style={styles.emptyThoughts}>
            <MaterialCommunityIcons
              name="timeline-outline"
              size={32}
              color={theme.colors.onSurfaceVariant}
              style={{ opacity: 0.4 }}
            />
            <Text style={[styles.emptyThoughtsText, { color: theme.colors.onSurfaceVariant }]}>
              Noch keine Gedanken verknüpft
            </Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            {linkedThoughts.map((thought, idx) => (
              <ThoughtItem
                key={thought.id}
                thought={thought}
                isLast={idx === linkedThoughts.length - 1}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* FAB: Thought manuell hinzufügen */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.colors.primaryContainer }]}
        onPress={() => {
          haptics.light();
          setShowLinkModal(true);
        }}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="link-plus" size={24} color={theme.colors.primary} />
      </TouchableOpacity>

      {/* Modal: Thought auswählen */}
      <Modal
        visible={showLinkModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowLinkModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowLinkModal(false)}
        >
          <Pressable
            style={[styles.modalSheet, { backgroundColor: theme.colors.surface }]}
            onPress={() => {}}
          >
            <View style={[styles.modalHandle, { backgroundColor: theme.colors.onSurfaceVariant }]} />

            <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
              Thought verknüpfen
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              Wähle einen Gedanken aus, der zu diesem Thread passt.
            </Text>

            {unlinkableThoughts.length === 0 ? (
              <View style={styles.modalEmpty}>
                <MaterialCommunityIcons
                  name="check-circle-outline"
                  size={40}
                  color={theme.colors.onSurfaceVariant}
                  style={{ opacity: 0.4 }}
                />
                <Text style={[styles.modalEmptyText, { color: theme.colors.onSurfaceVariant }]}>
                  Alle Gedanken sind bereits verknüpft
                </Text>
              </View>
            ) : (
              <FlatList
                data={unlinkableThoughts}
                keyExtractor={(item) => item.id}
                style={styles.modalList}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => handleLink(item)}
                    style={({ pressed }) => [
                      styles.modalItem,
                      { backgroundColor: pressed ? theme.colors.surfaceVariant : 'transparent' },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={(SOURCE_ICON[item.source] ?? 'circle-small') as any}
                      size={16}
                      color={theme.colors.primary}
                      style={{ marginRight: 10, marginTop: 2 }}
                    />
                    <View style={styles.modalItemContent}>
                      <Text
                        style={[styles.modalItemText, { color: theme.colors.onSurface }]}
                        numberOfLines={2}
                      >
                        {item.content}
                      </Text>
                      <Text style={[styles.modalItemMeta, { color: theme.colors.onSurfaceVariant }]}>
                        {formatRelativeTime(item.createdAt)}
                      </Text>
                    </View>
                  </Pressable>
                )}
                ItemSeparatorComponent={() => (
                  <View style={[styles.modalSeparator, { backgroundColor: theme.colors.surfaceVariant }]} />
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
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
  summaryText: {
    fontSize: 15,
    lineHeight: 22,
  },
  summaryEmpty: {
    fontSize: 13,
    fontStyle: 'italic',
    opacity: 0.5,
    lineHeight: 20,
  },
  summaryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  metaText: {
    fontSize: 12,
    opacity: 0.6,
  },
  metaDot: {
    marginHorizontal: 5,
    opacity: 0.4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
    marginLeft: 2,
  },
  timeline: {
    gap: 0,
  },
  thoughtRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 0,
  },
  timelineCol: {
    alignItems: 'center',
    width: 20,
    paddingTop: 16,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
    minHeight: 16,
  },
  thoughtContent: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    gap: 6,
  },
  thoughtText: {
    fontSize: 14,
    lineHeight: 20,
  },
  thoughtMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thoughtMetaText: {
    fontSize: 11,
    opacity: 0.6,
  },
  emptyThoughts: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 32,
  },
  emptyThoughtsText: {
    fontSize: 13,
    opacity: 0.5,
  },
  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
    opacity: 0.3,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    opacity: 0.6,
    marginBottom: 16,
  },
  modalList: {
    flexGrow: 0,
  },
  modalItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  modalItemContent: {
    flex: 1,
    gap: 3,
  },
  modalItemText: {
    fontSize: 14,
    lineHeight: 19,
  },
  modalItemMeta: {
    fontSize: 11,
    opacity: 0.5,
  },
  modalSeparator: {
    height: 1,
    opacity: 0.4,
  },
  modalEmpty: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  modalEmptyText: {
    fontSize: 14,
    opacity: 0.5,
  },
});
