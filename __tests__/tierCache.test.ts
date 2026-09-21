/**
 * Tier-Cache: der zuletzt bestaetigte Abo-Status ueberlebt den Neustart, damit
 * der Upsell beim Kaltstart nicht aufblitzt.
 *
 * Der Cache ist an die UID gebunden — ein Pro-Status darf nicht ins naechste
 * Konto lecken. Dieselbe Sorgfalt gilt schon fuer Outbox und `@notizapp_sync_uid`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadTierCache, saveTierCache, clearTierCache } from '../src/storage/noteStorage';

const KEY = '@notizapp_tier_cache';

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('gespeicherter Tier wird fuer dieselbe UID zurueckgegeben', async () => {
  await saveTierCache({ uid: 'u1', tier: 'pro' });

  const cache = await loadTierCache('u1');
  expect(cache).toEqual({ uid: 'u1', tier: 'pro' });
});

test('Cache eines FREMDEN Kontos wird verworfen', async () => {
  await saveTierCache({ uid: 'u1', tier: 'pro' });

  // Anderes Konto angemeldet: der Pro-Status von u1 gilt hier nicht.
  expect(await loadTierCache('u2')).toBeNull();
});

test('ohne UID (abgemeldet) gibt es keinen Cache-Treffer', async () => {
  await saveTierCache({ uid: 'u1', tier: 'pro' });

  expect(await loadTierCache(null)).toBeNull();
});

test('leerer Speicher liefert null statt zu werfen', async () => {
  expect(await loadTierCache('u1')).toBeNull();
});

test('kaputter JSON-Inhalt liefert null statt zu werfen', async () => {
  await AsyncStorage.setItem(KEY, '{nicht json');

  expect(await loadTierCache('u1')).toBeNull();
});

test('clearTierCache entfernt den Eintrag', async () => {
  await saveTierCache({ uid: 'u1', tier: 'pro' });
  await clearTierCache();

  expect(await loadTierCache('u1')).toBeNull();
});
