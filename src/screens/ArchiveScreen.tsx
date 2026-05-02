import React, { useState, useCallback, useRef } from 'react';
import { StyleSheet, View, FlatList, Pressable, Animated } from 'react-native';
import { Text, useTheme, Portal, Dialog, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotes } from '../context/NotesContext';
import { useThoughts } from '../context/ThoughtsContext';
import { Note } from '../models/Note';
import { Thread } from '../models/Thought';
import { getCategoryAccent } from '../theme/categoryAccents';
import { Radii, Shadows, Insets } from '../theme/gradients';
import { Tokens } from '../theme/theme';
import { Type, Fonts } from '../theme/typography';
import * as haptics from '../utils/haptics';

// ---------------------------------------------------------------------------
// Archived Note Row
// ---------------------------------------------------------------------------

interface ArchiveRowProps {
  item: Note;
  onRestore: () => void;
  onRequestDelete: () => void;
  onPress: () => void;
}

function ArchiveRow({ item, onRestore, onRequestDelete, onPress }: ArchiveRowProps) {
  const theme = useTheme();
  const accent = getCategoryAccent(item.category);
  const swipeableRef = useRef<Swipeable>(null);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });

  const renderLeftActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({ inputRange: [0, 80], outputRange: [0.5, 1], extrapolate: 'clamp' });
    return (
      <View style={[styles.swipeAction, styles.leftAction, { backgroundColor: Tokens.amberSoft }]}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <MaterialCommunityIcons name="restore" size={24} color={Tokens.amberDeep} />
        </Animated.View>
        <Text style={[styles.swipeLabel, { color: Tokens.amberDeep }]}>Wiederherstellen</Text>
      </View>
    );
  };

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({ inputRange: [-80, 0], outputRange: [1, 0.5], extrapolate: 'clamp' });
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
        if (direction === 'left') { haptics.light(); onRestore(); }
        else if (direction === 'right') { haptics.medium(); onRequestDelete(); }
      }}
      overshootLeft={false}
      overshootRight={false}
      containerStyle={styles.swipeContainer}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          Insets.cardBorder,
          { backgroundColor: pressed ? Tokens.paperEdge : Tokens.paperDeep },
        ]}
      >
        <View style={[styles.accentStrip, { backgroundColor: accent.soft }]} />
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title || 'Ohne Titel'}
          </Text>
          {item.content ? (
            <Text style={styles.preview} numberOfLines={2}>
              {item.content}
            </Text>
          ) : null}
          <View style={styles.footer}>
            <View style={[styles.categoryChip, { backgroundColor: accent.soft }]}>
              <Text style={[styles.categoryLabel, { color: accent.deep }]}>{item.category}</Text>
            </View>
            <Text style={styles.dateText}>{formatDate(item.updatedAt)}</Text>
          </View>
        </View>
      </Pressable>
    </Swipeable>
  );
}

// ---------------------------------------------------------------------------
// Archived Thread Row
// ---------------------------------------------------------------------------

interface ArchivedThreadRowProps {
  thread: Thread;
  index: number;
  onRestore: () => void;
  onRequestDelete: () => void;
}

