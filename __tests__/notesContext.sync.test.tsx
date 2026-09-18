/**
 * Phase-2-Tests: Sync-/Offline-Edge-Cases in NotesContext.
 *
 * Jeder Test ist nach der ID aus der Phase-1-Liste benannt und prueft das
 * ERWARTETE Verhalten laut Spezifikation/Produktentscheidung. Ein roter Test
 * bedeutet: der Edge-Case ist ein Bug im aktuellen Code.
 *
 * Aufbau: echtes AsyncStorage-Mock (persistiert innerhalb eines Tests ueber
 * Remounts), simulierte Remote-Tabelle als Map, Sync-Layer gemockt.
 */
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotesProvider, useNotes } from '../src/context/NotesContext';
import { Note } from '../src/models/Note';
import { saveNotes, saveArchive, loadNotes, loadArchive } from '../src/storage/noteStorage';
import { makeNote, iso, HOUR, DAY } from './helpers/notes';

jest.mock('../src/utils/notifications', () => ({
  scheduleReminder: jest.fn(async () => 'notif-id'),
  cancelReminder: jest.fn(async () => {}),
  cancelAllReminders: jest.fn(async () => {}),
}));
jest.mock('../src/utils/haptics', () => ({
  loadHapticsPref: jest.fn(async () => {}),
  success: jest.fn(), light: jest.fn(), medium: jest.fn(), tap: jest.fn(),
}));
jest.mock('../src/sync/subscriptionService', () => ({
  subscriptionService: { getStatus: jest.fn(async () => ({ tier: 'free', nextAllowedAt: null })) },
}));
jest.mock('../src/sync/supabaseClient', () => ({
  isSyncConfigured: () => true,
  getSupabase: () => null,
}));
jest.mock('../src/sync/userId', () => ({
  getUserId: jest.fn(),
  clearUserIdCache: jest.fn(),
}));
jest.mock('../src/sync/remoteNotes', () => ({
  pullRemote: jest.fn(),
  upsertRemote: jest.fn(),
  deleteRemote: jest.fn(),
  subscribeRemote: jest.fn(() => () => {}),
}));

const userId = require('../src/sync/userId') as { getUserId: jest.Mock };
const remoteNotes = require('../src/sync/remoteNotes') as {
  pullRemote: jest.Mock; upsertRemote: jest.Mock; deleteRemote: jest.Mock; subscribeRemote: jest.Mock;
};

// ---------------------------------------------------------------------------
// Simulierte Remote-Tabelle
// ---------------------------------------------------------------------------
const remote = new Map<string, Note>();
let online = true;

function wireRemote() {
  remoteNotes.pullRemote.mockImplementation(async () => (online ? Array.from(remote.values()) : null));
  // Mit `patch` schreibt der Sync-Layer nur die geaenderten Spalten (wie PostgREST PATCH);
  // ohne `patch` die ganze Zeile. Der Mock bildet genau diese Server-Semantik ab.
  remoteNotes.upsertRemote.mockImplementation(async (_uid: string, note: Note, patch?: Partial<Note>) => {
    if (!online) throw new Error('network request failed');
    const existing = remote.get(note.id);
    if (patch && existing) {
      remote.set(note.id, { ...existing, ...patch, updatedAt: note.updatedAt });
    } else {
      remote.set(note.id, { ...note, notificationId: null });
    }
  });
  remoteNotes.deleteRemote.mockImplementation(async (_uid: string, ids: string[]) => {
    if (!online) throw new Error('network request failed');
    ids.forEach((id) => remote.delete(id));
  });
}

const wrapper = ({ children }: { children: React.ReactNode }) => <NotesProvider>{children}</NotesProvider>;

/** Mountet den Provider und wartet, bis der Start-Sync durch ist. */
async function mountSynced() {
  const subscribeCallsBefore = remoteNotes.subscribeRemote.mock.calls.length;
  const hook = renderHook(() => useNotes(), { wrapper });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  if (online && userId.getUserId.mock.results.length >= 0) {
    // subscribeRemote wird erst NACH Merge + saveNotes aufgerufen
    await waitFor(() => expect(remoteNotes.subscribeRemote.mock.calls.length).toBeGreaterThan(subscribeCallsBefore));
  }
  // einen Tick fuer setState nach dem Merge
  await act(async () => { await Promise.resolve(); });
  return hook;
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  remote.clear();
  online = true;
  wireRemote();
  userId.getUserId.mockResolvedValue('user-1');
});

