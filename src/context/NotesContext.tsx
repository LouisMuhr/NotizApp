import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { Note, DEFAULT_CATEGORIES } from '../models/Note';
import { loadNotes, saveNotes, loadCategories, saveCategories } from '../storage/noteStorage';
import { scheduleReminder, cancelReminder } from '../utils/notifications';

interface NotesContextType {
  notes: Note[];
  categories: string[];
  loading: boolean;
  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'notificationId'>) => Promise<Note>;
  updateNote: (id: string, updates: Partial<Omit<Note, 'id' | 'createdAt'>>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  addCategory: (name: string) => Promise<void>;
  deleteCategory: (name: string) => Promise<void>;
}

const NotesContext = createContext<NotesContextType>({} as NotesContextType);

export function NotesProvider({ children }: { children: React.ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [loadedNotes, loadedCategories] = await Promise.all([
        loadNotes(),
        loadCategories(),
      ]);
      setNotes(loadedNotes);
      if (loadedCategories.length > 0) {
        setCategories(loadedCategories);
      } else {
        await saveCategories(DEFAULT_CATEGORIES);
      }
      setLoading(false);
    })();
  }, []);

  const persistNotes = useCallback(async (updated: Note[]) => {
    setNotes(updated);
    await saveNotes(updated);
  }, []);

  const scheduleNoteReminder = useCallback(async (note: {
    id: string; title: string; content: string;
    reminderAt: string | null; reminderRecurrence: Note['reminderRecurrence'];
    reminderWeekday: number | null; reminderDayOfMonth: number | null;
  }): Promise<string | null> => {
    if (!note.reminderAt) return null;

    const triggerDate = new Date(note.reminderAt);
    if (note.reminderRecurrence === 'once' && triggerDate <= new Date()) return null;

    return await scheduleReminder({
      noteId: note.id,
      title: note.title,
      body: note.content,
      triggerDate,
      recurrence: note.reminderRecurrence,
      weekday: note.reminderWeekday,
      dayOfMonth: note.reminderDayOfMonth,
    });
  }, []);

  const addNote = useCallback(async (noteData: Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'notificationId'>): Promise<Note> => {
    const now = new Date().toISOString();
    const id = uuidv4();

    const notificationId = await scheduleNoteReminder({
      id,
      title: noteData.title,
      content: noteData.content,
      reminderAt: noteData.reminderAt,
      reminderRecurrence: noteData.reminderRecurrence,
      reminderWeekday: noteData.reminderWeekday,
      reminderDayOfMonth: noteData.reminderDayOfMonth,
    });

    const newNote: Note = {
      ...noteData,
      id,
      createdAt: now,
      updatedAt: now,
      notificationId,
    };

    const updated = [newNote, ...notes];
    await persistNotes(updated);
    return newNote;
  }, [notes, persistNotes, scheduleNoteReminder]);

  const updateNote = useCallback(async (id: string, updates: Partial<Omit<Note, 'id' | 'createdAt'>>) => {
    const oldNote = notes.find((n) => n.id === id);
    if (!oldNote) return;

    const updatedNote = { ...oldNote, ...updates, updatedAt: new Date().toISOString() };

    const reminderChanged =
      updates.reminderAt !== undefined ||
      updates.reminderRecurrence !== undefined ||
      updates.reminderWeekday !== undefined ||
      updates.reminderDayOfMonth !== undefined;

    if (reminderChanged) {
      if (oldNote.notificationId) {
        await cancelReminder(oldNote.notificationId);
      }
      updatedNote.notificationId = await scheduleNoteReminder({
        id,
        title: updatedNote.title,
        content: updatedNote.content,
        reminderAt: updatedNote.reminderAt,
        reminderRecurrence: updatedNote.reminderRecurrence,
        reminderWeekday: updatedNote.reminderWeekday,
        reminderDayOfMonth: updatedNote.reminderDayOfMonth,
      });
    }

    const updated = notes.map((n) => (n.id === id ? updatedNote : n));
    await persistNotes(updated);
  }, [notes, persistNotes, scheduleNoteReminder]);

  const deleteNote = useCallback(async (id: string) => {
    const note = notes.find((n) => n.id === id);
    if (note?.notificationId) {
      await cancelReminder(note.notificationId);
    }
    await persistNotes(notes.filter((n) => n.id !== id));
  }, [notes, persistNotes]);

  const addCategory = useCallback(async (name: string) => {
    if (!categories.includes(name)) {
      const updated = [...categories, name];
      setCategories(updated);
      await saveCategories(updated);
    }
  }, [categories]);

  const deleteCategory = useCallback(async (name: string) => {
    const updated = categories.filter((c) => c !== name);
    setCategories(updated);
    await saveCategories(updated);
  }, [categories]);

  return (
    <NotesContext.Provider
      value={{
        notes,
        categories,
        loading,
        addNote,
        updateNote,
        deleteNote,
        addCategory,
        deleteCategory,
      }}
    >
      {children}
    </NotesContext.Provider>
  );
}

export const useNotes = () => useContext(NotesContext);
