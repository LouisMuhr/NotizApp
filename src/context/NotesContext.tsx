import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { Note, DEFAULT_CATEGORIES } from '../models/Note';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadNotes, saveNotes, loadCategories, saveCategories, loadArchive, saveArchive, loadTombstones, saveTombstones } from '../storage/noteStorage';
import { scheduleReminder, cancelReminder, cancelAllReminders } from '../utils/notifications';
import { isSyncConfigured, getSupabase } from '../sync/supabaseClient';
import { getUserId, clearUserIdCache } from '../sync/userId';
import { pullRemote, subscribeRemote, deleteRemote, upsertRemote } from '../sync/remoteNotes';
import * as haptics from '../utils/haptics';

interface NotesContextType {
  notes: Note[];
  archivedNotes: Note[];
  categories: string[];
  loading: boolean;
  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'notificationId'>) => Promise<Note>;
  updateNote: (id: string, updates: Partial<Omit<Note, 'id' | 'createdAt'>>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  restoreNote: (id: string) => Promise<void>;
  deleteNotePermanently: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  addCategory: (name: string) => Promise<void>;
  deleteCategory: (name: string) => Promise<void>;
  rescheduleAllReminders: () => Promise<void>;
  resyncForUser: (userId: string) => Promise<void>;
  deleteAllData: () => Promise<void>;
}

const NotesContext = createContext<NotesContextType>({} as NotesContextType);

