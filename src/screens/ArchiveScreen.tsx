import React, { useState, useCallback, useRef } from 'react';
import { StyleSheet, View, FlatList, Pressable, Animated } from 'react-native';
import { Text, useTheme, Portal, Dialog, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotes } from '../context/NotesContext';
import { Note } from '../models/Note';
import { getCategoryColor } from '../utils/categoryColors';

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
        if (direction === 'left') onRestore();
        else if (direction === 'right') onRequestDelete();
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

export default function ArchiveScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { archivedNotes, restoreNote, deleteNotePermanently } = useNotes();

  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);

  const handleDelete = useCallback(async () => {
    if (deleteTarget) {
      await deleteNotePermanently(deleteTarget.id);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteNotePermanently]);

  const renderItem = ({ item }: { item: Note }) => (
    <ArchiveRow
      item={item}
      onRestore={() => restoreNote(item.id)}
      onRequestDelete={() => setDeleteTarget(item)}
      onPress={() => {}}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
          Archiv
        </Text>
        <Text style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
          {archivedNotes.length} {archivedNotes.length === 1 ? 'Notiz' : 'Notizen'}
        </Text>
      </View>

      {archivedNotes.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons
            name="archive-outline"
            size={56}
            color={theme.colors.outline}
          />
          <Text
            variant="titleMedium"
            style={[styles.emptyTitle, { color: theme.colors.onSurfaceVariant }]}
          >
            Archiv ist leer
          </Text>
          <Text
            variant="bodySmall"
            style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}
          >
            Gelöschte Notizen landen hier
          </Text>
        </View>
      ) : (
        <FlatList
          data={archivedNotes}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
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
              „{deleteTarget?.title || 'Ohne Titel'}" wird unwiderruflich gelöscht.
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
  emptyTitle: {
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 4,
    textAlign: 'center',
    opacity: 0.5,
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
