import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, Pressable, Animated, Easing, Text as RNText } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { Note, WEEKDAY_LABELS } from '../models/Note';
import { getCategoryAccent } from '../theme/categoryAccents';
import { Radii, Shadows, Insets } from '../theme/gradients';
import { Tokens } from '../theme/theme';
import { Fonts, Type } from '../theme/typography';
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
  const accent = getCategoryAccent(note.category);
  const swipeableRef = useRef<Swipeable>(null);

  const pressScale = useRef(new Animated.Value(1)).current;
  const entry = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entry, {
      toValue: 1,
      duration: 320,
      delay: Math.min(index, 8) * 35,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entry, index]);

  const handlePressIn = () => {
    Animated.spring(pressScale, { toValue: 0.985, useNativeDriver: true, friction: 6, tension: 220 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 220 }).start();
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  const getReminderLabel = (n: Note): string => {
    if (!n.reminderAt) return '';
    const time = formatTime(n.reminderAt);
    switch (n.reminderRecurrence) {
      case 'daily': return `Tägl. ${time}`;
      case 'weekly': return `${WEEKDAY_LABELS[n.reminderWeekday ?? 2]?.substring(0, 2)} ${time}`;
      case 'monthly': return `${n.reminderDayOfMonth ?? 1}. mtl. ${time}`;
      default: return `${formatDate(n.reminderAt)} ${time}`;
    }
  };

  const renderLeftActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({ inputRange: [0, 80], outputRange: [0.5, 1], extrapolate: 'clamp' });
    return (
      <View style={[styles.swipeAction, styles.pinAction]}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <MaterialCommunityIcons name={note.isPinned ? 'pin-off' : 'pin'} size={22} color={Tokens.amberDeep} />
        </Animated.View>
        <RNText style={[styles.swipeLabel, { color: Tokens.amberDeep }]}>
          {note.isPinned ? 'Lösen' : 'Anpinnen'}
        </RNText>
      </View>
    );
  };

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({ inputRange: [-80, 0], outputRange: [1, 0.5], extrapolate: 'clamp' });
    return (
      <View style={[styles.swipeAction, styles.deleteAction]}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <MaterialCommunityIcons name="trash-can-outline" size={22} color={theme.colors.error} />
        </Animated.View>
        <RNText style={[styles.swipeLabel, { color: theme.colors.error }]}>Löschen</RNText>
      </View>
    );
  };

  const handleSwipeLeft = () => { swipeableRef.current?.close(); haptics.light(); onTogglePin(); };
  const handleSwipeRight = () => { swipeableRef.current?.close(); haptics.medium(); onDelete(); };
  const handlePress = () => { haptics.tap(); onPress(); };

  const translateY = entry.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const checklistDone = note.checklist?.filter((i) => i.checked).length ?? 0;
  const checklistTotal = note.checklist?.length ?? 0;

  return (
    <Animated.View style={{ opacity: entry, transform: [{ translateY }, { scale: pressScale }] }}>
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
          style={[styles.card, Insets.cardBorder, Shadows.softWarm]}
        >
          {/* Header */}
          <View style={styles.header}>
            {note.isPinned && (
              <MaterialCommunityIcons name="pin" size={13} color={Tokens.amberDeep} style={styles.pinIcon} />
            )}
            <RNText style={styles.title} numberOfLines={1}>
              {note.title || 'Ohne Titel'}
            </RNText>
            <RNText style={styles.dateText}>{formatDate(note.updatedAt)}</RNText>
          </View>

          {/* Body preview */}
          {note.content ? (
            <RNText style={styles.preview} numberOfLines={2}>
              {note.content}
            </RNText>
          ) : null}

          {/* Checklist progress */}
          {checklistTotal > 0 && (
            <View style={styles.checklistRow}>
              <View style={[
                styles.checklistDot,
                { backgroundColor: checklistDone === checklistTotal ? Tokens.amber : 'transparent', borderColor: Tokens.amber },
              ]} />
              <RNText style={styles.checklistText}>
                {checklistDone}/{checklistTotal} erledigt
              </RNText>
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.footerLeft}>
              <View style={[styles.categoryChip, { backgroundColor: accent.soft }]}>
                <RNText style={[styles.categoryLabel, { color: accent.deep }]}>
                  {note.category}
                </RNText>
              </View>
              {note.feedsThreads && (
                <MaterialCommunityIcons
                  name="creation"
                  size={13}
                  color={Tokens.amberDeep}
                  style={styles.feedsThreadsIcon}
                />
              )}
            </View>
            {note.reminderAt && (
              <View style={styles.reminderBadge}>
                <MaterialCommunityIcons name="bell-outline" size={11} color={Tokens.amberDeep} />
                <RNText style={styles.reminderText}>{getReminderLabel(note)}</RNText>
              </View>
            )}
          </View>
        </Pressable>
      </Swipeable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  swipeContainer: {
    marginHorizontal: 16,
    marginVertical: 5,
    borderRadius: Radii.lg,
  },
  card: {
    backgroundColor: Tokens.paperDeep,
    borderRadius: Radii.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
    backgroundColor: Tokens.amberSoft,
  },
  pinAction: {
    borderTopLeftRadius: Radii.lg,
    borderBottomLeftRadius: Radii.lg,
  },
  deleteAction: {
    backgroundColor: '#F4DAD3',
    borderTopRightRadius: Radii.lg,
    borderBottomRightRadius: Radii.lg,
  },
  swipeLabel: {
    fontFamily: Fonts.sansSemibold,
    fontSize: 11,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 4,
  },
  pinIcon: { transform: [{ translateY: 2 }] },
  title: {
    ...Type.noteTitle,
    flex: 1,
    color: Tokens.ink,
  },
  dateText: {
    ...Type.eyebrow,
    fontSize: 10.5,
    color: Tokens.inkFaint,
  },
  preview: {
    ...Type.bodySm,
    color: Tokens.inkDim,
    marginTop: 2,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  checklistDot: {
    width: 11,
    height: 11,
    borderRadius: 3,
    borderWidth: 1.4,
  },
  checklistText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    color: Tokens.inkDim,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.pill,
  },
  categoryLabel: {
    fontFamily: Fonts.sansSemibold,
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  feedsThreadsIcon: { opacity: 0.8 },
  reminderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.pill,
    backgroundColor: Tokens.amberSoft,
  },
  reminderText: {
    fontFamily: Fonts.sansSemibold,
    fontSize: 10,
    color: Tokens.amberDeep,
    letterSpacing: 0.2,
  },
});