// ---------------------------------------------------------------------------
// S1 — offline erstellte Notiz ueberlebt den naechsten Online-Start
// ---------------------------------------------------------------------------
test('S1: lokale Notiz ohne Remote-Gegenstueck bleibt beim Start-Merge erhalten und wird hochgeladen', async () => {
  const offlineNote = makeNote({ id: 'offline-1', content: 'nur lokal' });
  await saveNotes([offlineNote]);
  // Remote ist leer: die Notiz wurde nie hochgeladen (App war offline).

  const hook = await mountSynced();

  expect(hook.result.current.notes.map((n) => n.id)).toContain('offline-1');
  expect(await loadNotes()).toHaveLength(1);
  expect(remote.has('offline-1')).toBe(true); // muss nachgeschickt werden
});

// ---------------------------------------------------------------------------
// S2 — offline bearbeitete Notiz wird beim Start nachgeschickt
// ---------------------------------------------------------------------------
test('S2: lokal neuere Version einer Remote-Notiz wird beim Start-Merge hochgeladen', async () => {
  remote.set('n1', makeNote({ id: 'n1', content: 'alt', updatedAt: iso(-2 * HOUR) }));
  await saveNotes([makeNote({ id: 'n1', content: 'offline geaendert', updatedAt: iso(-1 * HOUR) })]);

  const hook = await mountSynced();

  expect(hook.result.current.notes[0].content).toBe('offline geaendert'); // lokal gewinnt (ok)
  expect(remote.get('n1')?.content).toBe('offline geaendert'); // ... und muss remote landen
});

// ---------------------------------------------------------------------------
// S3 — neue Identitaet nach Session-Verlust loescht nicht die lokale Bibliothek
// ---------------------------------------------------------------------------
test('S3: leeres Remote (neue UID nach Token-Verlust) loescht keine lokalen Notizen', async () => {
  await saveNotes([makeNote({ id: 'a' }), makeNote({ id: 'b' }), makeNote({ id: 'c' })]);
  userId.getUserId.mockResolvedValue('fresh-user'); // alte Session weg → neue UID, remote leer

  const hook = await mountSynced();

  expect(hook.result.current.notes).toHaveLength(3);
  expect(await loadNotes()).toHaveLength(3);
});

// ---------------------------------------------------------------------------
// S4 — mehr als 1000 Notizen (PostgREST-Default-Cap)
// ---------------------------------------------------------------------------
test('S4: 1200 synchronisierte Notizen ueberleben einen Start, bei dem der Pull auf 1000 Zeilen gedeckelt ist', async () => {
  const all: Note[] = [];
  for (let i = 0; i < 1200; i++) all.push(makeNote({ id: `n-${i}` }));
  await saveNotes(all);
  all.forEach((n) => remote.set(n.id, n));
  // PostgREST liefert ohne Pagination maximal 1000 Zeilen:
  remoteNotes.pullRemote.mockImplementation(async () => Array.from(remote.values()).slice(0, 1000));

  const hook = await mountSynced();

  expect(hook.result.current.notes).toHaveLength(1200);
});

// ---------------------------------------------------------------------------
// S5 — Stale-Edit ueber zwei Geraete (Realtime nur INSERT)
// ---------------------------------------------------------------------------
test('S5: Pin auf Geraet A ueberschreibt nicht den neueren Text von Geraet B', async () => {
  remote.set('n1', makeNote({ id: 'n1', content: 'Original', updatedAt: iso(-3 * HOUR) }));
  const hook = await mountSynced();
  expect(hook.result.current.notes[0].content).toBe('Original');

  // Geraet B aendert den Text (A bekommt kein UPDATE-Event, nur INSERTs sind abonniert)
  remote.set('n1', makeNote({ id: 'n1', content: 'Neuer Text von B', updatedAt: iso(-1 * HOUR) }));

  // Geraet A pinnt die Notiz (kennt nur den alten Text)
  await act(async () => { await hook.result.current.togglePin('n1'); });
  await waitFor(() => expect(remoteNotes.upsertRemote).toHaveBeenCalled());

  expect(remote.get('n1')?.isPinned).toBe(true);
  expect(remote.get('n1')?.content).toBe('Neuer Text von B'); // darf nicht verloren gehen
});

// ---------------------------------------------------------------------------
// S6 — Start offline, Notiz erstellt, spaeter online
// ---------------------------------------------------------------------------
test('S6: offline erstellte Notiz wird nach dem naechsten Online-Start nachgeschickt und bleibt erhalten', async () => {
  // Start offline: keine Auth moeglich
  userId.getUserId.mockResolvedValue(null);
  online = false;
  let hook = renderHook(() => useNotes(), { wrapper });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  await act(async () => { await hook.result.current.addNote({ ...makeNote({ id: 'x' }), title: 'Offline-Notiz' }); });
  expect(remoteNotes.upsertRemote).not.toHaveBeenCalled(); // kein deviceId → kein Push, kein Retry
  hook.unmount();

  // Neustart online
  online = true;
  userId.getUserId.mockResolvedValue('user-1');
  hook = await mountSynced();

  expect(hook.result.current.notes.map((n) => n.title)).toContain('Offline-Notiz');
  expect(Array.from(remote.values()).map((n) => n.title)).toContain('Offline-Notiz');
});