export function NotesProvider({ children }: { children: React.ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [archivedNotes, setArchivedNotes] = useState<Note[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const deviceIdRef = useRef<string | null>(null);
  const tombstonesRef = useRef<Set<string>>(new Set());
  const startSyncRef = useRef<((userId: string, remoteOnly?: boolean) => Promise<void>) | null>(null);

  const addTombstones = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    for (const id of ids) tombstonesRef.current.add(id);
    await saveTombstones(Array.from(tombstonesRef.current));
    if (deviceIdRef.current) {
      try {
        await deleteRemote(deviceIdRef.current, ids);
      } catch (e) {
        console.warn('[sync] deleteRemote failed', e);
      }
    }
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      // Load haptics preference early so utility helpers see the right value.
      haptics.loadHapticsPref().catch(() => {});
      const [loadedNotes, loadedCategories, loadedArchive, loadedTombstones] = await Promise.all([
        loadNotes(),
        loadCategories(),
        loadArchive(),
        loadTombstones(),
      ]);
      if (cancelled) return;
      tombstonesRef.current = new Set(loadedTombstones);
      const archiveIds = new Set(loadedArchive.map((n) => n.id));
      // Dedupe by id and exclude anything that lives in the archive
      const seenLocal = new Set<string>();
      let cleanedLocal = loadedNotes.filter((n) => {
        if (archiveIds.has(n.id)) return false;
        if (seenLocal.has(n.id)) return false;
        seenLocal.add(n.id);
        return true;
      });
      setNotes(cleanedLocal);
      setArchivedNotes(loadedArchive);
      if (cleanedLocal.length !== loadedNotes.length) {
        await saveNotes(cleanedLocal);
      }
      if (loadedCategories.length > 0) {
        setCategories(loadedCategories);
      } else {
        await saveCategories(DEFAULT_CATEGORIES);
      }
      setLoading(false);

      // ALARM RECOVERY: nach jedem Kaltstart alle Alarme neu anmelden.
      // cancelAllScheduledNotificationsAsync() zuerst, damit keine Zombie-
      // Benachrichtigungen aus früheren Starts akkumulieren.
      {
        await cancelAllReminders();
        const withReminders = cleanedLocal.filter((n) => n.reminderAt !== null);
        if (withReminders.length > 0) {
          const updated = [...cleanedLocal];
          let changed = false;
          for (const note of withReminders) {
            // Einmalige Erinnerungen die bereits abgelaufen sind nicht neu planen
            if (note.reminderRecurrence === 'once' && new Date(note.reminderAt!) <= new Date()) {
              if (note.notificationId !== null) {
                const idx = updated.findIndex((n) => n.id === note.id);
                if (idx !== -1) { updated[idx] = { ...updated[idx], notificationId: null }; changed = true; }
              }
              continue;
            }
            const newId = await scheduleReminder({
              noteId: note.id,
              title: note.title,
              body: note.content,
              triggerDate: new Date(note.reminderAt!),
              recurrence: note.reminderRecurrence,
              weekday: note.reminderWeekday,
              dayOfMonth: note.reminderDayOfMonth,
            });
            if (newId !== note.notificationId) {
              const idx = updated.findIndex((n) => n.id === note.id);
              if (idx !== -1) { updated[idx] = { ...updated[idx], notificationId: newId }; changed = true; }
            }
          }
          if (changed) {
            cleanedLocal = updated;
            setNotes(updated);
            await saveNotes(updated);
          }
        }
      }

      // Sync layer (additive, only if configured)
      if (!isSyncConfigured()) return;

      const startSync = async (userId: string, localNotes: Note[], remoteOnly = false) => {
        deviceIdRef.current = userId;
        const purgeIds = [
          ...Array.from(archiveIds),
          ...Array.from(tombstonesRef.current),
        ];
        if (purgeIds.length > 0) {
          try { await deleteRemote(userId, purgeIds); } catch (e) { console.warn('[sync] purge failed', e); }
        }
        const remote = await pullRemote(userId);
        if (cancelled) return;
        if (remote !== null) {
          const byId = new Map<string, Note>();
          for (const r of remote) {
            if (archiveIds.has(r.id)) continue;
            if (tombstonesRef.current.has(r.id)) continue;
            byId.set(r.id, r);
          }
          if (!remoteOnly) {
            for (const local of localNotes) {
              if (archiveIds.has(local.id)) continue;
              if (tombstonesRef.current.has(local.id)) continue;
              const existing = byId.get(local.id);
              if (existing) {
                if (new Date(local.updatedAt) > new Date(existing.updatedAt)) {
                  byId.set(local.id, local);
                } else {
                  byId.set(local.id, { ...existing, notificationId: local.notificationId });
                }
              }
            }
          }
          const merged = Array.from(byId.values()).sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          );
          setNotes(merged);
          await saveNotes(merged);
        }
        if (unsubscribe) unsubscribe();
        unsubscribe = subscribeRemote(userId, (incoming) => {
          if (archiveIds.has(incoming.id)) return;
          if (tombstonesRef.current.has(incoming.id)) return;
          setNotes((prev) => {
            if (prev.some((n) => n.id === incoming.id)) return prev;
            const next = [incoming, ...prev];
            saveNotes(next).catch(() => {});
            return next;
          });
        });
      };

      startSyncRef.current = (userId: string, remoteOnly = false) =>
        startSync(userId, cleanedLocal, remoteOnly);

      try {
        const deviceId = await getUserId();
        if (!deviceId) return;
        await startSync(deviceId, cleanedLocal);
      } catch (e) {
        console.warn('[sync] init failed', e);
      }

    })();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const persistNotes = useCallback(async (updated: Note[]) => {
    setNotes(updated);
    await saveNotes(updated);
  }, []);

  const pushRemote = useCallback((note: Note) => {
    if (!deviceIdRef.current) return;
    upsertRemote(deviceIdRef.current, note).catch((e) =>
      console.warn('[sync] upsertRemote failed', e),
    );
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

  const rescheduleAllReminders = useCallback(async () => {
    await cancelAllReminders();
    const withReminders = notes.filter((n) => n.reminderAt !== null);
    if (withReminders.length === 0) return;
    const updated = [...notes];
    let changed = false;
    for (const note of withReminders) {
      if (note.reminderRecurrence === 'once' && new Date(note.reminderAt!) <= new Date()) {
        if (note.notificationId !== null) {
          const idx = updated.findIndex((n) => n.id === note.id);
          if (idx !== -1) { updated[idx] = { ...updated[idx], notificationId: null }; changed = true; }
        }
        continue;
      }
      const newId = await scheduleReminder({
        noteId: note.id,
        title: note.title,
        body: note.content,
        triggerDate: new Date(note.reminderAt!),
        recurrence: note.reminderRecurrence,
        weekday: note.reminderWeekday,
        dayOfMonth: note.reminderDayOfMonth,
      });
      if (newId !== note.notificationId) {
        const idx = updated.findIndex((n) => n.id === note.id);
        if (idx !== -1) { updated[idx] = { ...updated[idx], notificationId: newId }; changed = true; }
      }
    }
    if (!changed) return;
    setNotes(updated);
    await saveNotes(updated);
    if (deviceIdRef.current) {
      for (const u of updated) {
        if (notes.find((n) => n.id === u.id)?.notificationId !== u.notificationId) pushRemote(u);
      }
    }
  }, [notes, pushRemote]);

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
    pushRemote(newNote);
    haptics.success();
    return newNote;
  }, [notes, persistNotes, scheduleNoteReminder, pushRemote]);

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
    pushRemote(updatedNote);
    haptics.light();
  }, [notes, persistNotes, scheduleNoteReminder, pushRemote]);

  const persistArchive = useCallback(async (updated: Note[]) => {
    setArchivedNotes(updated);
    await saveArchive(updated);
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    if (note.notificationId) {
      await cancelReminder(note.notificationId);
    }
    const archived = { ...note, notificationId: null, isPinned: false };
    await persistArchive([archived, ...archivedNotes]);
    await persistNotes(notes.filter((n) => n.id !== id));
    // Remove from remote so it doesn't get pulled back as an active note
    if (deviceIdRef.current) {
      try {
        await deleteRemote(deviceIdRef.current, [id]);
      } catch (e) {
        console.warn('[sync] deleteRemote (archive) failed', e);
      }
    }
  }, [notes, archivedNotes, persistNotes, persistArchive]);

  const restoreNote = useCallback(async (id: string) => {
    const note = archivedNotes.find((n) => n.id === id);
    if (!note) return;
    const restored = { ...note, updatedAt: new Date().toISOString() };
    await persistNotes([restored, ...notes]);
    await persistArchive(archivedNotes.filter((n) => n.id !== id));
    pushRemote(restored);
  }, [notes, archivedNotes, persistNotes, persistArchive, pushRemote]);

  const deleteNotePermanently = useCallback(async (id: string) => {
    await persistArchive(archivedNotes.filter((n) => n.id !== id));
    await addTombstones([id]);
  }, [archivedNotes, persistArchive, addTombstones]);

  const addCategory = useCallback(async (name: string) => {
    if (!categories.includes(name)) {
      const updated = [...categories, name];
      setCategories(updated);
      await saveCategories(updated);
    }
  }, [categories]);

  const togglePin = useCallback(async (id: string) => {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    const toggled = { ...note, isPinned: !note.isPinned, updatedAt: new Date().toISOString() };
    const updated = notes.map((n) => (n.id === id ? toggled : n));
    await persistNotes(updated);
    pushRemote(toggled);
    haptics.light();
  }, [notes, persistNotes, pushRemote]);

  const deleteCategory = useCallback(async (name: string) => {
    const updated = categories.filter((c) => c !== name);
    setCategories(updated);
    await saveCategories(updated);
  }, [categories]);

  const deleteAllData = useCallback(async () => {
    await cancelAllReminders();
    await AsyncStorage.multiRemove([
      '@notizapp_notes',
      '@notizapp_categories',
      '@notizapp_archive',
      '@notizapp_tombstones',
    ]);
    setNotes([]);
    setArchivedNotes([]);
    setCategories(DEFAULT_CATEGORIES);
    tombstonesRef.current = new Set();

    if (deviceIdRef.current) {
      const supabase = getSupabase();
      if (supabase) {
        const uid = deviceIdRef.current;
        await Promise.all([
          supabase.from('notes').delete().eq('user_id', uid),
          supabase.from('thoughts').delete().eq('user_id', uid),
          supabase.from('threads').delete().eq('user_id', uid),
        ]).catch((e) => console.warn('[gdpr] remote delete failed', e));
      }
    }
  }, []);

  const resyncForUser = useCallback(async (userId: string) => {
    clearUserIdCache();
    if (startSyncRef.current) {
      await startSyncRef.current(userId, true);
    }
  }, []);

  return (
    <NotesContext.Provider
      value={{
        notes,
        archivedNotes,
        categories,
        loading,
        addNote,
        updateNote,
        deleteNote,
        restoreNote,
        deleteNotePermanently,
        togglePin,
        addCategory,
        deleteCategory,
        rescheduleAllReminders,
        resyncForUser,
        deleteAllData,
      }}
    >
      {children}
    </NotesContext.Provider>
  );
}

export const useNotes = () => useContext(NotesContext);
