import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, Pressable, Animated, Easing } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { Note, WEEKDAY_LABELS } from '../models/Note';
import { getCategoryColor, withAlpha } from '../utils/categoryColors';
import { getCategoryGradient, Radii, Shadows } from '../theme/gradients';
import * as haptics from '../utils/haptics';

interface Props {
  note: Note;
  onPress: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  index?: number;
}

export default function NoteCard({ note, onPress, onDelete, onTogglePin, index = 0 }: Props) {
  const theme = useTheme();
  const catColor = getCategoryColor(note.category);
  const catGradient = getCategoryGradient(note.category);
  const swipeableRef = useRef<Swipeable>(null);

  // Spring-press scale
  const pressScale = useRef(new Animated.Value(1)).current;
  // Entrance: subtle fade + lift
  const entry = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entry, {
      toValue: 1,
      duration: 350,
      delay: Math.min(index, 8) * 40,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entry, index]);

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.97,
      useNativeDriver: true,
      friction: 6,
      tension: 220,
    }).start();
  };
  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
      tension: 220,
    }).start();
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  const getReminderLabel = (n: Note): string => {
    if (!n.reminderAt) return '';
    const time = formatTime(n.reminderAt);
    switch (n.reminderRecurrence) {
      case 'daily':
        return `Tägl. ${time}`;
      case 'weekly':
        return `${WEEKDAY_LABELS[n.reminderWeekday ?? 2]?.substring(0, 2)} ${time}`;
      case 'monthly':
        return `${n.reminderDayOfMonth ?? 1}. mtl. ${time}`;
      default:
        return `${formatDate(n.reminderAt)} ${time}`;
    }
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
          { backgroundColor: theme.colors.tertiaryContainer },
        ]}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <MaterialCommunityIcons
            name={note.isPinned ? 'pin-off' : 'pin'}
            size={26}
            color={theme.colors.tertiary}
          />
        </Animated.View>
        <Text style={[styles.swipeLabel, { color: theme.colors.tertiary }]}>
          {note.isPinned ? 'Lösen' : 'Anpinnen'}
        </Text>
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
      <View
        style={[
          styles.swipeAction,
          styles.deleteAction,
          { backgroundColor: theme.colors.errorContainer },
        ]}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <MaterialCommunityIcons
            name="trash-can-outline"
            size={26}
            color={theme.colors.error}
          />
        </Animated.View>
        <Text style={[styles.swipeLabel, { color: theme.colors.error }]}>
          Löschen
        </Text>
      </View>
    );
  };

  const handleSwipeLeft = () => {
    swipeableRef.current?.close();
    haptics.light();
    onTogglePin();
  };

  const handleSwipeRight = () => {
    swipeableRef.current?.close();
    haptics.medium();
    onDelete();
  };

  const handlePress = () => {
    haptics.tap();
    onPress();
  };

  const translateY = entry.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });

  return (
    <Animated.View
      style={{
        opacity: entry,
        transform: [{ translateY }, { scale: pressScale }],
      }}
    >
      <Swipeable
        ref={swipeableRef}
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
        onSwipeableOpen={(direction) => {
          if (direction === 'left') handleSwipeLeft();
          else if (direction === 'right') handleSwipeRight();
        }}
        overshootLeft={false}
        overshootRight={false}
        containerStyle={styles.swipeContainer}
      >
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={[
            styles.cardOuter,
            Shadows.soft,
            note.isPinned && Shadows.glow(catColor),
          ]}
        >
          <LinearGradient
            colors={[withAlpha(catGradient[0], 0.18), withAlpha(catGradient[1], 0.06)] as const}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.card, { backgroundColor: theme.colors.surface }]}
          >
            {/* Vertical gradient accent strip */}
            <LinearGradient
              colors={catGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.accent}
            />

            <View style={styles.body}>
              <View style={styles.header}>
                {note.isPinned && (
                  <MaterialCommunityIcons
                    name="pin"
                    size={14}
                    color={theme.colors.tertiary}
                    style={styles.pinIcon}
                  />
                )}
                <Text
                  variant="titleMedium"
                  style={[styles.title, { color: theme.colors.onSurface }]}
                  numberOfLines={1}
                >
                  {note.title || 'Ohne Titel'}
                </Text>
              </View>

              {note.content ? (
                <Text
                  variant="bodyMedium"
                  style={[styles.preview, { color: theme.colors.onSurfaceVariant }]}
                  numberOfLines={2}
                >
                  {note.content}
                </Text>
              ) : null}

              {note.checklist && note.checklist.length > 0 && (
                <View style={styles.checklistBadgeRow}>
                  <MaterialCommunityIcons
                    name="checkbox-marked-outline"
                    size={13}
                    color={theme.colors.secondary}
                  />
                  <Text style={[styles.checklistBadgeText, { color: theme.colors.secondary }]}>
                    {note.checklist.filter((i) => i.checked).length}/{note.checklist.length}
                  </Text>
                </View>
              )}

              <View style={styles.footer}>
                <View style={styles.categoryRow}>
                  <View
                    style={[
                      styles.categoryChip,
                      { backgroundColor: withAlpha(catColor, 0.15) },
                    ]}
                  >
                    <Text style={[styles.categoryLabel, { color: catColor }]}>
                      {note.category}
                    </Text>
                  </View>
                  {note.feedsThreads && (
                    <MaterialCommunityIcons
                      name="thought-bubble-outline"
                      size={14}
                      color={theme.colors.primary}
                      style={styles.feedsThreadsIcon}
                    />
                  )}
                </View>
                <View style={styles.footerRight}>
                  {note.reminderAt && (
                    <View
                      style={[
                        styles.reminderBadge,
                        { backgroundColor: theme.colors.tertiaryContainer },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="bell-outline"
                        size={11}
                        color={theme.colors.tertiary}
                      />
                      <Text style={[styles.reminderText, { color: theme.colors.tertiary }]}>
                        {getReminderLabel(note)}
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.dateText, { color: theme.colors.onSurfaceVariant }]}>
                    {formatDate(note.updatedAt)}
                  </Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </Pressable>
      </Swipeable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  swipeContainer: {
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: Radii.lg,
    overflow: 'hidden',
  },
  cardOuter: {
    borderRadius: Radii.lg,
  },
  card: {
    flexDirection: 'row',
    borderRadius: Radii.lg,
    overflow: 'hidden',
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 92,
  },
  pinAction: {
    borderTopLeftRadius: Radii.lg,
    borderBottomLeftRadius: Radii.lg,
  },
  deleteAction: {
    borderTopRightRadius: Radii.lg,
    borderBottomRightRadius: Radii.lg,
  },
  swipeLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  accent: {
    width: 5,
  },
  body: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: -0.1,
  },
  pinIcon: {
    marginRight: 4,
  },
  checklistBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  checklistBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  preview: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.78,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryChip: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: Radii.pill,
  },
  feedsThreadsIcon: {
    opacity: 0.7,
  },
  categoryLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reminderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.pill,
  },
  reminderText: {
    fontSize: 10,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 11,
    opacity: 0.55,
    fontWeight: '500',
  },
});
