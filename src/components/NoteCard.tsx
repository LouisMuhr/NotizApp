import React, { useRef } from 'react';
import { StyleSheet, View, Pressable, Animated } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Swipeable } from 'react-native-gesture-handler';
import { Note, WEEKDAY_LABELS } from '../models/Note';
import { getCategoryColor } from '../utils/categoryColors';

interface Props {
  note: Note;
  onPress: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}

export default function NoteCard({ note, onPress, onDelete, onTogglePin }: Props) {
  const theme = useTheme();
  const catColor = getCategoryColor(note.category);
  const swipeableRef = useRef<Swipeable>(null);

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

  const renderLeftActions = (_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const scale = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [0.5, 1],
      extrapolate: 'clamp',
    });
    return (
      <View style={[styles.swipeAction, styles.pinAction, { backgroundColor: theme.colors.tertiaryContainer }]}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <MaterialCommunityIcons
            name={note.isPinned ? 'pin-off' : 'pin'}
            size={24}
            color={theme.colors.tertiary}
          />
        </Animated.View>
        <Text style={[styles.swipeLabel, { color: theme.colors.tertiary }]}>
          {note.isPinned ? 'Lösen' : 'Anpinnen'}
        </Text>
      </View>
    );
  };

  const renderRightActions = (_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.5],
      extrapolate: 'clamp',
    });
    return (
      <View style={[styles.swipeAction, styles.deleteAction, { backgroundColor: theme.colors.errorContainer }]}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <MaterialCommunityIcons
            name="trash-can-outline"
            size={24}
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
    onTogglePin();
  };

  const handleSwipeRight = () => {
    swipeableRef.current?.close();
    onDelete();
  };

  return (
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
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: pressed ? theme.colors.surfaceVariant : theme.colors.surface },
        ]}
      >
        <View style={[styles.accent, { backgroundColor: catColor }]} />

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
            <Text style={[styles.categoryLabel, { color: catColor }]}>
              {note.category}
            </Text>
            <View style={styles.footerRight}>
              {note.reminderAt && (
                <View style={[styles.reminderBadge, { backgroundColor: theme.colors.tertiaryContainer }]}>
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
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
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
    width: 90,
  },
  pinAction: {
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  deleteAction: {
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  swipeLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  accent: {
    width: 4,
  },
  body: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.15,
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
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reminderBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  reminderText: {
    fontSize: 10,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 11,
    opacity: 0.5,
  },
});
