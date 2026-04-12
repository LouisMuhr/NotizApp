import React, { useState, useCallback, useRef } from 'react';
import { StyleSheet, View, FlatList, Pressable, Animated } from 'react-native';
import { Text, useTheme, Portal, Dialog, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNotes } from '../context/NotesContext';
import { useThoughts } from '../context/ThoughtsContext';
import { Note } from '../models/Note';
import { Thread } from '../models/Thought';
import { getCategoryColor } from '../utils/categoryColors';
import { Gradients, Radii, Shadows } from '../theme/gradients';
import * as haptics from '../utils/haptics';

// ---------------------------------------------------------------------------
// Archived Note Row (unchanged)
// ---------------------------------------------------------------------------

interface ArchiveRowProps {
  item: Note;
  onRestore: () => void;
  onRequestDelete: () => void;
  onPress: () => void;
}

function ArchiveRow({ item, onRestore, onRequestDelete, onPress }: ArchiveRowProps) {
  const theme = useTheme();
  const catColor = getCategoryColor(item.category);
  const swipeableRef = useRef<Swipeable>(null);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });

  const renderLeftActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [0.5, 1],
      extrapolate: 'clamp',
    });
    return (
      <View style={[styles.swipeAction, styles.leftAction, { backgroundColor: theme.colors.tertiaryContainer }]}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <MaterialCommunityIcons name="restore" size={24} color={theme.colors.tertiary} />
        </Animated.View>
        <Text style={[styles.swipeLabel, { color: theme.colors.tertiary }]}>Wiederherstellen</Text>
      </View>
    );
  };

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.5],
      extrapolate: 'clamp',
    });
    return (
      <View style={[styles.swipeAction, styles.rightAction, { backgroundColor: theme.colors.errorContainer }]}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <MaterialCommunityIcons name="trash-can-outline" size={24} color={theme.colors.error} />
        </Animated.View>
        <Text style={[styles.swipeLabel, { color: theme.colors.error }]}>Löschen</Text>
      </View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableOpen={(direction) => {
        swipeableRef.current?.close();
        if (direction === 'left') {
          haptics.light();
          onRestore();
        } else if (direction === 'right') {
          haptics.medium();
          onRequestDelete();
        }
      }}
      overshootLeft={false}
      overshootRight={false}
      containerStyle={styles.swipeContainer}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: pressed ? theme.colors.surfaceVariant : theme.colors.surface },
        ]}
      >
        <View style={[styles.accent, { backgroundColor: catColor, opacity: 0.5 }]} />
        <View style={styles.body}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]} numberOfLines={1}>
            {item.title || 'Ohne Titel'}
          </Text>
          {item.content ? (
            <Text style={[styles.preview, { color: theme.colors.onSurfaceVariant }]} numberOfLines={2}>
              {item.content}
            </Text>
          ) : null}
          <View style={styles.footer}>
            <Text style={[styles.categoryLabel, { color: catColor }]}>{item.category}</Text>
            <Text style={[styles.dateText, { color: theme.colors.onSurfaceVariant }]}>
              {formatDate(item.updatedAt)}
            </Text>
          </View>
        </View>
      </Pressable>
    </Swipeable>
  );
}

// ---------------------------------------------------------------------------
// Archived Thread Row
// ---------------------------------------------------------------------------

const THREAD_GRADIENTS: Array<readonly [string, string]> = [
  Gradients.primary,
  Gradients.secondary,
  Gradients.tertiary,
  Gradients.lavender,
  Gradients.sky,
  Gradients.emerald,
  Gradients.pink,
];

interface ArchivedThreadRowProps {
  thread: Thread;
  index: number;
  onRestore: () => void;
  onRequestDelete: () => void;
}

function ArchivedThreadRow({ thread, index, onRestore, onRequestDelete }: ArchivedThreadRowProps) {
  const theme = useTheme();
  const swipeableRef = useRef<Swipeable>(null);
  const gradient = THREAD_GRADIENTS[index % THREAD_GRADIENTS.length];

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });

  const renderLeftActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [0.5, 1],
      extrapolate: 'clamp',
    });
    return (
      <View style={[styles.swipeAction, styles.leftAction, { backgroundColor: theme.colors.tertiaryContainer }]}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <MaterialCommunityIcons name="restore" size={24} color={theme.colors.tertiary} />
        </Animated.View>
        <Text style={[styles.swipeLabel, { color: theme.colors.tertiary }]}>Wiederherstellen</Text>
      </View>
    );
  };

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.5],
      extrapolate: 'clamp',
    });
    return (
      <View style={[styles.swipeAction, styles.rightAction, { backgroundColor: theme.colors.errorContainer }]}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <MaterialCommunityIcons name="trash-can-outline" size={24} color={theme.colors.error} />
        </Animated.View>
        <Text style={[styles.swipeLabel, { color: theme.colors.error }]}>Löschen</Text>
      </View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableOpen={(direction) => {
        swipeableRef.current?.close();
        if (direction === 'left') {
          haptics.light();
          onRestore();
        } else if (direction === 'right') {
          haptics.medium();
          onRequestDelete();
        }
      }}
      overshootLeft={false}
      overshootRight={false}
      containerStyle={styles.swipeContainer}
    >
      <Pressable
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: pressed ? theme.colors.surfaceVariant : theme.colors.surface },
        ]}
      >
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[styles.accent, { opacity: 0.5 }]}
        />
        <View style={styles.body}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]} numberOfLines={1}>
            {thread.title}
          </Text>
          {thread.summary ? (
            <Text style={[styles.preview, { color: theme.colors.onSurfaceVariant }]} numberOfLines={2}>
              {thread.summary}
            </Text>
          ) : null}
          <View style={styles.footer}>
            <View style={styles.threadMeta}>
              <MaterialCommunityIcons
                name="thought-bubble-outline"
                size={13}
                color={theme.colors.onSurfaceVariant}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.categoryLabel, { color: theme.colors.onSurfaceVariant }]}>
                {thread.thoughtCount} {thread.thoughtCount === 1 ? 'Gedanke' : 'Gedanken'}
              </Text>
            </View>
            <Text style={[styles.dateText, { color: theme.colors.onSurfaceVariant }]}>
              {formatDate(thread.updatedAt)}
            </Text>
          </View>
        </View>
      </Pressable>
    </Swipeable>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

