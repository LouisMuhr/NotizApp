import React, { useRef } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Pressable,
  Animated,
} from 'react-native';
import { Text, useTheme, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThoughts } from '../context/ThoughtsContext';
import { Thread } from '../models/Thought';
import GradientCard from '../components/GradientCard';
import { Gradients, Radii, Shadows } from '../theme/gradients';
import * as haptics from '../utils/haptics';

interface Props {
  navigation: any;
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

// Deterministic gradient per thread (cycles through the palette)
const THREAD_GRADIENTS: Array<readonly [string, string]> = [
  Gradients.primary,
  Gradients.secondary,
  Gradients.tertiary,
  Gradients.lavender,
  Gradients.sky,
  Gradients.emerald,
  Gradients.pink,
];

function getThreadGradient(index: number): readonly [string, string] {
  return THREAD_GRADIENTS[index % THREAD_GRADIENTS.length];
}

interface ThreadCardProps {
  thread: Thread;
  index: number;
  newCount: number;
  onPress: () => void;
  onArchive: () => void;
  onPin: () => void;
  onUnpin: () => void;
}

function ThreadCard({ thread, index, newCount, onPress, onArchive, onPin, onUnpin }: ThreadCardProps) {
  const theme = useTheme();
  const gradient = getThreadGradient(index);
  const swipeableRef = useRef<Swipeable>(null);

  const lastUpdated = formatRelativeTime(thread.updatedAt);

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
      <View
        style={[
          styles.swipeAction,
          styles.archiveAction,
          { backgroundColor: theme.colors.tertiaryContainer },
        ]}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <MaterialCommunityIcons
            name="archive-outline"
            size={26}
            color={theme.colors.tertiary}
          />
        </Animated.View>
        <Text style={[styles.swipeLabel, { color: theme.colors.tertiary }]}>
          Archivieren
        </Text>
      </View>
    );
  };

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
      <View
        style={[
          styles.swipeAction,
          styles.pinAction,
          { backgroundColor: theme.colors.secondaryContainer },
        ]}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <MaterialCommunityIcons
            name={thread.isPinned ? 'pin-off-outline' : 'pin-outline'}
            size={26}
            color={theme.colors.secondary}
          />
        </Animated.View>
        <Text style={[styles.swipeLabel, { color: theme.colors.secondary }]}>
          {thread.isPinned ? 'Lösen' : 'Fixieren'}
        </Text>
      </View>
    );
  };

  const handleSwipeRight = () => {
    swipeableRef.current?.close();
    haptics.medium();
    onArchive();
  };

  const handleSwipeLeft = () => {
    swipeableRef.current?.close();
    haptics.medium();
    if (thread.isPinned) {
      onUnpin();
    } else {
      onPin();
    }
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      onSwipeableOpen={(direction) => {
        if (direction === 'right') handleSwipeRight();
        if (direction === 'left') handleSwipeLeft();
      }}
      overshootRight={false}
      overshootLeft={false}
      containerStyle={styles.swipeContainer}
    >
      <Pressable
        onPress={() => {
          haptics.light();
          onPress();
        }}
        style={({ pressed }) => [styles.cardPressable, pressed && styles.cardPressed]}
      >
        <GradientCard
          colors={['#1E2130', '#181B26'] as unknown as readonly [string, string]}
          style={styles.card}
          glow={false}
        >
          {/* Accent bar on the left */}
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.accentBar}
          />

          <View style={styles.cardContent}>
            {/* Header row */}
            <View style={styles.cardHeader}>
              {thread.isPinned && (
                <MaterialCommunityIcons
                  name="pin"
                  size={14}
                  color={theme.colors.secondary}
                  style={styles.pinIcon}
                />
              )}
              <Text
                style={[styles.threadTitle, { color: theme.colors.onSurface }]}
                numberOfLines={1}
              >
                {thread.title}
              </Text>
              {newCount > 0 && (
                <View style={[styles.badge, { backgroundColor: gradient[0] }]}>
                  <Text style={styles.badgeText}>{newCount} neu</Text>
                </View>
              )}
            </View>

            {/* Summary preview */}
            {thread.summary ? (
              <Text
                style={[styles.summary, { color: theme.colors.onSurfaceVariant }]}
                numberOfLines={2}
              >
                {thread.summary}
              </Text>
            ) : (
              <Text
                style={[styles.summaryEmpty, { color: theme.colors.onSurfaceVariant }]}
              >
                Noch keine Zusammenfassung — Worker läuft bald.
              </Text>
            )}

            {/* Footer row */}
            <View style={styles.cardFooter}>
              <MaterialCommunityIcons
                name="thought-bubble-outline"
                size={13}
                color={theme.colors.onSurfaceVariant}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
                {thread.thoughtCount} {thread.thoughtCount === 1 ? 'Gedanke' : 'Gedanken'}
              </Text>
              <Text style={[styles.metaDot, { color: theme.colors.onSurfaceVariant }]}>·</Text>
              <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
                {lastUpdated}
              </Text>
            </View>
          </View>
        </GradientCard>
      </Pressable>
    </Swipeable>
  );
}

