import React, { useState, useCallback } from 'react';
import { StyleSheet, View, FlatList, Pressable } from 'react-native';
import { Text, useTheme, Portal, Dialog, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotes } from '../context/NotesContext';
import { Note } from '../models/Note';
import { getCategoryColor } from '../utils/categoryColors';

export default function ArchiveScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { archivedNotes, restoreNote, deleteNotePermanently } = useNotes();

  const [actionTarget, setActionTarget] = useState<Note | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);

  const handleRestore = useCallback(async () => {
    if (actionTarget) {
      await restoreNote(actionTarget.id);
      setActionTarget(null);
    }
  }, [actionTarget, restoreNote]);

  const handleDelete = useCallback(async () => {
    if (deleteTarget) {
      await deleteNotePermanently(deleteTarget.id);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteNotePermanently]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });

  const renderItem = ({ item }: { item: Note }) => {
    const catColor = getCategoryColor(item.category);
    return (
      <Pressable
        onPress={() => setActionTarget(item)}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: pressed ? theme.colors.surfaceVariant : theme.colors.surface },
        ]}
      >
        <View style={[styles.accent, { backgroundColor: catColor, opacity: 0.5 }]} />
        <View style={styles.body}>
          <Text
            style={[styles.title, { color: theme.colors.onSurface }]}
            numberOfLines={1}
          >
            {item.title || 'Ohne Titel'}
          </Text>
          {item.content ? (
            <Text
              style={[styles.preview, { color: theme.colors.onSurfaceVariant }]}
              numberOfLines={2}
            >
              {item.content}
            </Text>
          ) : null}
          <View style={styles.footer}>
            <Text style={[styles.categoryLabel, { color: catColor }]}>
              {item.category}
            </Text>
            <Text style={[styles.dateText, { color: theme.colors.onSurfaceVariant }]}>
              {formatDate(item.updatedAt)}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

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

      {/* Restore / Delete Dialog */}
      <Portal>
        <Dialog
          visible={!!actionTarget}
          onDismiss={() => setActionTarget(null)}
          style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={{ color: theme.colors.onSurface }}>
            {actionTarget?.title || 'Ohne Titel'}
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
              Was möchtest du mit dieser Notiz tun?
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button
              onPress={() => {
                const note = actionTarget;
                setActionTarget(null);
                if (note) setDeleteTarget(note);
              }}
              textColor={theme.colors.error}
              icon="trash-can-outline"
            >
              Endgültig löschen
            </Button>
            <Button
              onPress={handleRestore}
              mode="contained"
              icon="restore"
              style={{ borderRadius: 12 }}
            >
              Wiederherstellen
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

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
  card: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 5,
    borderRadius: 16,
    overflow: 'hidden',
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