function ArchivedThreadRow({ thread, onRestore, onRequestDelete }: ArchivedThreadRowProps) {
  const theme = useTheme();
  const swipeableRef = useRef<Swipeable>(null);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });

  const renderLeftActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({ inputRange: [0, 80], outputRange: [0.5, 1], extrapolate: 'clamp' });
    return (
      <View style={[styles.swipeAction, styles.leftAction, { backgroundColor: Tokens.amberSoft }]}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <MaterialCommunityIcons name="restore" size={24} color={Tokens.amberDeep} />
        </Animated.View>
        <Text style={[styles.swipeLabel, { color: Tokens.amberDeep }]}>Wiederherstellen</Text>
      </View>
    );
  };

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({ inputRange: [-80, 0], outputRange: [1, 0.5], extrapolate: 'clamp' });
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
        if (direction === 'left') { haptics.light(); onRestore(); }
        else if (direction === 'right') { haptics.medium(); onRequestDelete(); }
      }}
      overshootLeft={false}
      overshootRight={false}
      containerStyle={styles.swipeContainer}
    >
      <Pressable
        style={({ pressed }) => [
          styles.card,
          Insets.cardBorder,
          { backgroundColor: pressed ? Tokens.paperEdge : Tokens.paperDeep },
        ]}
      >
        <View style={[styles.accentStrip, { backgroundColor: Tokens.amberSoft }]} />
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {thread.title}
          </Text>
          {thread.summary ? (
            <Text style={styles.preview} numberOfLines={2}>
              {thread.summary}
            </Text>
          ) : null}
          <View style={styles.footer}>
            <View style={styles.threadMeta}>
              <MaterialCommunityIcons name="creation" size={13} color={Tokens.amber} style={{ marginRight: 4 }} />
              <Text style={styles.categoryLabel2}>
                {thread.noteCount} {thread.noteCount === 1 ? 'Notiz' : 'Notizen'}
              </Text>
            </View>
            <Text style={styles.dateText}>{formatDate(thread.updatedAt)}</Text>
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

  const items: ArchiveItem[] = [
    ...archivedThreads.map((t, i) => ({ type: 'thread' as const, thread: t, index: i })),
    ...archivedNotes.map((n) => ({ type: 'note' as const, note: n })),
  ];

  const hasThreads = archivedThreads.length > 0;
  const hasNotes = archivedNotes.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerEyebrow}>
          {totalCount === 0 ? 'Leer' : `${totalCount} Elemente`}
        </Text>
        <Text style={styles.headerTitle}>Archiv</Text>
      </View>

      {totalCount === 0 ? (
        <View style={styles.center}>
          <View style={[styles.emptyIconWrap, { backgroundColor: Tokens.amberSoft }]}>
            <MaterialCommunityIcons name="archive-outline" size={48} color={Tokens.amberDeep} />
          </View>
          <Text variant="titleMedium" style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
            Archiv ist leer
          </Text>
          <Text variant="bodySmall" style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}>
            Gelöschte Notizen und archivierte Threads landen hier
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => (item.type === 'thread' ? `t-${item.thread.id}` : `n-${item.note.id}`)}
          renderItem={({ item, index }) => {
            const showThreadHeader = hasThreads && index === 0;
            const showNoteHeader = hasNotes && item.type === 'note' && (index === 0 || items[index - 1]?.type === 'thread');

            return (
              <>
                {showThreadHeader && (
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Threads</Text>
                  </View>
                )}
                {showNoteHeader && (
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Notizen</Text>
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

      <Portal>
        <Dialog
          visible={!!deleteTarget}
          onDismiss={() => setDeleteTarget(null)}
          style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={{ color: theme.colors.onSurface }}>Endgültig löschen?</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>{deleteLabel}</Text>
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
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerEyebrow: {
    fontFamily: Fonts.sansSemibold,
    fontSize: 10.5,
    letterSpacing: 0.84,
    textTransform: 'uppercase',
    color: Tokens.inkFaint,
    marginBottom: 2,
  },
  headerTitle: {
    ...Type.h1,
    color: Tokens.ink,
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
    fontFamily: Fonts.serif,
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
    fontFamily: Fonts.sansSemibold,
    fontSize: 10.5,
    letterSpacing: 0.84,
    textTransform: 'uppercase',
    color: Tokens.inkFaint,
  },
  list: {
    paddingBottom: 100,
    paddingTop: 8,
  },
  swipeContainer: {
    marginHorizontal: 16,
    marginVertical: 5,
    borderRadius: Radii.lg,
    overflow: 'hidden',
  },
  card: {
    flexDirection: 'row',
    borderRadius: Radii.lg,
    overflow: 'hidden',
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
  },
  leftAction: {
    borderTopLeftRadius: Radii.lg,
    borderBottomLeftRadius: Radii.lg,
  },
  rightAction: {
    borderTopRightRadius: Radii.lg,
    borderBottomRightRadius: Radii.lg,
  },
  swipeLabel: {
    fontFamily: Fonts.sansSemibold,
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  accentStrip: {
    width: 4,
  },
  body: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 4,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 16,
    color: Tokens.ink,
  },
  preview: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: Tokens.inkDim,
    opacity: 0.85,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  categoryChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  categoryLabel: {
    fontFamily: Fonts.sansSemibold,
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  categoryLabel2: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: Tokens.inkDim,
  },
  threadMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Tokens.inkFaint,
  },
  dialog: { borderRadius: 24 },
});
