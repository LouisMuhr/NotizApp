import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  TextInput,
  Button,
  Chip,
  useTheme,
  Text,
  Menu,
  IconButton,
  Divider,
  Portal,
  Dialog,
  SegmentedButtons,
} from 'react-native-paper';

import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNotes } from '../context/NotesContext';
import {
  ChecklistItem,
  ReminderRecurrence,
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
} from '../models/Note';

interface Props {
  navigation: any;
  route: any;
}

const RECURRENCE_OPTIONS: { value: ReminderRecurrence; label: string }[] = [
  { value: 'once', label: 'Einmalig' },
  { value: 'daily', label: 'Täglich' },
  { value: 'weekly', label: 'Wöchentl.' },
  { value: 'monthly', label: 'Monatl.' },
];

export default function EditorScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { notes, categories, addNote, updateNote, addCategory } = useNotes();
  const noteId = route.params?.noteId as string | undefined;
  const existingNote = noteId ? notes.find((n) => n.id === noteId) : undefined;

  const [title, setTitle] = useState(existingNote?.title ?? '');
  const [content, setContent] = useState(existingNote?.content ?? '');
  const [category, setCategory] = useState(existingNote?.category ?? categories[0] ?? 'Allgemein');
  const [isPinned, setIsPinned] = useState(existingNote?.isPinned ?? false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(existingNote?.checklist ?? []);
  const [showChecklist, setShowChecklist] = useState((existingNote?.checklist ?? []).length > 0);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [reminderAt, setReminderAt] = useState<Date | null>(
    existingNote?.reminderAt ? new Date(existingNote.reminderAt) : null
  );
  const [recurrence, setRecurrence] = useState<ReminderRecurrence>(
    existingNote?.reminderRecurrence ?? 'once'
  );
  const [weekday, setWeekday] = useState<number>(
    existingNote?.reminderWeekday ?? 2
  );
  const [dayOfMonth, setDayOfMonth] = useState<number>(
    existingNote?.reminderDayOfMonth ?? 1
  );

  const [showResetDialog, setShowResetDialog] = useState(false);
  const [categoryMenuVisible, setCategoryMenuVisible] = useState(false);
  const [newCategoryDialog, setNewCategoryDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date());

  useEffect(() => {
    navigation.setOptions({
      title: existingNote ? 'Bearbeiten' : 'Neue Notiz',
    });
  }, [existingNote, navigation]);

  const saveNoteRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const hasSavedRef = useRef(false);

  const saveNote = useCallback(async () => {
    if (hasSavedRef.current) return;
    hasSavedRef.current = true;

    const reminderIso = reminderAt?.toISOString() ?? null;
    const notePayload = {
      title: title.trim(),
      content,
      category,
      isPinned,
      checklist,
      reminderAt: reminderIso,
      reminderRecurrence: reminderIso ? recurrence : 'once' as ReminderRecurrence,
      reminderWeekday: reminderIso && recurrence === 'weekly' ? weekday : null,
      reminderDayOfMonth: reminderIso && recurrence === 'monthly' ? dayOfMonth : null,
    };

    if (!existingNote && !notePayload.title && !notePayload.content && checklist.length === 0) return;

    if (existingNote) {
      await updateNote(existingNote.id, notePayload);
    } else {
      await addNote(notePayload);
    }
  }, [existingNote, title, content, category, isPinned, checklist, reminderAt, recurrence, weekday, dayOfMonth, updateNote, addNote]);

  useEffect(() => {
    saveNoteRef.current = saveNote;
  }, [saveNote]);

  const handleSave = useCallback(async () => {
    await saveNote();
    navigation.goBack();
  }, [saveNote, navigation]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (_e: any) => {
      saveNoteRef.current?.();
    });
    return unsubscribe;
  }, [navigation]);

  const handleAddCategory = useCallback(async () => {
    const name = newCategoryName.trim();
    if (name) {
      await addCategory(name);
      setCategory(name);
      setNewCategoryName('');
      setNewCategoryDialog(false);
    }
  }, [newCategoryName, addCategory]);

  const addChecklistItem = useCallback(() => {
    const text = newChecklistText.trim();
    if (text) {
      setChecklist((prev) => [...prev, { id: uuidv4(), text, checked: false }]);
      setNewChecklistText('');
    }
  }, [newChecklistText]);

  const toggleChecklistItem = useCallback((itemId: string) => {
    setChecklist((prev) => {
      const updated = prev.map((item) =>
        item.id === itemId ? { ...item, checked: !item.checked } : item
      );
      if (updated.length > 0 && updated.every((i) => i.checked)) {
        setShowResetDialog(true);
      }
      return updated;
    });
  }, []);

  const removeChecklistItem = useCallback((itemId: string) => {
    setChecklist((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const handleDateChange = useCallback((_: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setPickerDate(selectedDate);
      setShowTimePicker(true);
    }
  }, []);

  const handleTimeChange = useCallback((_: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const combined = new Date(pickerDate);
      combined.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
      if (recurrence === 'once') {
        if (combined > new Date()) {
          setReminderAt(combined);
        }
      } else {
        setReminderAt(combined);
      }
    }
  }, [pickerDate, recurrence]);

  const openTimePicker = useCallback(() => {
    setPickerDate(reminderAt ?? new Date());
    if (recurrence === 'once') {
      setShowDatePicker(true);
    } else {
      setShowTimePicker(true);
    }
  }, [reminderAt, recurrence]);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  const formatReminder = (date: Date) =>
    date.toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const getReminderSummary = (): string => {
    if (!reminderAt) return 'Erinnerung setzen';
    const time = formatTime(reminderAt);
    switch (recurrence) {
      case 'daily':
        return `Täglich um ${time}`;
      case 'weekly':
        return `Jeden ${WEEKDAY_LABELS[weekday]} um ${time}`;
      case 'monthly':
        return `Jeden ${dayOfMonth}. um ${time}`;
      default:
        return formatReminder(reminderAt);
    }
  };

  const inputTheme = {
    colors: { onSurfaceVariant: theme.colors.onSurfaceVariant },
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Pin + Title */}
        <View style={styles.titleRow}>
          <TextInput
            label="Titel"
            value={title}
            onChangeText={setTitle}
            mode="outlined"
            style={[styles.input, { flex: 1 }]}
            outlineStyle={styles.outline}
            outlineColor={theme.colors.outline}
            activeOutlineColor={theme.colors.primary}
            textColor={theme.colors.onSurface}
            theme={inputTheme}
          />
          <IconButton
            icon={isPinned ? 'pin' : 'pin-outline'}
            size={22}
            iconColor={isPinned ? theme.colors.tertiary : theme.colors.onSurfaceVariant}
            onPress={() => setIsPinned(!isPinned)}
            style={[
              styles.pinBtn,
              isPinned && { backgroundColor: theme.colors.tertiaryContainer },
            ]}
          />
        </View>

        {/* Content */}
        <TextInput
          label="Inhalt"
          value={content}
          onChangeText={setContent}
          mode="outlined"
          multiline
          numberOfLines={8}
          style={[styles.input, styles.contentInput]}
          outlineStyle={styles.outline}
          outlineColor={theme.colors.outline}
          activeOutlineColor={theme.colors.primary}
          textColor={theme.colors.onSurface}
          theme={inputTheme}
        />

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: theme.colors.outline }]} />

        {/* Checklist Toggle */}
        <Chip
          icon={showChecklist ? 'checkbox-marked-outline' : 'checkbox-blank-outline'}
          selected={showChecklist}
          onPress={() => {
            if (showChecklist && checklist.length > 0) {
              // Keep items but hide section
            }
            setShowChecklist(!showChecklist);
          }}
          compact
          style={[
            styles.checklistToggle,
            {
              backgroundColor: showChecklist
                ? theme.colors.secondaryContainer
                : 'transparent',
              borderColor: showChecklist ? theme.colors.secondary : theme.colors.outline,
            },
          ]}
          textStyle={{
            fontSize: 12,
            fontWeight: '600',
            color: showChecklist ? theme.colors.secondary : theme.colors.onSurfaceVariant,
          }}
        >
          Checkliste{checklist.length > 0 ? ` (${checklist.filter((i) => i.checked).length}/${checklist.length})` : ''}
        </Chip>

        {/* Checklist Items */}
        {showChecklist && (
          <View style={styles.checklistContainer}>
            {checklist.map((item) => (
              <View key={item.id} style={styles.checklistRow}>
                <IconButton
                  icon={item.checked ? 'checkbox-marked' : 'checkbox-blank-outline'}
                  size={20}
                  iconColor={item.checked ? theme.colors.secondary : theme.colors.onSurfaceVariant}
                  onPress={() => toggleChecklistItem(item.id)}
                  style={styles.checkboxBtn}
                />
                <Text
                  style={[
                    styles.checklistText,
                    { color: theme.colors.onSurface },
                    item.checked && { textDecorationLine: 'line-through', opacity: 0.5 },
                  ]}
                  numberOfLines={2}
                >
                  {item.text}
                </Text>
                <IconButton
                  icon="close"
                  size={14}
                  iconColor={theme.colors.onSurfaceVariant}
                  onPress={() => removeChecklistItem(item.id)}
                  style={styles.checklistRemoveBtn}
                />
              </View>
            ))}

            <View style={styles.addChecklistRow}>
              <TextInput
                value={newChecklistText}
                onChangeText={setNewChecklistText}
                placeholder="Neuer Punkt..."
                mode="outlined"
                dense
                style={[styles.input, { flex: 1 }]}
                outlineStyle={{ borderRadius: 12, borderWidth: 1 }}
                outlineColor={theme.colors.outline}
                activeOutlineColor={theme.colors.primary}
                textColor={theme.colors.onSurface}
                theme={inputTheme}
                onSubmitEditing={addChecklistItem}
                returnKeyType="done"
              />
              <IconButton
                icon="plus-circle"
                size={24}
                iconColor={theme.colors.primary}
                onPress={addChecklistItem}
              />
            </View>
          </View>
        )}

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: theme.colors.outline }]} />

        {/* Category */}
        <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
          KATEGORIE
        </Text>
        <Menu
          visible={categoryMenuVisible}
          onDismiss={() => setCategoryMenuVisible(false)}
          anchor={
            <Button
              mode="text"
              onPress={() => setCategoryMenuVisible(true)}
              icon="folder-outline"
              style={[styles.categoryBtn, { backgroundColor: theme.colors.surfaceVariant }]}
              labelStyle={{ color: theme.colors.onSurface }}
              contentStyle={{ height: 44 }}
            >
              {category}
            </Button>
          }
        >
          {categories.map((cat) => (
            <Menu.Item
              key={cat}
              title={cat}
              leadingIcon={cat === category ? 'check' : undefined}
              onPress={() => { setCategory(cat); setCategoryMenuVisible(false); }}
            />
          ))}
          <Divider />
          <Menu.Item
            title="Neue Kategorie..."
            leadingIcon="plus"
            onPress={() => { setCategoryMenuVisible(false); setNewCategoryDialog(true); }}
          />
        </Menu>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: theme.colors.outline }]} />

        {/* Reminder */}
        <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
          ERINNERUNG
        </Text>

        <SegmentedButtons
          value={recurrence}
          onValueChange={(val) => {
            setRecurrence(val as ReminderRecurrence);
            setReminderAt(null);
          }}
          buttons={RECURRENCE_OPTIONS.map((opt) => ({
            value: opt.value,
            label: opt.label,
            style: {
              backgroundColor: recurrence === opt.value
                ? theme.colors.primaryContainer
                : 'transparent',
              borderColor: theme.colors.outline,
            },
            labelStyle: {
              fontSize: 11,
              color: recurrence === opt.value
                ? theme.colors.primary
                : theme.colors.onSurfaceVariant,
            },
          }))}
          style={styles.segmented}
        />

        {/* Weekday picker for weekly */}
        {recurrence === 'weekly' && (
          <View style={styles.weekdayRow}>
            {WEEKDAY_ORDER.map((wd) => (
              <Chip
                key={wd}
                selected={weekday === wd}
                onPress={() => setWeekday(wd)}
                compact
                style={[
                  styles.weekdayChip,
                  weekday === wd
                    ? { backgroundColor: theme.colors.primaryContainer }
                    : { backgroundColor: 'transparent', borderColor: theme.colors.outline },
                ]}
                textStyle={{
                  fontSize: 11,
                  color: weekday === wd ? theme.colors.primary : theme.colors.onSurfaceVariant,
                }}
              >
                {WEEKDAY_LABELS[wd].substring(0, 2)}
              </Chip>
            ))}
          </View>
        )}

        {/* Day of month picker for monthly */}
        {recurrence === 'monthly' && (
          <View style={styles.dayOfMonthRow}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Am
            </Text>
            <View style={styles.daySelector}>
              <IconButton
                icon="minus"
                size={16}
                iconColor={theme.colors.primary}
                onPress={() => setDayOfMonth(Math.max(1, dayOfMonth - 1))}
                style={[styles.dayBtn, { borderColor: theme.colors.outline }]}
              />
              <Text variant="titleMedium" style={[styles.dayNumber, { color: theme.colors.onSurface }]}>
                {dayOfMonth}.
              </Text>
              <IconButton
                icon="plus"
                size={16}
                iconColor={theme.colors.primary}
                onPress={() => setDayOfMonth(Math.min(31, dayOfMonth + 1))}
                style={[styles.dayBtn, { borderColor: theme.colors.outline }]}
              />
            </View>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              des Monats
            </Text>
          </View>
        )}

        {/* Time / Date+Time button */}
        <View style={styles.reminderRow}>
          <Button
            mode="text"
            icon={reminderAt ? 'bell-ring-outline' : 'bell-outline'}
            onPress={openTimePicker}
            style={[
              styles.reminderBtn,
              {
                backgroundColor: reminderAt
                  ? theme.colors.tertiaryContainer
                  : theme.colors.surfaceVariant,
              },
            ]}
            labelStyle={{
              color: reminderAt ? theme.colors.tertiary : theme.colors.onSurfaceVariant,
            }}
            contentStyle={{ height: 44 }}
          >
            {getReminderSummary()}
          </Button>
          {reminderAt && (
            <IconButton
              icon="close-circle"
              size={20}
              iconColor={theme.colors.onSurfaceVariant}
              onPress={() => setReminderAt(null)}
            />
          )}
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={pickerDate}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={handleDateChange}
          />
        )}
        {showTimePicker && (
          <DateTimePicker
            value={pickerDate}
            mode="time"
            display="default"
            is24Hour={true}
            onChange={handleTimeChange}
          />
        )}

        {/* Save */}
        <Button
          mode="contained"
          onPress={handleSave}
          style={styles.saveBtn}
          contentStyle={styles.saveBtnContent}
          labelStyle={styles.saveBtnLabel}
          buttonColor={theme.colors.primary}
        >
          Speichern
        </Button>
      </ScrollView>

      {/* New Category Dialog */}
      <Portal>
        <Dialog
          visible={newCategoryDialog}
          onDismiss={() => setNewCategoryDialog(false)}
          style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={{ color: theme.colors.onSurface }}>Neue Kategorie</Dialog.Title>
          <Dialog.Content>
            <TextInput
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholder="Name..."
              mode="outlined"
              dense
              outlineStyle={{ borderRadius: 12, borderWidth: 1 }}
              outlineColor={theme.colors.outline}
              activeOutlineColor={theme.colors.primary}
              textColor={theme.colors.onSurface}
              theme={inputTheme}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setNewCategoryDialog(false)} textColor={theme.colors.onSurfaceVariant}>
              Abbrechen
            </Button>
            <Button onPress={handleAddCategory} mode="contained" style={{ borderRadius: 12 }}>
              Hinzufügen
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Reset Checklist Dialog */}
      <Portal>
        <Dialog
          visible={showResetDialog}
          onDismiss={() => setShowResetDialog(false)}
          style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={{ color: theme.colors.onSurface }}>Alle erledigt!</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
              Checkliste zurücksetzen, um sie erneut zu verwenden?
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowResetDialog(false)} textColor={theme.colors.onSurfaceVariant}>
              Behalten
            </Button>
            <Button
              onPress={() => {
                setChecklist((prev) => prev.map((i) => ({ ...i, checked: false })));
                setShowResetDialog(false);
              }}
              mode="contained"
              style={{ borderRadius: 12 }}
            >
              Zurücksetzen
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
    gap: 12,
  },
  input: {
    backgroundColor: 'transparent',
  },
  outline: {
    borderRadius: 16,
    borderWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pinBtn: {
    borderRadius: 12,
    marginTop: 4,
  },
  contentInput: {
    minHeight: 160,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxBtn: {
    margin: -4,
    marginRight: 4,
  },
  checklistText: {
    flex: 1,
    fontSize: 14,
  },
  checklistRemoveBtn: {
    margin: -4,
    opacity: 0.4,
  },
  checklistToggle: {
    alignSelf: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
  },
  checklistContainer: {
    gap: 2,
  },
  addChecklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  divider: {
    height: 1,
    marginVertical: 8,
    opacity: 0.5,
  },
  sectionLabel: {
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1.2,
    marginTop: 4,
    marginBottom: 8,
  },
  categoryBtn: {
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  segmented: {
    marginBottom: 12,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 4,
  },
  weekdayChip: {
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 38,
  },
  dayOfMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  daySelector: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayBtn: {
    borderWidth: 1,
    borderRadius: 10,
    margin: 0,
  },
  dayNumber: {
    minWidth: 36,
    textAlign: 'center',
    fontWeight: '700',
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reminderBtn: {
    borderRadius: 14,
  },
  saveBtn: {
    marginTop: 20,
    borderRadius: 16,
  },
  saveBtnContent: {
    paddingVertical: 8,
  },
  saveBtnLabel: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dialog: {
    borderRadius: 24,
  },
});
