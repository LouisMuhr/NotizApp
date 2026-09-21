import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { Note, DEFAULT_CATEGORIES } from '../models/Note';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadNotes, saveNotes, loadCategories, saveCategories, loadArchive, saveArchive,
  loadTombstones, saveTombstones, loadPendingSync, savePendingSync, loadSyncUid, saveSyncUid, clearSyncUid,
  loadTierCache, saveTierCache, clearTierCache,
} from '../storage/noteStorage';
import { scheduleReminder, cancelReminder, cancelAllReminders } from '../utils/notifications';
import { isSyncConfigured, getSupabase } from '../sync/supabaseClient';
import { getUserId, clearUserIdCache } from '../sync/userId';
import { signOutLegacyAnonymous } from '../sync/legacyAnon';
import {
  markInitialUploadPending, clearInitialUploadPending, isInitialUploadPending,
} from '../sync/accountState';
import { pullRemote, subscribeRemote, deleteRemote, upsertRemote } from '../sync/remoteNotes';
import { mergeLocalStores, mergeWithRemote, applyIncoming, splitArchive, nextTimestamp } from '../sync/mergeNotes';
import * as haptics from '../utils/haptics';
import { subscriptionService, Tier } from '../sync/subscriptionService';

export type ResyncMode = 'merge' | 'replace';

interface NotesContextType {
  notes: Note[];
  archivedNotes: Note[];
  categories: string[];
  loading: boolean;
  // Subscription / Rate-Limit
  /**
   * `null` heisst "noch nicht bekannt" — nicht "free". Die UI darf solange
   * keine Einschraenkung behaupten, sonst blitzt beim Start der Upsell fuer
   * zahlende Nutzer auf.
   */
  tier: Tier | null;
  /** Kurzform fuer `tier !== null`, damit Consumer nicht ueberall null pruefen. */
  tierKnown: boolean;
  nextAllowedAt: Date | null;
  refreshSubscription: () => Promise<void>;
  /** Server-Wert (z. B. aus einer 429-Antwort) uebernehmen — Entscheidung 14. */
  setServerNextAllowedAt: (iso: string | null) => void;
  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'notificationId'>) => Promise<Note>;
  updateNote: (id: string, updates: Partial<Omit<Note, 'id' | 'createdAt'>>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  restoreNote: (id: string) => Promise<void>;
  deleteNotePermanently: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  addCategory: (name: string) => Promise<void>;
  deleteCategory: (name: string) => Promise<void>;
  rescheduleAllReminders: () => Promise<void>;
  /**
   * Sync auf einen (neuen) User umstellen.
   * - 'merge': lokaler Bestand wird in das Konto uebernommen — nur beim
   *   einmaligen Erstupload nach der Registrierung (`uploadLocalNotes`).
   * - 'replace' (Default): lokaler Bestand wird durch den Remote-Bestand
   *   ersetzt. Gilt fuer Anmeldung auf einem Zweitgeraet und fuer das Abmelden.
   */
  resyncForUser: (userId: string, mode?: ResyncMode) => Promise<void>;
  /**
   * Einmaliger Upload der lokalen Notizen bei Erstregistrierung. Wirft bei
   * Fehler, damit der Aufrufer einen sichtbaren Retry anbieten kann.
   */
  uploadLocalNotes: (userId: string) => Promise<void>;
  /** true, solange ein Erstupload fehlgeschlagen und noch offen ist. */
  initialUploadPending: boolean;
  /** Sync abschalten und lokalen Bestand behalten (Abmelden → Zustand `local`). */
  detachSync: () => Promise<void>;
  /** Unbestaetigte lokale Aenderungen hochladen. Wirft, wenn etwas offen bleibt. */
  flushPending: () => Promise<void>;
  deleteAllData: () => Promise<void>;
}

const NotesContext = createContext<NotesContextType>({} as NotesContextType);

