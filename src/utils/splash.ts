import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';

/** Notbremse: so lange darf der native Startbildschirm höchstens stehen bleiben (ab App-Mount). */
export const SPLASH_FALLBACK_MS = 8000;

let hidden = false;

/** Blendet den nativen Startbildschirm genau einmal aus (weitere Aufrufe sind No-ops). */
export function hideSplashOnce(): void {
  if (hidden) return;
  hidden = true;
  SplashScreen.hideAsync().catch(() => {});
}

/** Nur für Tests. */
export function __resetSplashForTests(): void {
  hidden = false;
}

/**
 * Blendet den Startbildschirm aus, sobald `ready` wahr ist — und spätestens nach
 * `SPLASH_FALLBACK_MS` ab dem ersten Mount, egal ob `ready` je wahr wird. Die Notbremse
 * muss ab Mount laufen: hängt etwas vor dem eigentlichen App-Baum (Schriften, Onboarding-Flag,
 * ein Layout-Event, das nie kommt), bliebe das Logo sonst für immer stehen.
 */
export function useSplashHide(ready: boolean, fallbackMs: number = SPLASH_FALLBACK_MS): void {
  useEffect(() => {
    const id = setTimeout(hideSplashOnce, fallbackMs);
    return () => clearTimeout(id);
  }, [fallbackMs]);
  useEffect(() => {
    if (ready) hideSplashOnce();
  }, [ready]);
}
