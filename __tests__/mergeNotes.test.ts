/**
 * Regressionstests fuer die reinen Merge-Regeln (Umsetzung Fix-Liste Nr. 3 / 8 / 9).
 */
import { mergeLocalStores, mergeWithRemote, applyIncoming, splitArchive, nextTimestamp } from '../src/sync/mergeNotes';
import { makeNote, iso, HOUR } from './helpers/notes';

const none = new Set<string>();

describe('mergeWithRemote', () => {
  test('lokal-only + pending → bleibt und wird hochgeladen', () => {
    const local = [makeNote({ id: 'a' })];
    const r = mergeWithRemote({ local, remote: [], pending: new Set(['a']), identityChanged: false, tombstones: none });
    expect(r.merged.map((n) => n.id)).toEqual(['a']);
    expect(r.toUpload.map((n) => n.id)).toEqual(['a']);
  });

  test('lokal-only, bestaetigt, gleiche UID → wurde anderswo endgueltig geloescht → entfaellt', () => {
    const local = [makeNote({ id: 'a' })];
    const r = mergeWithRemote({ local, remote: [], pending: none, identityChanged: false, tombstones: none });
    expect(r.merged).toHaveLength(0);
    expect(r.toUpload).toHaveLength(0);
  });

  test('lokal-only, bestaetigt, aber neue UID → bleibt (Entscheidung 10) und wird hochgeladen', () => {
    const local = [makeNote({ id: 'a' })];
    const r = mergeWithRemote({ local, remote: [], pending: none, identityChanged: true, tombstones: none });
    expect(r.merged).toHaveLength(1);
    expect(r.toUpload).toHaveLength(1);
  });

  test('beide vorhanden: neuere Zeile gewinnt, notificationId bleibt lokal', () => {
    const local = [makeNote({ id: 'a', content: 'alt', updatedAt: iso(-2 * HOUR), notificationId: 'n-1' })];
    const remote = [makeNote({ id: 'a', content: 'neu', updatedAt: iso(-1 * HOUR) })];
    const r = mergeWithRemote({ local, remote, pending: none, identityChanged: false, tombstones: none });
    expect(r.merged[0].content).toBe('neu');
    expect(r.merged[0].notificationId).toBe('n-1');
    expect(r.toUpload).toHaveLength(0);
  });

  test('Tombstones filtern remote wie lokal', () => {
    const r = mergeWithRemote({
      local: [makeNote({ id: 'dead' })], remote: [makeNote({ id: 'dead' })],
      pending: none, identityChanged: true, tombstones: new Set(['dead']),
    });
    expect(r.merged).toHaveLength(0);
  });
});

describe('mergeLocalStores / splitArchive', () => {
  test('Altbestand im Archiv-Speicher ohne archivedAt gilt als archiviert', () => {
    const all = mergeLocalStores([], [makeNote({ id: 'a' })], none);
    expect(all[0].archivedAt).toBeTruthy();
    expect(splitArchive(all).archived).toHaveLength(1);
  });

  test('Doppelvorkommen (Kill zwischen zwei Writes): neuerer Stand gewinnt', () => {
    const old = makeNote({ id: 'a', updatedAt: iso(-HOUR) });
    const restored = { ...old, updatedAt: iso(0), archivedAt: null };
    const all = mergeLocalStores([restored], [old], none);
    expect(all).toHaveLength(1);
    expect(splitArchive(all).active).toHaveLength(1);
  });
});

describe('applyIncoming (Realtime)', () => {
  test('aelteres Remote-Event ueberschreibt keinen neueren lokalen Stand', () => {
    const local = [makeNote({ id: 'a', content: 'lokal neu', updatedAt: iso(0) })];
    const next = applyIncoming(local, makeNote({ id: 'a', content: 'remote alt', updatedAt: iso(-HOUR) }), none);
    expect(next).toBeNull();
  });

  test('neueres Remote-Event ersetzt die Zeile, Tombstone blockt', () => {
    const local = [makeNote({ id: 'a', content: 'alt', updatedAt: iso(-HOUR) })];
    const next = applyIncoming(local, makeNote({ id: 'a', content: 'neu', updatedAt: iso(0) }), none)!;
    expect(next[0].content).toBe('neu');
    expect(applyIncoming(local, makeNote({ id: 'a' }), new Set(['a']))).toBeNull();
  });
});

test('nextTimestamp liegt immer nach dem Vorgaenger', () => {
  const future = iso(HOUR);
  expect(Date.parse(nextTimestamp(future))).toBe(Date.parse(future) + 1);
  expect(Date.parse(nextTimestamp(iso(-HOUR)))).toBeGreaterThanOrEqual(Date.now() - 50);
});
