import React, { useState, useMemo, useCallback } from 'react';
import { StyleSheet, View, FlatList } from 'react-native';
import { FAB, Text, useTheme, ActivityIndicator, Portal, Dialog, Button } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotes } from '../context/NotesContext';
import { FilterOptions, Note } from '../models/Note';
import NoteCard from '../components/NoteCard';
import FilterBar from '../components/FilterBar';

interface Props {
  navigation: any;
}

export default function HomeScreen({ navigation }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { notes, categories, loading, deleteNote, togglePin } = useNotes();

  const [filters, setFilters] = useState<FilterOptions>({
    category: null,
    searchQuery: '',
    sortField: 'updatedAt',
    sortOrder: 'desc',
  });

  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);

  const filteredNotes = useMemo(() => {
    let result = [...notes];

    if (filters.category) {
      result = result.filter((n) => n.category === filters.category);
    }
    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      // Pinned notes always come first
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      let valA: string, valB: string;
      switch (filters.sortField) {
        case 'title':
          valA = a.title.toLowerCase();
          valB = b.title.toLowerCase();
          break;
        case 'category':
          valA = a.category.toLowerCase();
          valB = b.category.toLowerCase();
          break;
        case 'createdAt':
          valA = a.createdAt;
          valB = b.createdAt;
          break;
        default:
          valA = a.updatedAt;
          valB = b.updatedAt;
      }
      const cmp = valA.localeCompare(valB);
      return filters.sortOrder === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [notes, filters]);

  const handleDelete = useCallback(async () => {
    if (deleteTarget) {
      await deleteNote(deleteTarget.id);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteNote]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      {/* Custom header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
          Notizen
        </Text>
        <Text style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
          {notes.length} {notes.length === 1 ? 'Notiz' : 'Notizen'}
        </Text>
      </View>

      <FilterBar
        filters={filters}
        categories={categories}
        onFiltersChange={setFilters}
      />

      {filteredNotes.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons
            name={notes.length === 0 ? 'note-plus-outline' : 'file-search-outline'}
            size={56}
            color={theme.colors.outline}
          />
          <Text
            variant="titleMedium"
            style={[styles.emptyTitle, { color: theme.colors.onSurfaceVariant }]}
          >
            {notes.length === 0 ? 'Noch keine Notizen' : 'Keine Treffer'}
          </Text>
          <Text
            variant="bodySmall"
            style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}
          >
            {notes.length === 0 ? 'Tippe auf + um loszulegen' : 'Passe deine Filter an'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredNotes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NoteCard
              note={item}
              onPress={() => navigation.navigate('NoteDetail', { noteId: item.id })}
              onDelete={() => setDeleteTarget(item)}
              onTogglePin={() => togglePin(item.id)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color="#FFFFFF"
        onPress={() => navigation.navigate('Editor', {})}
      />

      <Portal>
        <Dialog
          visible={!!deleteTarget}
          onDismiss={() => setDeleteTarget(null)}
          style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={{ color: theme.colors.onSurface }}>
            Notiz löschen?
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
              textColor={theme.colors.error}
              mode="contained"
              buttonColor={theme.colors.errorContainer}
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
    paddingBottom: 160,
    paddingTop: 4,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 90,
    borderRadius: 18,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialog: {
    borderRadius: 24,
  },
});