export function NotesProvider({ children }: { children: React.ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [archivedNotes, setArchivedNotes] = useState<Note[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<Tier | null>(null);
  const [nextAllowedAt, setNextAllowedAt] = useState<Date | null>(null);
  const [initialUploadPending, setInitialUploadPending] = useState(false);

  /** Gesamter lokaler Bestand (aktiv + archiviert). Quelle der Wahrheit fuer alle Mutationen. */
  const allRef = useRef<Note[]>([]);
  /** IDs mit lokalen Aenderungen, die remote noch nicht bestaetigt sind (Outbox). */
  const pendingRef = useRef<Set<string>>(new Set());
  const tombstonesRef = useRef<Set<string>>(new Set());
  const deviceIdRef = useRef<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);
  /** Vorwaertsreferenz: rescheduleAllReminders wird weiter unten definiert. */
  const rescheduleAllRemindersRef = useRef<() => Promise<void>>(async () => {});
  const syncChainRef = useRef<Promise<void>>(Promise.resolve());
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());

  // ---------------------------------------------------------------------------
  // Subscription
  // ---------------------------------------------------------------------------

  /**
   * Hat der Server in dieser Sitzung schon geantwortet? Der Cache-Read darf
   * eine bereits eingetroffene Server-Antwort nicht nachtraeglich ueberschreiben,
   * wenn er zufaellig langsamer war.
   */
  const serverTierSeenRef = useRef(false);

  const refreshSubscription = useCallback(async () => {
    try {
      const status = await subscriptionService.getStatus();
      serverTierSeenRef.current = true;
      setTier(status.tier);
      setNextAllowedAt(status.nextAllowedAt);
      // Fuer den naechsten Kaltstart merken, damit der Upsell nicht aufblitzt.
      const uid = await loadSyncUid();
      if (uid) await saveTierCache({ uid, tier: status.tier }).catch(() => {});
    } catch (e) {
      // Bewusst KEIN Rueckfall auf 'free': ein vorhandener Cache-Wert bleibt
      // stehen, sonst wuerde ein Pro-Nutzer offline zum Free-Nutzer.
      console.warn('[subscription] refresh failed', e);
    }
  }, []);

  const setServerNextAllowedAt = useCallback((iso: string | null) => {
    setNextAllowedAt(iso ? new Date(iso) : null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Cache zuerst: liefert den zuletzt bestaetigten Tier in Millisekunden,
    // waehrend der Server-Roundtrip noch laeuft.
    (async () => {
      const uid = await loadSyncUid();
      const cache = await loadTierCache(uid);
      if (cancelled || !cache) return;
      if (serverTierSeenRef.current) return; // Server war schneller, der gilt
      setTier(cache.tier);
    })().catch(() => {});

    refreshSubscription();
    return () => { cancelled = true; };
  }, [refreshSubscription]);

  // ---------------------------------------------------------------------------
  // Persistenz: State und Platte bleiben synchron (L3), Writes sind serialisiert (S13)
  // ---------------------------------------------------------------------------

  const publish = useCallback((all: Note[]) => {
    allRef.current = all;
    const { active, archived } = splitArchive(all);
    setNotes(active);
    setArchivedNotes(archived);
  }, []);

  const persist = useCallback((snapshot: Note[], pending: string[]) => {
    const run = writeChainRef.current.then(async () => {
      await savePendingSync(pending);
      const { active, archived } = splitArchive(snapshot);
      await saveNotes(active);
      await saveArchive(archived);
    });
    writeChainRef.current = run.catch(() => {});
    return run;
  }, []);

  /**
   * Neuen Bestand uebernehmen: sofort anzeigen, dann schreiben. Scheitert das
   * Schreiben, wird der Zustand von der Platte zurueckgelesen, damit die UI
   * nichts zeigt, was nach einem Neustart weg waere.
   */
  const commit = useCallback(async (next: Note[]) => {
    publish(next);
    try {
      await persist(next, Array.from(pendingRef.current));
    } catch (e) {
      try {
        const [n, a] = await Promise.all([loadNotes(), loadArchive()]);
        publish(mergeLocalStores(n, a, tombstonesRef.current));
      } catch (reloadErr) {
        console.warn('[storage] reload after failed write failed', reloadErr);
      }
      throw e;
    }
  }, [publish, persist]);

  // ---------------------------------------------------------------------------
  // Remote-Push mit Outbox
  // ---------------------------------------------------------------------------

  const markPending = useCallback((id: string) => {
    pendingRef.current.add(id);
  }, []);

  /** Einen Eintrag hochladen; bei Erfolg aus der Outbox entfernen. */
  const pushOne = useCallback(async (note: Note, patch?: Partial<Note>): Promise<boolean> => {
    const uid = deviceIdRef.current;
    if (!uid) return false;
    try {
      await upsertRemote(uid, note, patch);
      pendingRef.current.delete(note.id);
      await savePendingSync(Array.from(pendingRef.current));
      return true;
    } catch (e) {
      console.warn('[sync] push failed, kept in outbox', note.id, e);
      return false;
    }
  }, []);

  const pushRemote = useCallback((note: Note, patch?: Partial<Note>) => {
    pushOne(note, patch).catch(() => {});
  }, [pushOne]);

  const flushPending = useCallback(async () => {
    if (pendingRef.current.size === 0) return;
    if (!deviceIdRef.current) throw new Error('offline: kein Sync-User');
    const ids = Array.from(pendingRef.current);
    let failed = 0;
    for (const id of ids) {
      const note = allRef.current.find((n) => n.id === id);
      if (!note) {
        // lokal endgueltig geloescht → Tombstone kuemmert sich darum
        pendingRef.current.delete(id);
        continue;
      }
      if (!(await pushOne(note))) failed++;
    }
    await savePendingSync(Array.from(pendingRef.current));
    if (failed > 0) throw new Error(`${failed} Notiz(en) konnten nicht hochgeladen werden`);
  }, [pushOne]);

  const addTombstones = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    for (const id of ids) {
      tombstonesRef.current.add(id);
      pendingRef.current.delete(id);
    }
    await saveTombstones(Array.from(tombstonesRef.current));
    if (deviceIdRef.current) {
      try {
        await deleteRemote(deviceIdRef.current, ids);
      } catch (e) {
        console.warn('[sync] deleteRemote failed', e);
      }
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Sync: Pull + Merge + Outbox + Realtime
  // ---------------------------------------------------------------------------

  const subscribeFor = useCallback((uid: string) => {
    if (unsubscribeRef.current) {
      try { unsubscribeRef.current(); } catch {}
      unsubscribeRef.current = null;
    }
    unsubscribeRef.current = subscribeRemote(uid, {
      onUpsert: (incoming) => {
        const next = applyIncoming(allRef.current, incoming, tombstonesRef.current);
        if (next) commit(next).catch(() => {});
      },
      onDelete: (id) => {
        if (pendingRef.current.has(id)) return; // lokale Aenderung offen → wird nachgeschickt
        if (!allRef.current.some((n) => n.id === id)) return;
        commit(allRef.current.filter((n) => n.id !== id)).catch(() => {});
      },
    });
  }, [commit]);

  const doSync = useCallback(async (uid: string, mode: ResyncMode) => {
    {
      deviceIdRef.current = uid;

      if (tombstonesRef.current.size > 0) {
        try { await deleteRemote(uid, Array.from(tombstonesRef.current)); }
        catch (e) { console.warn('[sync] purge failed', e); }
      }

      const remote = await pullRemote(uid);
      if (!mountedRef.current) return;

      if (remote !== null) {
        const lastUid = await loadSyncUid();
        const identityChanged = lastUid !== uid;
        let merged: Note[];
        let toUpload: Note[] = [];
        if (mode === 'replace') {
          merged = remote.filter((r) => !tombstonesRef.current.has(r.id));
          pendingRef.current = new Set();
        } else {
          const result = mergeWithRemote({
            local: allRef.current,
            remote,
            pending: pendingRef.current,
            identityChanged,
            tombstones: tombstonesRef.current,
          });
          merged = result.merged;
          toUpload = result.toUpload;
        }
        for (const n of toUpload) pendingRef.current.add(n.id);
        await commit(merged);
        await saveSyncUid(uid);
        try { await flushPending(); } catch (e) { console.warn('[sync] outbox not empty', e); }
      } else {
        // Pull unvollstaendig/fehlgeschlagen: lokal bleibt, Outbox trotzdem versuchen
        try { await flushPending(); } catch {}
      }

      if (!mountedRef.current) return;
      subscribeFor(uid);
    }
  }, [commit, flushPending, subscribeFor]);

  /** Sync-Laeufe serialisieren: ein Resync waehrend des Start-Syncs wartet, statt zu entfallen. */
  const startSync = useCallback((uid: string, mode: ResyncMode) => {
    const run = syncChainRef.current.then(() => doSync(uid, mode));
    syncChainRef.current = run.catch(() => {});
    return run;
  }, [doSync]);

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------

  useEffect(() => {
    mountedRef.current = true;

    (async () => {
      haptics.loadHapticsPref().catch(() => {});
      const [loadedNotes, loadedCategories, loadedArchive, loadedTombstones, loadedPending] = await Promise.all([
        loadNotes(), loadCategories(), loadArchive(), loadTombstones(), loadPendingSync(),
      ]);
      if (!mountedRef.current) return;
      tombstonesRef.current = new Set(loadedTombstones);
      pendingRef.current = new Set(loadedPending);

      let all = mergeLocalStores(loadedNotes, loadedArchive, tombstonesRef.current);
      publish(all);
      if (all.length !== loadedNotes.length + loadedArchive.length) {
        await persist(all, Array.from(pendingRef.current)).catch(() => {});
      }
      if (loadedCategories.length > 0) {
        setCategories(loadedCategories);
      } else {
        await saveCategories(DEFAULT_CATEGORIES);
      }
      setLoading(false);

      // ALARM RECOVERY: nach jedem Kaltstart alle Alarme neu anmelden.
      {
        await cancelAllReminders();
        const withReminders = all.filter((n) => !n.archivedAt && n.reminderAt !== null);
        if (withReminders.length > 0) {
          const updated = [...all];
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
          if (changed && mountedRef.current) {
            all = updated;
            await commit(updated).catch(() => {});
          }
        }
      }

      if (!isSyncConfigured()) return;
      try {
        // Altlast: anonyme Session aus dem frueheren Modell beenden, bevor
        // irgendetwas synchronisiert wird. Danach ist der Zustand `local`.
        await signOutLegacyAnonymous();
        if (!mountedRef.current) return;

        // Ohne bestaetigtes Konto liefert getUserId() null → kein Sync, die
        // Notizen bleiben rein lokal. Das ist der Normalfall, kein Fehler.
        const deviceId = await getUserId();
        if (!deviceId || !mountedRef.current) return;

        // Routine-Start eines bestaetigten Kontos: 'merge'. Offline entstandene
        // Aenderungen duerfen nicht verworfen werden; `identityChanged` in
        // mergeWithRemote unterscheidet dabei gleiche von neuer Identitaet.
        const uploadOpen = await isInitialUploadPending();
        if (!mountedRef.current) return;
        if (uploadOpen) setInitialUploadPending(true);
        await startSync(deviceId, 'merge');
        // Ein aus einer frueheren Sitzung offener Erstupload ist damit erledigt,
        // sobald die Outbox leer ist — sonst bleibt der Retry sichtbar.
        if (uploadOpen && mountedRef.current && pendingRef.current.size === 0) {
          await clearInitialUploadPending();
          setInitialUploadPending(false);
        }
      } catch (e) {
        console.warn('[sync] init failed', e);
      }
    })();

    // P3: beim Zurueckkehren in den Vordergrund Aenderungen anderer Geraete holen
    // und offene Uploads nachschicken (Realtime-Socket kann im Hintergrund sterben).
    let last: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      const wasBackground = last === 'background' || last === 'inactive';
      last = next;
      if (wasBackground && next === 'active' && deviceIdRef.current) {
        startSync(deviceIdRef.current, 'merge').catch((e) => console.warn('[sync] foreground sync failed', e));
      }
    });

    return () => {
      mountedRef.current = false;
      sub.remove();
      if (unsubscribeRef.current) {
        try { unsubscribeRef.current(); } catch {}
        unsubscribeRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Erinnerungen
  // ---------------------------------------------------------------------------

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
    const all = allRef.current;
    const withReminders = all.filter((n) => !n.archivedAt && n.reminderAt !== null);
    if (withReminders.length === 0) return;
    const updated = [...all];
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
    // notificationId ist geraetelokal → kein Remote-Push, kein updatedAt-Bump
    if (changed) await commit(updated);
  }, [commit]);

  // Vorwaertsreferenz fuer Aufrufer, die vor dieser Definition stehen.
  rescheduleAllRemindersRef.current = rescheduleAllReminders;

  // ---------------------------------------------------------------------------
  // Mutationen (alle ueber allRef, damit parallele Aufrufe sich nicht ueberschreiben)
  // ---------------------------------------------------------------------------

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

    const newNote: Note = { ...noteData, id, createdAt: now, updatedAt: now, notificationId, archivedAt: null };

    markPending(id);
    await commit([newNote, ...allRef.current]);
    pushRemote(newNote);
    haptics.success();
    return newNote;
  }, [commit, markPending, pushRemote, scheduleNoteReminder]);

  const updateNote = useCallback(async (id: string, updates: Partial<Omit<Note, 'id' | 'createdAt'>>) => {
    const oldNote = allRef.current.find((n) => n.id === id);
    if (!oldNote) return;

    const updatedNote: Note = { ...oldNote, ...updates, updatedAt: nextTimestamp(oldNote.updatedAt) };

    const reminderChanged =
      updates.reminderAt !== undefined ||
      updates.reminderRecurrence !== undefined ||
      updates.reminderWeekday !== undefined ||
      updates.reminderDayOfMonth !== undefined;

    if (reminderChanged) {
      if (oldNote.notificationId) await cancelReminder(oldNote.notificationId);
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

    markPending(id);
    await commit(allRef.current.map((n) => (n.id === id ? updatedNote : n)));
    pushRemote(updatedNote, updates);
    haptics.light();
  }, [commit, markPending, pushRemote, scheduleNoteReminder]);

  /** Archivieren: bleibt remote erhalten, nur archived_at wird gesetzt (S9). */
  const deleteNote = useCallback(async (id: string) => {
    const note = allRef.current.find((n) => n.id === id);
    if (!note || note.archivedAt) return;
    if (note.notificationId) await cancelReminder(note.notificationId);
    const stamp = nextTimestamp(note.updatedAt);
    const archived: Note = { ...note, notificationId: null, isPinned: false, archivedAt: stamp, updatedAt: stamp };
    markPending(id);
    await commit(allRef.current.map((n) => (n.id === id ? archived : n)));
    pushRemote(archived, { archivedAt: stamp, isPinned: false });
  }, [commit, markPending, pushRemote]);

  const restoreNote = useCallback(async (id: string) => {
    const note = allRef.current.find((n) => n.id === id);
    if (!note || !note.archivedAt) return;
    const restored: Note = { ...note, archivedAt: null, updatedAt: nextTimestamp(note.updatedAt) };
    markPending(id);
    await commit(allRef.current.map((n) => (n.id === id ? restored : n)));
    pushRemote(restored, { archivedAt: null });
  }, [commit, markPending, pushRemote]);

  const deleteNotePermanently = useCallback(async (id: string) => {
    const note = allRef.current.find((n) => n.id === id);
    if (note?.notificationId) await cancelReminder(note.notificationId).catch(() => {});
    await commit(allRef.current.filter((n) => n.id !== id));
    await addTombstones([id]);
  }, [commit, addTombstones]);

  const togglePin = useCallback(async (id: string) => {
    const note = allRef.current.find((n) => n.id === id);
    if (!note) return;
    const toggled: Note = { ...note, isPinned: !note.isPinned, updatedAt: nextTimestamp(note.updatedAt) };
    markPending(id);
    await commit(allRef.current.map((n) => (n.id === id ? toggled : n)));
    pushRemote(toggled, { isPinned: toggled.isPinned });
    haptics.light();
  }, [commit, markPending, pushRemote]);

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

  const deleteAllData = useCallback(async () => {
    await cancelAllReminders();
    await AsyncStorage.multiRemove([
      '@notizapp_notes',
      '@notizapp_categories',
      '@notizapp_archive',
      '@notizapp_tombstones',
      '@notizapp_pending_sync',
      '@notizapp_sync_uid',
      '@notizapp_tier_cache',
    ]);
    publish([]);
    setCategories(DEFAULT_CATEGORIES);
    tombstonesRef.current = new Set();
    pendingRef.current = new Set();

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
  }, [publish]);

  /**
   * Default ist 'replace': eine Anmeldung auf einem Zweitgeraet uebernimmt den
   * Kontostand, statt den dortigen lokalen Bestand ungefragt hineinzumischen.
   * Der Erstupload nach der Registrierung geht ueber `uploadLocalNotes`.
   */
  const resyncForUser = useCallback(async (userId: string, mode: ResyncMode = 'replace') => {
    clearUserIdCache();
    if (!isSyncConfigured()) return;
    await startSync(userId, mode);
  }, [startSync]);

  /**
   * Einmaliger Upload der lokalen Notizen bei Erstregistrierung.
   *
   * Der Merker wird VOR dem Versuch gesetzt, damit ein Absturz mitten im
   * Upload den Retry nicht verliert. Er faellt erst, wenn die Outbox leer ist.
   * Wirft bei Fehler — der Aufrufer zeigt daraufhin einen sichtbaren Retry.
   */
  const uploadLocalNotes = useCallback(async (userId: string) => {
    clearUserIdCache();
    if (!isSyncConfigured()) return;
    await markInitialUploadPending();
    setInitialUploadPending(true);

    // `notes.id` ist GLOBAL eindeutig (Primary Key ueber alle User). Wurde eine
    // Notiz schon einmal in ein anderes Konto hochgeladen, gehoert die Zeile
    // dort — RLS laesst sie fuer das neue Konto weder lesen noch ueberschreiben,
    // und der Upsert scheitert. Solche Notizen bekommen deshalb eine neue ID,
    // bevor sie in das neue Konto wandern.
    const previousUid = await loadSyncUid();
    if (previousUid && previousUid !== userId) {
      // Geplante Erinnerungen tragen die alte noteId in ihren Daten und muessen
      // danach neu angemeldet werden.
      const reIded = allRef.current.map((n) => ({ ...n, id: uuidv4(), notificationId: null }));
      pendingRef.current = new Set();
      tombstonesRef.current = new Set();
      await saveTombstones([]).catch(() => {});
      await commit(reIded);
      await rescheduleAllRemindersRef.current().catch((e) =>
        console.warn('[sync] reschedule after re-id failed', e));
    }

    // Alles Lokale in die Outbox, damit auch bereits bestaetigte Notizen aus
    // der Zeit vor der Registrierung im Konto landen.
    for (const n of allRef.current) pendingRef.current.add(n.id);
    await savePendingSync(Array.from(pendingRef.current));
    try {
      await startSync(userId, 'merge');
      if (pendingRef.current.size > 0) {
        throw new Error(`${pendingRef.current.size} Notiz(en) konnten nicht hochgeladen werden`);
      }
    } catch (e) {
      // Merker bleibt stehen → Retry ueberlebt den Neustart.
      throw e;
    }
    await clearInitialUploadPending();
    setInitialUploadPending(false);
  }, [startSync]);

  /**
   * Sync abschalten, lokalen Bestand unveraendert behalten. Beim Abmelden geht
   * die App damit zurueck nach `local` — es wird KEIN neuer User erzeugt und
   * nichts geloescht.
   */
  const detachSync = useCallback(async () => {
    if (unsubscribeRef.current) {
      try { unsubscribeRef.current(); } catch {}
      unsubscribeRef.current = null;
    }
    deviceIdRef.current = null;
    clearUserIdCache();
    // Die Outbox gehoert zum abgemeldeten Konto. Bliebe sie stehen, wuerde sie
    // beim naechsten Anmelden in ein FREMDES Konto geschrieben. Der Aufrufer
    // hat vorher `flushPending()` ausgefuehrt; was hier noch liegt, ist bereits
    // hochgeladen oder gehoert nicht in das naechste Konto.
    pendingRef.current = new Set();
    await savePendingSync([]).catch(() => {});
    // Zuletzt gesyncte UID vergessen, damit `identityChanged` beim naechsten
    // Sync korrekt greift.
    await clearSyncUid().catch(() => {});
    // Der Tier gehoert zum abgemeldeten Konto. Zurueck auf "unbekannt", damit
    // die UI nichts aus dem alten Konto behauptet.
    await clearTierCache().catch(() => {});
    serverTierSeenRef.current = false;
    setTier(null);
    setNextAllowedAt(null);
  }, []);

  return (
    <NotesContext.Provider
      value={{
        notes,
        archivedNotes,
        categories,
        loading,
        tier,
        tierKnown: tier !== null,
        nextAllowedAt,
        refreshSubscription,
        setServerNextAllowedAt,
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
        uploadLocalNotes,
        initialUploadPending,
        detachSync,
        flushPending,
        deleteAllData,
      }}
    >
      {children}
    </NotesContext.Provider>
  );
}

export const useNotes = () => useContext(NotesContext);