export default function ThreadsScreen({ navigation }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { threads, links, loading, archiveThread, pinThread, unpinThread } = useThoughts();

  const activeThreads = threads
    .filter((t) => t.status === 'active')
    .sort((a, b) => {
      // Pinned threads first, then by updatedAt descending
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  // Calculate how many thoughts are "new" (unprocessed) per thread
  const newCountByThread = React.useMemo(() => {
    const counts: Record<string, number> = {};
    // A thought is "new" in a thread when it has no processedAt.
    // We don't have that info directly here without joining — so for now
    // we show the raw thoughtCount as a simpler proxy.
    return counts;
  }, [links]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.background, paddingTop: insets.top },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
          Threads
        </Text>
        <Text style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
          {activeThreads.length === 0
            ? 'Noch keine Threads'
            : `${activeThreads.length} ${activeThreads.length === 1 ? 'Thread' : 'Threads'}`}
        </Text>
      </View>

      {activeThreads.length === 0 ? (
        <View style={styles.center}>
          <LinearGradient
            colors={Gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.emptyIconWrap}
          >
            <MaterialCommunityIcons
              name="thought-bubble-outline"
              size={48}
              color="#FFFFFF"
            />
          </LinearGradient>
          <Text
            variant="titleMedium"
            style={[styles.emptyTitle, { color: theme.colors.onSurface }]}
          >
            Noch keine Threads
          </Text>
          <Text
            variant="bodySmall"
            style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}
          >
            Erfasse Gedanken über das Mikrofon-Symbol.{'\n'}
            Der Worker verbindet sie zu Threads.
          </Text>
        </View>
      ) : (
        <FlatList
          data={activeThreads}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <ThreadCard
              thread={item}
              index={index}
              newCount={newCountByThread[item.id] ?? 0}
              onPress={() => navigation.navigate('ThreadDetail', { threadId: item.id, title: item.title })}
              onArchive={() => archiveThread(item.id)}
              onPin={() => pinThread(item.id)}
              onUnpin={() => unpinThread(item.id)}
            />
          )}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
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
    lineHeight: 20,
  },
  list: {
    paddingTop: 12,
  },
  separator: {
    height: 10,
  },
  swipeContainer: {
    marginHorizontal: 16,
    borderRadius: 18,
    overflow: 'hidden',
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 92,
  },
  archiveAction: {
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
  },
  pinAction: {
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  swipeLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  cardPressable: {
    borderRadius: 18,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  card: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 18,
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pinIcon: {
    marginRight: -2,
  },
  threadTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  summary: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.8,
  },
  summaryEmpty: {
    fontSize: 12,
    fontStyle: 'italic',
    opacity: 0.4,
  },
  cardFooter: {
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
});