// ---------------------------------------------------------------------------
// S7/S8 — Konflikt zweier Geraete: ganze Zeile, neuere Uhr gewinnt (per Entscheidung 8 akzeptiert)
// ---------------------------------------------------------------------------
test('S7/S8: Ganze-Zeile-LWW nach Client-Uhr — Geraet mit vorgestellter Uhr gewinnt immer', async () => {
  remote.set('n1', makeNote({ id: 'n1', content: 'B: Text geaendert', checklist: [], updatedAt: iso(0) }));
  // Lokale Uhr laeuft 2 Tage vor; lokal wurde nur die Checkliste angefasst
  await saveNotes([makeNote({
    id: 'n1', content: 'Original', updatedAt: iso(2 * DAY),
    checklist: [{ id: 'c1', text: 'A: abgehakt', checked: true }],
  })]);

  const hook = await mountSynced();

  expect(hook.result.current.notes[0].content).toBe('Original'); // B's Textaenderung ist weg
  expect(hook.result.current.notes[0].checklist).toHaveLength(1);
});

// ---------------------------------------------------------------------------
// S9 — Archiv ist geraetelokal: Purge loescht remote, was ein anderes Geraet neu angelegt hat
// ---------------------------------------------------------------------------
test('S9: archivierte Notiz wird beim Start nicht destruktiv remote geloescht (Entscheidung: archived_at statt delete)', async () => {
  await saveArchive([makeNote({ id: 'arch-1', content: 'auf B archiviert' })]);
  // Geraet A hat sie inzwischen bearbeitet und damit remote neu angelegt
  remote.set('arch-1', makeNote({ id: 'arch-1', content: 'A: weiter bearbeitet', updatedAt: iso(-1 * HOUR) }));

  await mountSynced();

  expect(remote.has('arch-1')).toBe(true);
  expect(remoteNotes.deleteRemote).not.toHaveBeenCalledWith('user-1', expect.arrayContaining(['arch-1']));
});

// ---------------------------------------------------------------------------
// S12 — Pull schlaegt fehl: lokale Daten bleiben
// ---------------------------------------------------------------------------
test('S12: fehlgeschlagener Pull (null) laesst lokale Notizen unangetastet', async () => {
  await saveNotes([makeNote({ id: 'a' }), makeNote({ id: 'b' })]);
  remoteNotes.pullRemote.mockResolvedValue(null);

  const hook = await mountSynced();

  expect(hook.result.current.notes).toHaveLength(2);
  expect(await loadNotes()).toHaveLength(2);
});

// ---------------------------------------------------------------------------
// S13 — zwei Writes im selben Tick
// ---------------------------------------------------------------------------
test('S13: zwei addNote-Aufrufe ohne await dazwischen erzeugen zwei Notizen', async () => {
  const hook = await mountSynced();

  await act(async () => {
    const p1 = hook.result.current.addNote({ ...makeNote({ id: 'tmp1' }), title: 'Erste' });
    const p2 = hook.result.current.addNote({ ...makeNote({ id: 'tmp2' }), title: 'Zweite' });
    await Promise.all([p1, p2]);
  });

  expect(hook.result.current.notes.map((n) => n.title).sort()).toEqual(['Erste', 'Zweite']);
  expect(await loadNotes()).toHaveLength(2);
});

// ---------------------------------------------------------------------------
// A2 — Erstupload bei Registrierung: lokale Notizen landen vollstaendig im Konto
//
// Im Lokal-first-Modell ist das der EINZIGE Weg, auf dem lokaler Bestand in ein
// Konto wandert. Eine spaetere Anmeldung ist dagegen ein Zweitgeraet (siehe A4).
// ---------------------------------------------------------------------------
test('A2: uploadLocalNotes laedt auch bereits bestaetigte lokale Notizen vollstaendig hoch', async () => {
  // Start im Zustand `local`: kein Sync-User, nichts geht raus.
  userId.getUserId.mockResolvedValue(null);
  const hook = renderHook(() => useNotes(), { wrapper });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));

  await act(async () => { await hook.result.current.addNote({ ...makeNote({ id: 'a' }), title: 'Lokal A' }); });
  await act(async () => { await hook.result.current.addNote({ ...makeNote({ id: 'b' }), title: 'Lokal B' }); });
  expect(remoteNotes.upsertRemote).not.toHaveBeenCalled(); // `local` bleibt offline

  // Registrierung bestaetigt → einmaliger Erstupload.
  await act(async () => { await hook.result.current.uploadLocalNotes('account-user'); });

  expect(Array.from(remote.values()).map((n) => n.title).sort()).toEqual(['Lokal A', 'Lokal B']);
  expect(hook.result.current.initialUploadPending).toBe(false);
});

