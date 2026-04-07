import React, { useState, useMemo, useRef, useEffect } from 'react';
import { StyleSheet, View, FlatList, Pressable, Animated, Easing } from 'react-native';
import { Text, useTheme, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotes } from '../context/NotesContext';
import { FilterOptions } from '../models/Note';
import NoteCard from '../components/NoteCard';
import FilterBar from '../components/FilterBar';
import { Gradients, Radii, Shadows } from '../theme/gradients';
import * as haptics from '../utils/haptics';

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

  const filteredNotes = useMemo(() => {
    // Dedupe by id defensively to avoid duplicate React keys
    const seen = new Set<string>();
    let result = notes.filter((n) => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });

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

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // FAB pulse animation (subtle "alive" feel)
  const fabPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(fabPulse, {
          toValue: 1.06,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(fabPulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [fabPulse]);

  const fabScale = useRef(new Animated.Value(1)).current;
  const fabPressIn = () => {
    Animated.spring(fabScale, {
      toValue: 0.9,
      friction: 5,
      tension: 220,
      useNativeDriver: true,
    }).start();
  };
  const fabPressOut = () => {
    Animated.spring(fabScale, {
      toValue: 1,
      friction: 4,
      tension: 220,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      {/* Custom header with subtle gradient halo */}
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
          <LinearGradient
            colors={Gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.emptyIconWrap}
          >
            <MaterialCommunityIcons
              name={notes.length === 0 ? 'notebook-plus-outline' : 'file-search-outline'}
              size={48}
              color="#FFFFFF"
            />
          </LinearGradient>
          <Text
            variant="titleMedium"
            style={[styles.emptyTitle, { color: theme.colors.onSurface }]}
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
          renderItem={({ item, index }) => (
            <NoteCard
              note={item}
              index={index}
              onPress={() => navigation.navigate('NoteDetail', { noteId: item.id })}
              onDelete={() => deleteNote(item.id)}
              onTogglePin={() => togglePin(item.id)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Animated.View
        style={[
          styles.fabWrap,
          Shadows.glow(Gradients.primary[0]),
          { transform: [{ scale: fabPulse }] },
        ]}
      >
        <Animated.View style={{ transform: [{ scale: fabScale }] }}>
          <Pressable
            onPress={() => {
              haptics.light();
              navigation.navigate('Editor', {});
            }}
            onPressIn={fabPressIn}
            onPressOut={fabPressOut}
            style={styles.fabPressable}
          >
            <LinearGradient
              colors={Gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fabGradient}
            >
              <MaterialCommunityIcons name="plus" size={30} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </Animated.View>

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
  list: {
    paddingBottom: 160,
    paddingTop: 4,
  },
  fabWrap: {
    position: 'absolute',
    right: 20,
    bottom: 90,
    borderRadius: 22,
  },
  fabPressable: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  fabGradient: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialog: {
    borderRadius: 24,
  },
});
