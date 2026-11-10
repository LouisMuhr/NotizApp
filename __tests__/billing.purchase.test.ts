/**
 * Kauf-Ablauf in der App: nur Android + bestaetigtes Konto, Planwechsel ersetzt
 * das alte Abo, Abbruch ist kein Fehler, nach dem Kauf gleicht die Bridge ab.
 */
jest.mock('../src/sync/accountState', () => ({ getSyncUserId: jest.fn() }));
jest.mock('../src/sync/supabaseClient', () => ({ getSupabase: jest.fn() }));
jest.mock('../src/sync/bridge', () => ({ BRIDGE_URL: 'https://bridge.test', bridgePost: jest.fn() }));

import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

const { getSyncUserId } = require('../src/sync/accountState') as { getSyncUserId: jest.Mock };
const { getSupabase } = require('../src/sync/supabaseClient') as { getSupabase: jest.Mock };
const { bridgePost } = require('../src/sync/bridge') as { bridgePost: jest.Mock };
const billing = require('../src/sync/billing') as typeof import('../src/sync/billing');
const { subscriptionService } = require('../src/sync/subscriptionService') as typeof import('../src/sync/subscriptionService');

const P = Purchases as unknown as Record<string, jest.Mock>;
const UID = 'u-1';

function pkg(id: string, product: string) {
  return { identifier: id, product: { identifier: product, priceString: id === 'basic_monthly' ? '1,99 €' : '4,99 €' } };
}

beforeEach(() => {
  jest.clearAllMocks();
  billing.__resetBillingForTests();
  (Platform as any).OS = 'android';
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY = 'goog_test';
  getSyncUserId.mockResolvedValue(UID);
  getSupabase.mockReturnValue({
    auth: { getSession: async () => ({ data: { session: { access_token: 'tok', user: { id: UID } } } }) },
  });
  P.getOfferings.mockResolvedValue({
    current: { availablePackages: [pkg('basic_monthly', 'velm_basic:monthly'), pkg('pro_monthly', 'velm_pro:monthly')] },
  });
  P.getCustomerInfo.mockResolvedValue({ entitlements: { active: {} } });
  P.purchasePackage.mockResolvedValue({ customerInfo: { entitlements: { active: {} } }, productIdentifier: '' });
  P.restorePurchases.mockResolvedValue({ entitlements: { active: {} } });
  bridgePost.mockResolvedValue({ ok: true, json: async () => ({ ok: true, tier: 'basic' }) });
});

test('iOS: kein Kauf, Hinweis "noch nicht verfuegbar"', async () => {
  (Platform as any).OS = 'ios';
  expect(await subscriptionService.openUpgradeFlow('basic')).toEqual({ kind: 'unavailable' });
  expect(P.purchasePackage).not.toHaveBeenCalled();
});

test('ohne RevenueCat-Key: nicht verfuegbar', async () => {
  delete process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  expect((await subscriptionService.openUpgradeFlow('basic')).kind).toBe('unavailable');
});

test('ohne bestaetigtes Konto: kein Kauf, Verweis aufs Konto', async () => {
  getSyncUserId.mockResolvedValue(null);
  expect(await subscriptionService.openUpgradeFlow('pro')).toEqual({ kind: 'needs_account' });
  expect(P.purchasePackage).not.toHaveBeenCalled();
});

test('Kauf laeuft unter der Supabase-UID und wird danach serverseitig abgeglichen', async () => {
  const r = await subscriptionService.openUpgradeFlow('basic');
  expect(P.configure).toHaveBeenCalledWith({ apiKey: 'goog_test', appUserID: UID });
  expect(P.purchasePackage.mock.calls[0][0].identifier).toBe('basic_monthly');
  expect(P.purchasePackage.mock.calls[0][2]).toBeNull();
  expect(bridgePost).toHaveBeenCalledWith('/api/billing-sync', 'tok');
  expect(r).toEqual({ kind: 'purchased', synced: true });
});

test('Basic → Pro ersetzt das laufende Google-Abo', async () => {
  P.getCustomerInfo.mockResolvedValue({
    entitlements: { active: { basic: { productIdentifier: 'velm_basic:monthly' } } },
  });
  await subscriptionService.openUpgradeFlow('pro');
  expect(P.purchasePackage.mock.calls[0][2]).toEqual({ oldProductIdentifier: 'velm_basic', prorationMode: 1 });
});

test('Abbruch im Store-Dialog ist kein Fehler und gleicht nichts ab', async () => {
  P.purchasePackage.mockRejectedValue({ code: '1', userCancelled: true });
  expect(await subscriptionService.openUpgradeFlow('basic')).toEqual({ kind: 'cancelled' });
  expect(bridgePost).not.toHaveBeenCalled();
});

test('Abgleich scheitert: Kauf gilt trotzdem, Freischaltung "kommt nach"', async () => {
  bridgePost.mockRejectedValue(new Error('offline'));
  expect(await subscriptionService.openUpgradeFlow('basic')).toEqual({ kind: 'purchased', synced: false });
});

test('Paket fehlt im Offering → no_product', async () => {
  P.getOfferings.mockResolvedValue({ current: { availablePackages: [] } });
  expect((await subscriptionService.openUpgradeFlow('pro')).kind).toBe('no_product');
});

test('Wiederherstellen ohne aktives Abo → nothing', async () => {
  expect(await subscriptionService.restorePurchases()).toEqual({ kind: 'nothing' });
  expect(bridgePost).not.toHaveBeenCalled();
});

test('Wiederherstellen mit Abo → restored + Abgleich', async () => {
  P.restorePurchases.mockResolvedValue({ entitlements: { active: { pro: {} } } });
  expect(await subscriptionService.restorePurchases()).toEqual({ kind: 'restored', synced: true });
});

test('Store-Preise ersetzen die festen Preise', async () => {
  expect(await billing.getStorePrices(null)).toEqual({ basic: '1,99 €', pro: '4,99 €' });
  expect(P.configure).toHaveBeenCalledWith({ apiKey: 'goog_test' });
});
