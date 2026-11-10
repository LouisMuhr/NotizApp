/**
 * Store-Kaeufe ueber RevenueCat (vorerst nur Google Play).
 *
 * Die App entscheidet nie selbst ueber den Tier: Nach Kauf/Wiederherstellen
 * bittet sie die Bridge um einen Abgleich (`/api/billing-sync`), die bei
 * RevenueCat nachfragt und `profiles.tier` schreibt. Zusaetzlich haelt der
 * RevenueCat-Webhook den Stand bei Verlaengerung/Kuendigung/Ablauf aktuell.
 *
 * Gekauft wird immer unter der Supabase-UID (`appUserID`), damit das Abo am
 * Konto haengt und nicht am Geraet. Ohne bestaetigtes Konto kein Kauf.
 *
 * `Platform` wird nur in Funktionen gelesen, nie beim Import (Tests mocken
 * react-native teils ohne Platform).
 */
import { Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  PRORATION_MODE,
  PURCHASES_ERROR_CODE,
  PurchasesPackage,
} from 'react-native-purchases';
import { bridgePost, BRIDGE_URL } from './bridge';
import type { Tier } from './subscriptionService';

export type PaidTier = 'basic' | 'pro';

/** Paket-IDs im RevenueCat-Offering „default". */
export const PACKAGE_ID: Record<PaidTier, string> = { basic: 'basic_monthly', pro: 'pro_monthly' };

export const ANDROID_PACKAGE = 'com.velm.app';
export const MANAGE_SUBSCRIPTIONS_URL =
  `https://play.google.com/store/account/subscriptions?package=${ANDROID_PACKAGE}`;

function androidKey(): string | undefined {
  return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || undefined;
}

export function isBillingAvailable(): boolean {
  return Platform.OS === 'android' && !!androidKey() && !!BRIDGE_URL;
}

const ANON = '$anon';
let configuredFor: string | null = null;

/** Konfiguriert das SDK bzw. wechselt auf den User. uid null = nur Preise lesen (anonym). */
async function ensureUser(uid: string | null): Promise<void> {
  const key = androidKey();
  if (!key) throw new Error('billing not configured');
  if (configuredFor === null) {
    Purchases.configure(uid ? { apiKey: key, appUserID: uid } : { apiKey: key });
    configuredFor = uid ?? ANON;
    return;
  }
  if (uid && configuredFor !== uid) {
    await Purchases.logIn(uid);
    configuredFor = uid;
  }
}

/** Nur fuer Tests. */
export function __resetBillingForTests(): void {
  configuredFor = null;
}

async function findPackage(target: PaidTier): Promise<PurchasesPackage | null> {
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages.find((p) => p.identifier === PACKAGE_ID[target]) ?? null;
}

/** Lokalisierte Store-Preise ("1,99 €"); fehlt etwas, bleibt der Text aus i18n. */
export async function getStorePrices(uid: string | null): Promise<Partial<Record<PaidTier, string>>> {
  if (!isBillingAvailable()) return {};
  try {
    await ensureUser(uid);
    const offerings = await Purchases.getOfferings();
    const out: Partial<Record<PaidTier, string>> = {};
    for (const tier of ['basic', 'pro'] as const) {
      const pkg = offerings.current?.availablePackages.find((p) => p.identifier === PACKAGE_ID[tier]);
      if (pkg) out[tier] = pkg.product.priceString;
    }
    return out;
  } catch {
    return {};
  }
}

/** Google-Abo-ID ohne Basis-Plan ("velm_basic:monthly" → "velm_basic"). */
export function subscriptionIdOf(productIdentifier: string): string {
  return productIdentifier.split(':')[0];
}

/** Produkt des aktiven Abos (fuer den Planwechsel Basic → Pro). */
export function activeProductOf(info: CustomerInfo): string | null {
  const active = Object.values(info.entitlements.active ?? {});
  return active[0]?.productIdentifier ?? null;
}

export type PurchaseOutcome =
  | 'purchased'
  | 'cancelled'
  | 'pending'
  | 'already_owned'
  | 'no_product'
  | 'network'
  | 'not_allowed'
  | 'store_error';

export function mapPurchaseError(e: unknown): PurchaseOutcome {
  const code = (e as { code?: string } | null)?.code;
  switch (code) {
    case PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR: return 'cancelled';
    case PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR: return 'pending';
    case PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR: return 'already_owned';
    case PURCHASES_ERROR_CODE.NETWORK_ERROR: return 'network';
    case PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR: return 'not_allowed';
    default:
      if ((e as { userCancelled?: boolean } | null)?.userCancelled) return 'cancelled';
      return 'store_error';
  }
}

export async function purchaseTier(uid: string, target: PaidTier): Promise<PurchaseOutcome> {
  try {
    await ensureUser(uid);
    const pkg = await findPackage(target);
    if (!pkg) return 'no_product';

    // Planwechsel innerhalb von Google Play: altes Abo ersetzen statt zweites abschliessen.
    const old = activeProductOf(await Purchases.getCustomerInfo());
    const change =
      old && subscriptionIdOf(old) !== subscriptionIdOf(pkg.product.identifier)
        ? { oldProductIdentifier: subscriptionIdOf(old), prorationMode: PRORATION_MODE.IMMEDIATE_WITH_TIME_PRORATION }
        : null;

    await Purchases.purchasePackage(pkg, null, change);
    return 'purchased';
  } catch (e) {
    return mapPurchaseError(e);
  }
}

export type RestoreOutcome = 'restored' | 'nothing' | 'network' | 'store_error';

export async function restoreStorePurchases(uid: string): Promise<RestoreOutcome> {
  try {
    await ensureUser(uid);
    const info = await Purchases.restorePurchases();
    return Object.keys(info.entitlements.active ?? {}).length > 0 ? 'restored' : 'nothing';
  } catch (e) {
    return mapPurchaseError(e) === 'network' ? 'network' : 'store_error';
  }
}

/** Bittet die Bridge, den Tier mit RevenueCat abzugleichen. null = hat nicht geklappt (Webhook holt es nach). */
export async function syncTierWithServer(accessToken: string): Promise<Tier | null> {
  try {
    const res = await bridgePost('/api/billing-sync', accessToken);
    if (!res.ok) return null;
    const body = await res.json();
    return body?.tier ?? null;
  } catch {
    return null;
  }
}

/** Beim Abmelden/Trennen: Kaeufe nicht unter dem alten Konto weiterlaufen lassen. */
export async function logOutBilling(): Promise<void> {
  if (configuredFor === null || configuredFor === ANON) return;
  try {
    await Purchases.logOut();
  } catch { /* anonym oder offline — beim naechsten Kauf meldet logIn() ohnehin um */ }
  configuredFor = ANON;
}
