import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from './supabaseClient';

/**
 * Konto-Zustand der App. Drei Zustaende, streng aus den Serverdaten abgeleitet.
 *
 * - `local`                — Notizen liegen ausschliesslich auf dem Geraet. Kein
 *                            Supabase-User, keine UID, kein Sync-Call. Default
 *                            fuer jeden neuen Nutzer, ohne jede Registrierung.
 * - `pending-confirmation` — Registrierung erfolgt, `email_confirmed_at` noch
 *                            null. Sync ist NICHT aktiv.
 * - `secured`              — E-Mail bestaetigt. Erst jetzt laeuft der einmalige
 *                            Upload der lokalen Notizen und danach der Sync.
 *
 * Es gibt bewusst keinen `signed-out`-Zustand mehr: nach dem Abmelden ist die
 * App wieder `local`, und es wird kein neuer (anonymer) User erzeugt.
 */
export type AccountState = 'loading' | 'local' | 'pending-confirmation' | 'secured';

/**
 * E-Mail-Adresse einer laufenden, noch unbestaetigten Registrierung.
 *
 * Nur noetig, weil Supabase bei aktivierter Bestaetigungspflicht nach
 * `signUp()` je nach Projekteinstellung KEINE Session ausgibt: dann existiert
 * beim naechsten Kaltstart kein User, aus dem sich `pending-confirmation`
 * ableiten liesse, und die App fiele auf `local` zurueck.
 *
 * Bewusst die Adresse und kein Status-Flag: der Zustand selbst kommt immer vom
 * Server. Sobald eine Session existiert, gewinnt `email_confirmed_at`.
 */
const PENDING_EMAIL_KEY = '@notizapp_pending_email';

/**
 * Merker fuer den einmaligen Upload der lokalen Notizen bei Erstregistrierung.
 * Gesetzt beim Uebergang nach `secured`, geloescht erst nach erfolgreichem
 * Upload. Ueberlebt einen Neustart, damit der Retry nicht verloren geht.
 */
const INITIAL_UPLOAD_KEY = '@notizapp_initial_upload_pending';

export interface AccountSnapshot {
  state: AccountState;
  /** UID des Users, falls einer existiert — auch im Zustand `pending-confirmation`. */
  userId: string | null;
  /** E-Mail des Users bzw. der ausstehenden Registrierung. */
  email: string | null;
}

/**
 * Zustand aus einem User ableiten. Einzige Wahrheitsquelle ist
 * `email_confirmed_at` — nie ein lokal gesetztes Flag.
 *
 * Altlast: User aus dem frueheren anonymen Modell (`is_anonymous`) zaehlen
 * nicht als Konto. Sie werden beim Start abgemeldet, siehe
 * `isLegacyAnonymous()`.
 */
export function deriveStateFromUser(user: User | null): AccountState {
  if (!user) return 'local';
  if (isLegacyAnonymous(user)) return 'local';
  return user.email_confirmed_at ? 'secured' : 'pending-confirmation';
}

/** Anonymer User aus dem alten Modell — wird beim Start abgemeldet. */
export function isLegacyAnonymous(user: User | null): boolean {
  return Boolean(user?.is_anonymous);
}

/**
 * Aktuellen Konto-Zustand ermitteln.
 *
 * Reihenfolge: existiert eine Session, entscheidet ausschliesslich der User.
 * Nur wenn gar kein User da ist, greift der lokale E-Mail-Merker, um eine
 * Registrierung ohne Session ueber den Neustart zu retten.
 */
export async function resolveAccountState(): Promise<AccountSnapshot> {
  const supabase = getSupabase();
  if (!supabase) return { state: 'local', userId: null, email: null };

  const { data: { user } } = await supabase.auth.getUser();

  if (user && !isLegacyAnonymous(user)) {
    const state = deriveStateFromUser(user);
    // Bestaetigt → ein evtl. noch liegender Merker hat sich erledigt.
    if (state === 'secured') await clearPendingEmail();
    return { state, userId: user.id, email: user.email ?? null };
  }

  const pendingEmail = await loadPendingEmail();
  if (pendingEmail) {
    return { state: 'pending-confirmation', userId: null, email: pendingEmail };
  }
  return { state: 'local', userId: null, email: null };
}

/**
 * UID, mit der synchronisiert werden darf — null in jedem anderen Zustand.
 * Jeder Sync-Einstieg geht hierueber, damit `local` und
 * `pending-confirmation` garantiert offline bleiben.
 */
export async function getSyncUserId(): Promise<string | null> {
  const { state, userId } = await resolveAccountState();
  return state === 'secured' ? userId : null;
}

// ─── Merker: ausstehende Bestaetigung ────────────────────────────────────────

export async function savePendingEmail(email: string): Promise<void> {
  await AsyncStorage.setItem(PENDING_EMAIL_KEY, email);
}

export async function loadPendingEmail(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PENDING_EMAIL_KEY);
  } catch {
    return null;
  }
}

export async function clearPendingEmail(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_EMAIL_KEY).catch(() => {});
}

// ─── Merker: offener Erstupload ──────────────────────────────────────────────

export async function markInitialUploadPending(): Promise<void> {
  await AsyncStorage.setItem(INITIAL_UPLOAD_KEY, '1');
}

export async function isInitialUploadPending(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(INITIAL_UPLOAD_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function clearInitialUploadPending(): Promise<void> {
  await AsyncStorage.removeItem(INITIAL_UPLOAD_KEY).catch(() => {});
}
