import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Text, useTheme, IconButton } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
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

  return (
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
          <IconButton
            icon={note.isPinned ? 'pin-off' : 'pin-outline'}
            size={16}
            iconColor={note.isPinned ? theme.colors.tertiary : theme.colors.onSurfaceVariant}
            onPress={onTogglePin}
            style={styles.deleteBtn}
          />
          <IconButton
            icon="trash-can-outline"
            size={16}
            iconColor={theme.colors.onSurfaceVariant}
            onPress={onDelete}
            style={styles.deleteBtn}
          />
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
  );
}

const styles = StyleSheet.create({
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
  deleteBtn: {
    margin: -8,
    opacity: 0.4,
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
