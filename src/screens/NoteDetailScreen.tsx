import React, { useCallback, useState } from 'react';
import { StyleSheet, View, ScrollView, Pressable } from 'react-native';
import { Text, useTheme, IconButton, Chip, Checkbox, Portal, Dialog, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNotes } from '../context/NotesContext';
import { getCategoryAccent } from '../theme/categoryAccents';
import * as haptics from '../utils/haptics';
import { useLanguage } from '../context/LanguageContext';

interface Props {
  navigation: any;
  route: any;
}

export default function NoteDetailScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { t, locale } = useLanguage();
  const { notes, togglePin, updateNote } = useNotes();
  const noteId = route.params?.noteId as string;
  const note = notes.find((n) => n.id === noteId);

  if (!note) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.onSurfaceVariant }}>{t('noteDetail.notFound')}</Text>
      </View>
    );
  }

  const catAccent = getCategoryAccent(note.category);
  const dateLocale = locale === 'en' ? 'en-US' : 'de-DE';

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(dateLocale, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' });

  const getReminderLabel = (): string | null => {
    if (!note.reminderAt) return null;
    const time = formatTime(note.reminderAt);
    switch (note.reminderRecurrence) {
      case 'daily':
        return t('editor.reminderDaily', { time });
      case 'weekly':
        return t('editor.reminderWeekly', { weekday: t('editor.weekdays')[note.reminderWeekday ?? 2], time });
      case 'monthly':
        return t('editor.reminderMonthly', { day: note.reminderDayOfMonth ?? 1, time });
      default:
        return formatDate(note.reminderAt);
    }
  };

  const [showResetDialog, setShowResetDialog] = useState(false);

  const toggleChecklistItem = useCallback((itemId: string) => {
    // updateNote() löst bereits haptics.light() zentral aus — hier kein zusätzliches tap().
    const updated = note.checklist.map((item) =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );
    updateNote(note.id, { checklist: updated });
    if (updated.length > 0 && updated.every((i) => i.checked)) {
      haptics.success();
      setShowResetDialog(true);
    }
  }, [note, updateNote]);

  const resetChecklist = useCallback(() => {
    const reset = note.checklist.map((item) => ({ ...item, checked: false }));
    updateNote(note.id, { checklist: reset });
    setShowResetDialog(false);
  }, [note, updateNote]);

  const reminderLabel = getReminderLabel();
  const checkedCount = note.checklist?.filter((i) => i.checked).length ?? 0;
  const totalCount = note.checklist?.length ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header row: category + pin */}
        <View style={styles.topRow}>
          <Chip
            compact
            style={[styles.categoryChip, { backgroundColor: catAccent.soft }]}
            textStyle={{ color: catAccent.deep, fontSize: 12, fontWeight: '700' }}
          >
            {note.category}
          </Chip>
          <IconButton
            icon={note.isPinned ? 'pin' : 'pin-outline'}
            size={20}
            iconColor={note.isPinned ? theme.colors.tertiary : theme.colors.onSurfaceVariant}
            onPress={() => togglePin(note.id)}
            style={[
              styles.pinBtn,
              note.isPinned && { backgroundColor: theme.colors.tertiaryContainer },
            ]}
          />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          {note.title || t('common.untitled')}
        </Text>

        {/* Date */}
        <Text style={[styles.date, { color: theme.colors.onSurfaceVariant }]}>
          {formatDate(note.updatedAt)}
        </Text>

        {/* Reminder badge */}
        {reminderLabel && (
          <View style={[styles.reminderBadge, { backgroundColor: theme.colors.tertiaryContainer }]}>
            <MaterialCommunityIcons
              name="bell-ring-outline"
              size={14}
              color={theme.colors.tertiary}
            />
            <Text style={[styles.reminderText, { color: theme.colors.tertiary }]}>
              {reminderLabel}
            </Text>
          </View>
        )}

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: theme.colors.outline }]} />

        {/* Content */}
        {note.content ? (
          <Text style={[styles.content, { color: theme.colors.onSurface }]}>
            {note.content}
          </Text>
        ) : null}

        {/* Checklist */}
        {totalCount > 0 && (
          <>
            <View style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
            <View style={styles.checklistHeader}>
              <MaterialCommunityIcons
                name="checkbox-marked-outline"
                size={16}
                color={theme.colors.secondary}
              />
              <Text style={[styles.checklistLabel, { color: theme.colors.secondary }]}>
                {t('noteDetail.checklistTitle', { done: checkedCount, total: totalCount })}
              </Text>
            </View>
            {note.checklist.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => toggleChecklistItem(item.id)}
                style={styles.checklistRow}
              >
                <Checkbox
                  status={item.checked ? 'checked' : 'unchecked'}
                  color={theme.colors.secondary}
                  uncheckedColor={theme.colors.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.checklistText,
                    { color: theme.colors.onSurface },
                    item.checked && { textDecorationLine: 'line-through', opacity: 0.5 },
                  ]}
                >
                  {item.text}
                </Text>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>

      {/* Reset Checklist Dialog */}
      <Portal>
        <Dialog
          visible={showResetDialog}
          onDismiss={() => setShowResetDialog(false)}
          style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={{ color: theme.colors.onSurface }}>{t('editor.allDoneTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
              {t('editor.resetChecklistBody')}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowResetDialog(false)} textColor={theme.colors.onSurfaceVariant}>
              {t('common.keep')}
            </Button>
            <Button onPress={resetChecklist} mode="contained" style={{ borderRadius: 12 }}>
              {t('common.reset')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Edit FAB */}
      <IconButton
        icon="pencil"
        mode="contained"
        containerColor={theme.colors.primary}
        iconColor="#FFFFFF"
        size={24}
        onPress={() => navigation.navigate('Editor', { noteId: note.id })}
        style={styles.editBtn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  categoryChip: {
    borderRadius: 12,
  },
  pinBtn: {
    borderRadius: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  date: {
    fontSize: 13,
    opacity: 0.6,
    marginBottom: 12,
  },
  reminderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 12,
  },
  reminderText: {
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    opacity: 0.4,
    marginVertical: 16,
  },
  content: {
    fontSize: 15,
    lineHeight: 24,
  },
  checklistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  checklistLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  checklistText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  dialog: {
    borderRadius: 24,
  },
  editBtn: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    borderRadius: 16,
    width: 52,
    height: 52,
  },
});
