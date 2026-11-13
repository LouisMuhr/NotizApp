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

/**
 * Kaufbar ist nur noch Pro, monatlich oder jaehrlich (Google-Abo `velm_pro`,
 * Basis-Abos `monthly`/`yearly`, beide am Entitlement `pro`). Basic gibt es
 * nur noch als Altlast im Tier, gekauft wird es nicht mehr.
 */
export type ProPlan = 'monthly' | 'yearly';

/** Paket-IDs im RevenueCat-Offering „default". */
export const PACKAGE_ID: Record<ProPlan, string> = { monthly: 'pro_monthly', yearly: 'pro_yearly' };

export interface PlanPrice {
  /** Lokalisierter Store-Preis ("4,99 €"). */
  price: string;
  /** Gratis-Testphase in Tagen, wenn Google sie diesem Konto anbietet (sonst fehlt das Feld). */
  trialDays?: number;
}
export type StorePrices = Partial<Record<ProPlan, PlanPrice>>;

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

async function findPackage(plan: ProPlan): Promise<PurchasesPackage | null> {
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages.find((p) => p.identifier === PACKAGE_ID[plan]) ?? null;
}

/** Testphase in Tagen aus der Google-Preisphase; null = keine (oder schon verbraucht). */
export function trialDaysOf(pkg: PurchasesPackage): number | null {
  const period = pkg.product.defaultOption?.freePhase?.billingPeriod;
  if (!period || period.value <= 0) return null;
  switch (period.unit) {
    case 'DAY': return period.value;
    case 'WEEK': return period.value * 7;
    default: return null;
  }
}

/** Lokalisierte Store-Preise; fehlt etwas, bleibt der Text aus i18n. */
export async function getStorePrices(uid: string | null): Promise<StorePrices> {
  if (!isBillingAvailable()) return {};
  try {
    await ensureUser(uid);
    const offerings = await Purchases.getOfferings();
    const out: StorePrices = {};
    for (const plan of ['monthly', 'yearly'] as const) {
      const pkg = offerings.current?.availablePackages.find((p) => p.identifier === PACKAGE_ID[plan]);
      if (!pkg) continue;
      const trialDays = trialDaysOf(pkg);
      out[plan] = trialDays ? { price: pkg.product.priceString, trialDays } : { price: pkg.product.priceString };
    }
    return out;
  } catch {
    return {};
  }
}

/** Google-Abo-ID ohne Basis-Plan ("velm_pro:monthly" → "velm_pro"). */
export function subscriptionIdOf(productIdentifier: string): string {
  return productIdentifier.split(':')[0];
}

/** Produkt des aktiven Abos (fuer den Wechsel von einem Alt-Abo wie velm_basic). */
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

/**
 * Technischer Fehlercode fuer den Dialog ("STORE_PROBLEM (5): Billing unavailable").
 * Nur Codes und Store-Meldung, keine Nutzerdaten. null = nichts Brauchbares.
 */
export function errorDetailOf(e: unknown): string | null {
  const err = e as {
    code?: string | number;
    message?: string;
    readableErrorCode?: string;
    underlyingErrorMessage?: string;
    userInfo?: { readableErrorCode?: string };
  } | null;
  if (!err || typeof err !== 'object') return null;
  const readable = err.userInfo?.readableErrorCode ?? err.readableErrorCode;
  const head = [readable, err.code != null && err.code !== '' ? `(${err.code})` : null].filter(Boolean).join(' ');
  const msg = err.underlyingErrorMessage || err.message;
  const out = [head, msg].filter(Boolean).join(': ');
  return out ? out.slice(0, 300) : null;
}

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

export interface PurchaseAttempt {
  outcome: PurchaseOutcome;
  /** Nur bei Fehlern: technischer Code fuer die Fehlersuche (siehe errorDetailOf). */
  detail?: string;
}

export async function purchasePro(uid: string, plan: ProPlan): Promise<PurchaseAttempt> {
  try {
    await ensureUser(uid);
    const pkg = await findPackage(plan);
    if (!pkg) return { outcome: 'no_product', detail: `package ${PACKAGE_ID[plan]} not in current offering` };

    // Wechsel von einem anderen Google-Abo (Alt-Abo velm_basic): ersetzen statt zweites abschliessen.
    // Monatlich ↔ jaehrlich ist dasselbe Abo (velm_pro), das regelt Google selbst.
    const old = activeProductOf(await Purchases.getCustomerInfo());
    const change =
      old && subscriptionIdOf(old) !== subscriptionIdOf(pkg.product.identifier)
        ? { oldProductIdentifier: subscriptionIdOf(old), prorationMode: PRORATION_MODE.IMMEDIATE_WITH_TIME_PRORATION }
        : null;

    await Purchases.purchasePackage(pkg, null, change);
    return { outcome: 'purchased' };
  } catch (e) {
    const outcome = mapPurchaseError(e);
    if (outcome === 'cancelled') return { outcome };
    const detail = errorDetailOf(e);
    return detail ? { outcome, detail } : { outcome };
  }
}

export type RestoreOutcome = 'restored' | 'nothing' | 'network' | 'store_error';

export async function restoreStorePurchases(uid: string): Promise<{ outcome: RestoreOutcome; detail?: string }> {
  try {
    await ensureUser(uid);
    const info = await Purchases.restorePurchases();
    return { outcome: Object.keys(info.entitlements.active ?? {}).length > 0 ? 'restored' : 'nothing' };
  } catch (e) {
    const outcome = mapPurchaseError(e) === 'network' ? 'network' : 'store_error';
    const detail = errorDetailOf(e);
    return detail ? { outcome, detail } : { outcome };
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
