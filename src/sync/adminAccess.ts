import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from './supabaseClient';
import { deriveStateFromUser } from './accountState';

/**
 * Einziger Admin-Account. Reines UI-Gating: die Admin-Werkzeuge (Onboarding
 * zuruecksetzen, Test-Benachrichtigungen) wirken nur lokal auf dem Geraet und
 * beruehren keine Server-Daten. Serverseitig gibt es dafuer keine Rechte.
 */
export const ADMIN_EMAIL = 'louismuhr8@gmail.com';

/** Admin = bestaetigtes Konto mit der Admin-Adresse. Eine unbestaetigte Registrierung zaehlt nie. */
export function isAdminUser(user: User | null): boolean {
  if (!user || deriveStateFromUser(user) !== 'secured') return false;
  return user.email?.trim().toLowerCase() === ADMIN_EMAIL;
}

/**
 * Ob der angemeldete Nutzer Admin ist; `null`, solange die Session noch geladen wird
 * (ein Guard darf erst bei `false` handeln). Liest die lokale Session (kein Server-Call),
 * damit die Admin-Zeilen auch offline erscheinen; folgt An- und Abmeldung live.
 */
export function useIsAdmin(): boolean | null {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setIsAdmin(false);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active) setIsAdmin(isAdminUser(session?.user ?? null));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsAdmin(isAdminUser(session?.user ?? null));
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return isAdmin;
}
