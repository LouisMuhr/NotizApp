import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { Note, DEFAULT_CATEGORIES } from '../models/Note';
import { loadNotes, saveNotes, loadCategories, saveCategories, loadArchive, saveArchive, loadTombstones, saveTombstones } from '../storage/noteStorage';
import { scheduleReminder, cancelReminder } from '../utils/notifications';
import { isSyncConfigured } from '../sync/supabaseClient';
import { getDeviceId } from '../sync/deviceId';
import { pullRemote, subscribeRemote, deleteRemote, upsertRemote } from '../sync/remoteNotes';
import { insertThought, deleteThought } from '../sync/remoteThoughts';
import { Thought } from '../models/Thought';
import * as haptics from '../utils/haptics';

function noteToThoughtContent(note: { title: string; content: string }): string {
  return note.title ? `${note.title}\n\n${note.content}`.trim() : note.content;
}

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
}

const NotesContext = createContext<NotesContextType>({} as NotesContextType);

export function NotesProvider({ children }: { children: React.ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [archivedNotes, setArchivedNotes] = useState<Note[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const deviceIdRef = useRef<string | null>(null);
  const tombstonesRef = useRef<Set<string>>(new Set());

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
      const cleanedLocal = loadedNotes.filter((n) => {
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

      // Sync layer (additive, only if configured)
      if (!isSyncConfigured()) return;
      try {
        const deviceId = await getDeviceId();
        deviceIdRef.current = deviceId;
        // Clean up remote: drop everything that has been archived or tombstoned locally
        const purgeIds = [
          ...Array.from(archiveIds),
          ...Array.from(tombstonesRef.current),
        ];
        if (purgeIds.length > 0) {
          try {
            await deleteRemote(deviceId, purgeIds);
          } catch (e) {
            console.warn('[sync] purge failed', e);
          }
        }
        const remote = await pullRemote(deviceId);
        if (cancelled) return;
        if (remote.length > 0) {
          const byId = new Map(cleanedLocal.map((n) => [n.id, n]));
          for (const r of remote) {
            // Don't resurrect archived or tombstoned notes from remote
            if (archiveIds.has(r.id)) continue;
            if (tombstonesRef.current.has(r.id)) continue;
            const local = byId.get(r.id);
            if (!local || new Date(r.updatedAt) > new Date(local.updatedAt)) {
              byId.set(r.id, r);
            }
          }
          const merged = Array.from(byId.values()).sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          );
          setNotes(merged);
          await saveNotes(merged);
        }
        unsubscribe = subscribeRemote(deviceId, (incoming) => {
          if (archiveIds.has(incoming.id)) return;
          if (tombstonesRef.current.has(incoming.id)) return;
          setNotes((prev) => {
            if (prev.some((n) => n.id === incoming.id)) return prev;
            const next = [incoming, ...prev];
            saveNotes(next).catch(() => {});
            return next;
          });
        });
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
    if (newNote.feedsThreads && deviceIdRef.current) {
      const thought: Thought = {
        id: newNote.id,
        content: noteToThoughtContent(newNote),
        source: 'app',
        rawAudioUrl: null,
        createdAt: newNote.createdAt,
        processedAt: null,
      };
      insertThought(deviceIdRef.current, thought).catch((e) =>
        console.warn('[sync] insertThought (addNote) failed', e),
      );
    }
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
    if (deviceIdRef.current) {
      if (updatedNote.feedsThreads) {
        const thought: Thought = {
          id: updatedNote.id,
          content: noteToThoughtContent(updatedNote),
          source: 'app',
          rawAudioUrl: null,
          createdAt: updatedNote.createdAt,
          processedAt: null,
        };
        // Upsert: erst löschen, dann neu einfügen — damit processed_at zurückgesetzt wird
        deleteThought(deviceIdRef.current, updatedNote.id)
          .then(() => insertThought(deviceIdRef.current!, thought))
          .catch((e) => console.warn('[sync] thought upsert (updateNote) failed', e));
      } else if (oldNote.feedsThreads && !updatedNote.feedsThreads) {
        deleteThought(deviceIdRef.current, updatedNote.id).catch((e) =>
          console.warn('[sync] deleteThought (updateNote toggle off) failed', e),
        );
      }
    }
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
      if (note.feedsThreads) {
        deleteThought(deviceIdRef.current, id).catch((e) =>
          console.warn('[sync] deleteThought (deleteNote) failed', e),
        );
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
      }}
    >
      {children}
    </NotesContext.Provider>
  );
}

export const useNotes = () => useContext(NotesContext);
