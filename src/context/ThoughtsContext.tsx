// ThoughtsContext — State-Management für Threads.
// Thoughts wurden als eigenständiges Konzept entfernt.
// Threads sind reine AI-Output-Entitäten: der brainstorm-worker liest
// Notes mit feedsThreads=true und schreibt Threads zurück.

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Thread } from '../models/Thought';
import { loadThreads, saveThreads } from '../storage/thoughtStorage';
import { isSyncConfigured } from '../sync/supabaseClient';
import { getDeviceId } from '../sync/deviceId';
import {
  pullThreads,
  archiveThread as archiveThreadRemote,
  restoreThread as restoreThreadRemote,
  deleteThreadPermanently as deleteThreadPermanentlyRemote,
  pinThread as pinThreadRemote,
  unpinThread as unpinThreadRemote,
  subscribeThreads,
} from '../sync/remoteThoughts';

interface ThoughtsContextType {
  threads: Thread[];
  loading: boolean;
  archiveThread: (threadId: string) => void;
  restoreThread: (threadId: string) => void;
  deleteThreadPermanently: (threadId: string) => void;
  pinThread: (threadId: string) => void;
  unpinThread: (threadId: string) => void;
}

const ThoughtsContext = createContext<ThoughtsContextType>({} as ThoughtsContextType);

function mergeThreadsByIdNewerWins(local: Thread[], remote: Thread[]): Thread[] {
  const byId = new Map<string, Thread>();
  for (const t of remote) byId.set(t.id, t);
  for (const t of local) {
    const existing = byId.get(t.id);
    if (existing && new Date(t.updatedAt) > new Date(existing.updatedAt)) {
      byId.set(t.id, t);
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function ThoughtsProvider({ children }: { children: React.ReactNode }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const deviceIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const unsubscribers: Array<() => void> = [];

    (async () => {
      const localThreads = await loadThreads();
      if (cancelled) return;
      setThreads(localThreads);
      setLoading(false);

      if (!isSyncConfigured()) return;

      try {
        const deviceId = await getDeviceId();
        if (cancelled) return;
        deviceIdRef.current = deviceId;

        const remoteThreads = await pullThreads(deviceId);
        if (cancelled) return;

        const merged = mergeThreadsByIdNewerWins(localThreads, remoteThreads);
        setThreads(merged);
        await saveThreads(merged);

        unsubscribers.push(
          subscribeThreads(deviceId, (event) => {
            if (event.type === 'delete') {
              setThreads((prev) => {
                const next = prev.filter((t) => t.id !== event.threadId);
                saveThreads(next).catch(() => {});
                return next;
              });
              return;
            }
            setThreads((prev) => {
              const idx = prev.findIndex((t) => t.id === event.thread.id);
              let next: Thread[];
              if (idx === -1) {
                next = [event.thread, ...prev];
              } else {
                next = [...prev];
                next[idx] = event.thread;
              }
              next.sort(
                (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
              );
              saveThreads(next).catch(() => {});
              return next;
            });
          }),
        );
      } catch (e) {
        console.warn('[brainstorm] sync init failed', e);
      }
    })();

    return () => {
      cancelled = true;
      for (const unsub of unsubscribers) {
        try { unsub(); } catch {}
      }
    };
  }, []);

  const archiveThread = useCallback((threadId: string) => {
    setThreads((prev) => {
      const next = prev.map((t) =>
        t.id === threadId ? { ...t, status: 'archived' as const, updatedAt: new Date().toISOString() } : t,
      );
      saveThreads(next).catch(() => {});
      return next;
    });
    const deviceId = deviceIdRef.current;
    if (deviceId) archiveThreadRemote(deviceId, threadId).catch(() => {});
  }, []);

  const restoreThread = useCallback((threadId: string) => {
    setThreads((prev) => {
      const next = prev.map((t) =>
        t.id === threadId ? { ...t, status: 'active' as const, updatedAt: new Date().toISOString() } : t,
      );
      saveThreads(next).catch(() => {});
      return next;
    });
    const deviceId = deviceIdRef.current;
    if (deviceId) restoreThreadRemote(deviceId, threadId).catch(() => {});
  }, []);

  const deleteThreadPermanently = useCallback((threadId: string) => {
    setThreads((prev) => {
      const next = prev.filter((t) => t.id !== threadId);
      saveThreads(next).catch(() => {});
      return next;
    });
    const deviceId = deviceIdRef.current;
    if (deviceId) deleteThreadPermanentlyRemote(deviceId, threadId).catch(() => {});
  }, []);

  const pinThread = useCallback((threadId: string) => {
    setThreads((prev) => {
      const next = prev.map((t) =>
        t.id === threadId ? { ...t, isPinned: true, updatedAt: new Date().toISOString() } : t,
      );
      saveThreads(next).catch(() => {});
      return next;
    });
    const deviceId = deviceIdRef.current;
    if (deviceId) pinThreadRemote(deviceId, threadId).catch(() => {});
  }, []);

  const unpinThread = useCallback((threadId: string) => {
    setThreads((prev) => {
      const next = prev.map((t) =>
        t.id === threadId ? { ...t, isPinned: false, updatedAt: new Date().toISOString() } : t,
      );
      saveThreads(next).catch(() => {});
      return next;
    });
    const deviceId = deviceIdRef.current;
    if (deviceId) unpinThreadRemote(deviceId, threadId).catch(() => {});
  }, []);

  return (
    <ThoughtsContext.Provider
      value={{ threads, loading, archiveThread, restoreThread, deleteThreadPermanently, pinThread, unpinThread }}
    >
      {children}
    </ThoughtsContext.Provider>
  );
}

export const useThoughts = () => useContext(ThoughtsContext);
