import { Note } from '../models/Note';

/**
 * Reine Merge-Helfer fuer den Notiz-Sync. Kein IO, damit die Regeln
 * isoliert testbar sind.
 *
 * Grundmodell: aktive und archivierte Notizen sind EIN Bestand; `archivedAt`
 * entscheidet, in welcher Liste eine Notiz angezeigt wird. Konflikte werden
 * pro Zeile per Last-Writer-Wins auf `updatedAt` aufgeloest (Entscheidung 8).
 */

const ts = (iso: string | null | undefined) => (iso ? Date.parse(iso) : 0);

export const isArchived = (n: Note) => Boolean(n.archivedAt);

export function sortByUpdated(list: Note[]): Note[] {
  return [...list].sort((a, b) => ts(b.updatedAt) - ts(a.updatedAt));
}

export function splitArchive(all: Note[]): { active: Note[]; archived: Note[] } {
  const active: Note[] = [];
  const archived: Note[] = [];
  for (const n of all) (isArchived(n) ? archived : active).push(n);
  return { active: sortByUpdated(active), archived: sortByUpdated(archived) };
}

/**
 * Fuehrt die beiden lokalen Speicher (Notizen + Archiv) zu einem Bestand
 * zusammen. Doppelvorkommen (z. B. Prozess-Kill zwischen zwei Writes) werden
 * per LWW aufgeloest; Eintraege aus dem Archiv-Speicher ohne `archivedAt`
 * (Altbestand) gelten als archiviert.
 */
export function mergeLocalStores(notesStore: Note[], archiveStore: Note[], tombstones: Set<string>): Note[] {
  const byId = new Map<string, Note>();
  const consider = (n: Note) => {
    if (tombstones.has(n.id)) return;
    const existing = byId.get(n.id);
    if (!existing || ts(n.updatedAt) > ts(existing.updatedAt)) byId.set(n.id, n);
  };
  for (const n of archiveStore) consider({ ...n, archivedAt: n.archivedAt ?? n.updatedAt });
  for (const n of notesStore) consider({ ...n, archivedAt: n.archivedAt ?? null });
  return Array.from(byId.values());
}

export interface RemoteMergeInput {
  local: Note[];
  remote: Note[];
  /** IDs mit lokal unbestaetigten Aenderungen. */
  pending: Set<string>;
  /** true, wenn der Bestand zuletzt mit einer anderen (oder keiner) UID abgeglichen wurde. */
  identityChanged: boolean;
  tombstones: Set<string>;
}

export interface RemoteMergeResult {
  merged: Note[];
  /** Lokale Staende, die remote fehlen oder neuer sind → hochladen. */
  toUpload: Note[];
}

/**
 * Regeln (Entscheidung 10: lokale Notizen werden nie stillschweigend verworfen):
 * - remote vorhanden, lokal neuer            → lokal gewinnt, wird hochgeladen
 * - remote vorhanden, remote neuer/gleich    → remote gewinnt (notificationId bleibt lokal)
 * - remote fehlt, lokal pending oder UID neu → lokal bleibt, wird hochgeladen
 * - remote fehlt, lokal bestaetigt, UID gleich → wurde anderswo endgueltig geloescht → entfaellt
 */
export function mergeWithRemote(input: RemoteMergeInput): RemoteMergeResult {
  const { local, remote, pending, identityChanged, tombstones } = input;
  const byId = new Map<string, Note>();
  const toUpload: Note[] = [];

  for (const r of remote) {
    if (tombstones.has(r.id)) continue;
    byId.set(r.id, { ...r, archivedAt: r.archivedAt ?? null });
  }

  for (const l of local) {
    if (tombstones.has(l.id)) continue;
    const r = byId.get(l.id);
    if (!r) {
      if (pending.has(l.id) || identityChanged) {
        byId.set(l.id, l);
        toUpload.push(l);
      }
      continue;
    }
    if (ts(l.updatedAt) > ts(r.updatedAt)) {
      byId.set(l.id, l);
      toUpload.push(l);
    } else {
      byId.set(l.id, { ...r, notificationId: l.notificationId });
    }
  }

  return { merged: Array.from(byId.values()), toUpload };
}

/** Wendet ein einzelnes Realtime-Ereignis (INSERT/UPDATE) per LWW an. */
export function applyIncoming(all: Note[], incoming: Note, tombstones: Set<string>): Note[] | null {
  if (tombstones.has(incoming.id)) return null;
  const idx = all.findIndex((n) => n.id === incoming.id);
  const row = { ...incoming, archivedAt: incoming.archivedAt ?? null };
  if (idx === -1) return [row, ...all];
  const current = all[idx];
  if (ts(current.updatedAt) > ts(row.updatedAt)) return null; // lokal neuer → nichts tun
  const next = [...all];
  next[idx] = { ...row, notificationId: current.notificationId };
  return next;
}

/** Liefert einen Zeitstempel, der garantiert nach `previousIso` liegt. */
export function nextTimestamp(previousIso?: string | null): string {
  return new Date(Math.max(Date.now(), ts(previousIso) + 1)).toISOString();
}