test('A2: scheitert der Erstupload, bleibt er offen und die lokalen Notizen bleiben erhalten', async () => {
  userId.getUserId.mockResolvedValue(null);
  const hook = renderHook(() => useNotes(), { wrapper });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  await act(async () => { await hook.result.current.addNote({ ...makeNote({ id: 'a' }), title: 'Lokal A' }); });

  // Netz weg → Upload scheitert, muss werfen (Aufrufer zeigt Retry).
  online = false;
  await act(async () => {
    await expect(hook.result.current.uploadLocalNotes('account-user')).rejects.toThrow();
  });

  expect(hook.result.current.initialUploadPending).toBe(true);
  expect(hook.result.current.notes.map((n) => n.title)).toContain('Lokal A');
  expect(await AsyncStorage.getItem('@notizapp_initial_upload_pending')).toBe('1');

  // Retry mit Netz → Upload geht durch, Merker faellt.
  online = true;
  await act(async () => { await hook.result.current.uploadLocalNotes('account-user'); });

  expect(Array.from(remote.values()).map((n) => n.title)).toContain('Lokal A');
  expect(hook.result.current.initialUploadPending).toBe(false);
  expect(await AsyncStorage.getItem('@notizapp_initial_upload_pending')).toBeNull();
});

// ---------------------------------------------------------------------------
// A4 — Anmeldung auf einem Zweitgeraet uebernimmt den Kontostand
// ---------------------------------------------------------------------------
test('A4: resyncForUser (Anmeldung) ersetzt den lokalen Bestand durch den des Kontos', async () => {
  userId.getUserId.mockResolvedValue(null);
  const hook = renderHook(() => useNotes(), { wrapper });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  await act(async () => { await hook.result.current.addNote({ ...makeNote({ id: 'local-only' }), title: 'Nur hier' }); });

  // Im Konto liegt ein anderer Bestand.
  remote.set('konto-1', makeNote({ id: 'konto-1', title: 'Aus dem Konto' }));

  await act(async () => { await hook.result.current.resyncForUser('account-user'); });

  expect(hook.result.current.notes.map((n) => n.title)).toEqual(['Aus dem Konto']);
});

// ---------------------------------------------------------------------------
// L3 — wenig Speicher: Persistieren scheitert
// ---------------------------------------------------------------------------
test('L3: scheitert das Persistieren (ENOSPC), zeigt der State keine Notiz, die nach Neustart weg waere', async () => {
  const hook = await mountSynced();
  // Das AsyncStorage-Mock ist bereits ein jest.fn — nur den naechsten Aufruf scheitern lassen.
  (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('SQLITE_FULL: database or disk is full'));

  let thrown: unknown = null;
  await act(async () => {
    try { await hook.result.current.addNote({ ...makeNote({ id: 'tmp' }), title: 'Passt nicht mehr' }); }
    catch (e) { thrown = e; }
  });

  expect(thrown).not.toBeNull(); // Fehler wird durchgereicht (ok)
  const inState = hook.result.current.notes.some((n) => n.title === 'Passt nicht mehr');
  const onDisk = (await loadNotes()).some((n) => n.title === 'Passt nicht mehr');
  expect(inState).toBe(onDisk); // State und Platte duerfen nicht auseinanderlaufen
});

// ---------------------------------------------------------------------------
// L4 — Kill zwischen den zwei Writes von restoreNote
// ---------------------------------------------------------------------------
test('L4: Prozess-Kill nach dem ersten Write von restoreNote laesst die Notiz nicht im Archiv haengen', async () => {
  await saveArchive([makeNote({ id: 'arch-1' })]);
  let hook = await mountSynced();
  expect(hook.result.current.archivedNotes).toHaveLength(1);

  // notes-Key wird geschrieben, archive-Key nicht mehr (Kill)
  const setItem = AsyncStorage.setItem as jest.Mock;
  const original = setItem.getMockImplementation()!;
  setItem.mockImplementation(async (key: string, value: string) => {
    if (key === '@notizapp_archive') throw new Error('process killed');
    return original(key, value);
  });
  await act(async () => { try { await hook.result.current.restoreNote('arch-1'); } catch {} });
  setItem.mockImplementation(original);
  hook.unmount();

  // Neustart
  hook = await mountSynced();
  const inNotes = hook.result.current.notes.some((n) => n.id === 'arch-1');
  const inArchive = (await loadArchive()).some((n) => n.id === 'arch-1');
  expect(inNotes || inArchive).toBe(true); // kein Datenverlust (erwartet: erfuellt)
  expect(inNotes).toBe(true); // Wiederherstellen darf nicht still verloren gehen
});