type ArchiveItem =
  | { type: 'thread'; thread: Thread; index: number }
  | { type: 'note'; note: Note };

type DeleteTarget =
  | { type: 'note'; item: Note }
  | { type: 'thread'; item: Thread };

export default function ArchiveScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { archivedNotes, restoreNote, deleteNotePermanently } = useNotes();
  const { threads, restoreThread, deleteThreadPermanently } = useThoughts();

  const archivedThreads = threads.filter((t) => t.status === 'archived');

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'note') {
      await deleteNotePermanently(deleteTarget.item.id);
    } else {
      deleteThreadPermanently(deleteTarget.item.id);
    }
    setDeleteTarget(null);
  }, [deleteTarget, deleteNotePermanently, deleteThreadPermanently]);

  const totalCount = archivedNotes.length + archivedThreads.length;

  const deleteLabel = deleteTarget?.type === 'thread'
    ? `Thread „${deleteTarget.item.title}" wird unwiderruflich gelöscht.`
    : `„${(deleteTarget?.item as Note)?.title || 'Ohne Titel'}" wird unwiderruflich gelöscht.`;

  // Build a flat list mixing both types to avoid SectionList union issues
  const items: ArchiveItem[] = [
    ...archivedThreads.map((t, i) => ({ type: 'thread' as const, thread: t, index: i })),
    ...archivedNotes.map((n) => ({ type: 'note' as const, note: n })),
  ];

  // Show section headers inline
  const hasThreads = archivedThreads.length > 0;
  const hasNotes = archivedNotes.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
          Archiv
        </Text>
        <Text style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
          {totalCount === 0
            ? 'Leer'
            : `${archivedNotes.length} ${archivedNotes.length === 1 ? 'Notiz' : 'Notizen'}, ${archivedThreads.length} ${archivedThreads.length === 1 ? 'Thread' : 'Threads'}`}
        </Text>
      </View>

      {totalCount === 0 ? (
        <View style={styles.center}>
          <LinearGradient
            colors={Gradients.lavender}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.emptyIconWrap}
          >
            <MaterialCommunityIcons name="archive-outline" size={48} color="#FFFFFF" />
          </LinearGradient>
          <Text
            variant="titleMedium"
            style={[styles.emptyTitle, { color: theme.colors.onSurface }]}
          >
            Archiv ist leer
          </Text>
          <Text
            variant="bodySmall"
            style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}
          >
            Gelöschte Notizen und archivierte Threads landen hier
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => (item.type === 'thread' ? `t-${item.thread.id}` : `n-${item.note.id}`)}
          renderItem={({ item, index }) => {
            // Section headers
            const showThreadHeader = hasThreads && index === 0;
            const showNoteHeader = hasNotes && item.type === 'note' && (index === 0 || items[index - 1]?.type === 'thread');

            return (
              <>
                {showThreadHeader && (
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
                      Threads
                    </Text>
                  </View>
                )}
                {showNoteHeader && (
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
                      Notizen
                    </Text>
                  </View>
                )}
                {item.type === 'thread' ? (
                  <ArchivedThreadRow
                    thread={item.thread}
                    index={item.index}
                    onRestore={() => restoreThread(item.thread.id)}
                    onRequestDelete={() => setDeleteTarget({ type: 'thread', item: item.thread })}
                  />
                ) : (
                  <ArchiveRow
                    item={item.note}
                    onRestore={() => restoreNote(item.note.id)}
                    onRequestDelete={() => setDeleteTarget({ type: 'note', item: item.note })}
                    onPress={() => {}}
                  />
                )}
              </>
            );
          }}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Permanent Delete Confirmation */}
      <Portal>
        <Dialog
          visible={!!deleteTarget}
          onDismiss={() => setDeleteTarget(null)}
          style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={{ color: theme.colors.onSurface }}>
            Endgültig löschen?
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
              {deleteLabel}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteTarget(null)} textColor={theme.colors.onSurfaceVariant}>
              Abbrechen
            </Button>
            <Button
              onPress={handleDelete}
              mode="contained"
              buttonColor={theme.colors.errorContainer}
              textColor={theme.colors.error}
              style={{ borderRadius: 12 }}
            >
              Löschen
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
    opacity: 0.6,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: 22,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 18,
  },
  emptySubtitle: {
    marginTop: 6,
    textAlign: 'center',
    opacity: 0.6,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    opacity: 0.6,
  },
  list: {
    paddingBottom: 100,
    paddingTop: 8,
  },
  swipeContainer: {
    marginHorizontal: 16,
    marginVertical: 5,
    borderRadius: 16,
    overflow: 'hidden',
  },
  card: {
    flexDirection: 'row',
    borderRadius: 16,
    overflow: 'hidden',
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
  },
  leftAction: {
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  rightAction: {
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  swipeLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  accent: {
    width: 4,
  },
  body: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  title: {
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.15,
  },
  preview: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.75,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  threadMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  dateText: {
    fontSize: 11,
    opacity: 0.5,
  },
  dialog: {
    borderRadius: 24,
  },
  dialogActions: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});
