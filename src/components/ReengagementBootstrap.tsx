import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useNotes } from '../context/NotesContext';
import { useThoughts } from '../context/ThoughtsContext';
import { useLanguage } from '../context/LanguageContext';
import { getSyncUserId } from '../sync/accountState';
import { hasOpenedBefore, markAppOpened, refreshReengagement } from '../utils/reengagementScheduler';

/** Plant die Rückkehr-Benachrichtigungen aus dem aktuellen Notiz-/Thread-Stand neu. */
export function useRefreshReengagement() {
  const { notes } = useNotes();
  const { threads } = useThoughts();
  const { t } = useLanguage();
  const stateRef = useRef({ notes, threads, t });
  stateRef.current = { notes, threads, t };

  return useCallback(async (opts?: { test?: boolean }) => {
    const { notes: n, threads: th, t: tr } = stateRef.current;
    const uid = await getSyncUserId().catch(() => null);
    await refreshReengagement({
      notes: n, threads: th, t: tr, threadsAvailable: th.length > 0 || uid !== null, test: opts?.test,
    });
  }, []);
}

/**
 * App-Start + jeder Wechsel in den Vordergrund: "zuletzt geöffnet" merken und die
 * Rückkehr-Benachrichtigungen neu planen. Ändern sich danach Notizen/Threads (z. B. neue
 * Erinnerung am Tag einer Stufe), wird mit demselben "zuletzt geöffnet" nachgeplant —
 * aber nur, wenn es eins gibt (nach "Alles löschen" erst wieder beim nächsten Öffnen).
 */
export default function ReengagementBootstrap() {
  const { notes, loading } = useNotes();
  const { threads, loading: threadsLoading } = useThoughts();
  const { locale } = useLanguage();
  const refresh = useRefreshReengagement();
  const ready = !loading && !threadsLoading;
  const openedRef = useRef(false);

  // Läuft ein Admin-Test, überspringt refreshReengagement das Neuplanen selbst.
  const onOpen = useCallback(async () => {
    await markAppOpened();
    await refresh();
  }, [refresh]);

  // Kaltstart: erst wenn Notizen und Threads geladen sind (Inhalt + Erinnerungstage).
  useEffect(() => {
    if (!ready || openedRef.current) return;
    openedRef.current = true;
    onOpen().catch((e) => console.warn('[reengagement] plan on start failed', e));
  }, [ready, onOpen]);

  useEffect(() => {
    let current: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      const wasBackground = current === 'background' || current === 'inactive';
      current = next;
      if (wasBackground && next === 'active' && openedRef.current) {
        onOpen().catch((e) => console.warn('[reengagement] plan on foreground failed', e));
      }
    });
    return () => sub.remove();
  }, [onOpen]);

  // Stand geändert → entprellt nachplanen (Zahlen, Erinnerungs-Kollisionen, Sprache).
  useEffect(() => {
    if (!openedRef.current) return;
    const id = setTimeout(() => {
      hasOpenedBefore()
        .then((opened) => (opened ? refresh() : undefined))
        .catch((e) => console.warn('[reengagement] replan failed', e));
    }, 2000);
    return () => clearTimeout(id);
  }, [notes, threads, locale, refresh]);

  return null;
}
