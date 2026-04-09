// ThoughtsContext — zentrales State-Management für die BrainstormApp-Welt.
//
// Spiegelt das Pattern aus NotesContext.tsx, ist aber bewusst schlanker:
//   - keine Archive/Tombstones/Reminders/Checklists
//   - Thoughts sind immutable (insert-only) → kein Update-Pfad nötig
//   - Threads werden vom Worker UPDATEt → wir hören auf '*'-Events
//   - Links sind insert-only (DELETE per CASCADE wenn Thread/Thought verschwindet)
//
// Slice 1 Scope: Provider lädt lokal + Supabase, hält State, exposed addThought
// für Slice 2. Realtime-Events werden mit console.log signalisiert, damit man
// den Smoke-Test ohne UI machen kann.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import {
  Thought,
  ThoughtSource,
  Thread,
  ThoughtThreadLink,
} from '../models/Thought';
import {
  loadThoughts,
  saveThoughts,
  loadThreads,
  saveThreads,
  loadThoughtThreadLinks,
  saveThoughtThreadLinks,
} from '../storage/thoughtStorage';
import { isSyncConfigured } from '../sync/supabaseClient';
import { getDeviceId } from '../sync/deviceId';
import {
  pullThoughts,
  pullThreads,
  pullThoughtThreadLinks,
  insertThought,
  subscribeThoughts,
  subscribeThreads,
  subscribeThoughtThreadLinks,
} from '../sync/remoteThoughts';

interface ThoughtsContextType {
  thoughts: Thought[];
  threads: Thread[];
  links: ThoughtThreadLink[];
  loading: boolean;
  /** Erzeugt einen neuen Thought lokal und schickt ihn zu Supabase. */
  addThought: (content: string, source?: ThoughtSource) => Promise<Thought>;
  /** Liefert alle Thoughts, die zu einem gegebenen Thread verlinkt sind. */
  getThoughtsForThread: (threadId: string) => Thought[];
}

const ThoughtsContext = createContext<ThoughtsContextType>({} as ThoughtsContextType);

// ----------------------------------------------------------------------------
// Merge-Helfer
// ----------------------------------------------------------------------------

function mergeThoughtsByIdNewerWins(local: Thought[], remote: Thought[]): Thought[] {
  // Thoughts sind immutable, aber processed_at kann nachträglich gesetzt werden.
  // Wir nehmen für gleiche IDs die Version mit gesetztem processedAt bevorzugt.
  const byId = new Map<string, Thought>();
  for (const t of local) byId.set(t.id, t);
  for (const t of remote) {
    const existing = byId.get(t.id);
    if (!existing) {
      byId.set(t.id, t);
    } else if (!existing.processedAt && t.processedAt) {
      byId.set(t.id, t);
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function mergeThreadsByIdNewerWins(local: Thread[], remote: Thread[]): Thread[] {
  const byId = new Map<string, Thread>();
  for (const t of local) byId.set(t.id, t);
  for (const t of remote) {
    const existing = byId.get(t.id);
    if (!existing || new Date(t.updatedAt) > new Date(existing.updatedAt)) {
      byId.set(t.id, t);
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

function linkKey(l: { thoughtId: string; threadId: string }): string {
  return `${l.thoughtId}::${l.threadId}`;
}

function mergeLinks(
  local: ThoughtThreadLink[],
  remote: ThoughtThreadLink[],
): ThoughtThreadLink[] {
  const byKey = new Map<string, ThoughtThreadLink>();
  for (const l of local) byKey.set(linkKey(l), l);
  for (const l of remote) byKey.set(linkKey(l), l);
  return Array.from(byKey.values());
}

// ----------------------------------------------------------------------------
// Provider
// ----------------------------------------------------------------------------

export function ThoughtsProvider({ children }: { children: React.ReactNode }) {
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [links, setLinks] = useState<ThoughtThreadLink[]>([]);
  const [loading, setLoading] = useState(true);
  const deviceIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const unsubscribers: Array<() => void> = [];

    (async () => {
      // 1) Lokal laden
      const [localThoughts, localThreads, localLinks] = await Promise.all([
        loadThoughts(),
        loadThreads(),
        loadThoughtThreadLinks(),
      ]);
      if (cancelled) return;
      setThoughts(localThoughts);
      setThreads(localThreads);
      setLinks(localLinks);
      setLoading(false);

      // 2) Sync (nur wenn Supabase konfiguriert)
      if (!isSyncConfigured()) {
        console.log('[brainstorm] sync not configured, running local-only');
        return;
      }

      try {
        const deviceId = await getDeviceId();
        if (cancelled) return;
        deviceIdRef.current = deviceId;

        const [remoteThoughts, remoteThreads, remoteLinks] = await Promise.all([
          pullThoughts(deviceId),
          pullThreads(deviceId),
          pullThoughtThreadLinks(deviceId),
        ]);
        if (cancelled) return;

        const mergedThoughts = mergeThoughtsByIdNewerWins(localThoughts, remoteThoughts);
        const mergedThreads = mergeThreadsByIdNewerWins(localThreads, remoteThreads);
        const mergedLinks = mergeLinks(localLinks, remoteLinks);

        setThoughts(mergedThoughts);
        setThreads(mergedThreads);
        setLinks(mergedLinks);
        await Promise.all([
          saveThoughts(mergedThoughts),
          saveThreads(mergedThreads),
          saveThoughtThreadLinks(mergedLinks),
        ]);

        console.log(
          `[brainstorm] initial sync done: ${mergedThoughts.length} thoughts, ` +
            `${mergedThreads.length} threads, ${mergedLinks.length} links`,
        );

        // 3) Realtime-Subscriptions
        unsubscribers.push(
          subscribeThoughts(deviceId, (incoming) => {
            console.log('[brainstorm] realtime thought INSERT', incoming.id);
            setThoughts((prev) => {
              if (prev.some((t) => t.id === incoming.id)) return prev;
              const next = [incoming, ...prev];
              saveThoughts(next).catch(() => {});
              return next;
            });
          }),
        );

        unsubscribers.push(
          subscribeThreads(deviceId, (event) => {
            if (event.type === 'delete') {
              console.log('[brainstorm] realtime thread DELETE', event.threadId);
              setThreads((prev) => {
                const next = prev.filter((t) => t.id !== event.threadId);
                saveThreads(next).catch(() => {});
                return next;
              });
              return;
            }
            console.log(
              `[brainstorm] realtime thread ${event.type.toUpperCase()}`,
              event.thread.id,
              event.thread.title,
            );
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
                (a, b) =>
                  new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
              );
              saveThreads(next).catch(() => {});
              return next;
            });
          }),
        );

        unsubscribers.push(
          subscribeThoughtThreadLinks(deviceId, (link) => {
            console.log(
              '[brainstorm] realtime link INSERT',
              link.thoughtId,
              '→',
              link.threadId,
            );
            setLinks((prev) => {
              const key = linkKey(link);
              if (prev.some((l) => linkKey(l) === key)) return prev;
              const next = [...prev, link];
              saveThoughtThreadLinks(next).catch(() => {});
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
        try {
          unsub();
        } catch {}
      }
    };
  }, []);

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  const addThought = useCallback(
    async (content: string, source: ThoughtSource = 'app'): Promise<Thought> => {
      const trimmed = content.trim();
      if (!trimmed) {
        throw new Error('addThought: content is empty');
      }
      const now = new Date().toISOString();
      const thought: Thought = {
        id: uuidv4(),
        content: trimmed,
        source,
        rawAudioUrl: null,
        createdAt: now,
        processedAt: null,
      };

      // Lokal sofort anwenden, Persistierung & Remote sind fire-and-forget.
      setThoughts((prev) => {
        const next = [thought, ...prev];
        saveThoughts(next).catch((e) =>
          console.warn('[brainstorm] saveThoughts failed', e),
        );
        return next;
      });

      const deviceId = deviceIdRef.current;
      if (deviceId) {
        insertThought(deviceId, thought).catch((e) =>
          console.warn('[brainstorm] insertThought failed', e),
        );
      }

      return thought;
    },
    [],
  );

  const getThoughtsForThread = useCallback(
    (threadId: string): Thought[] => {
      const linkedIds = new Set(
        links.filter((l) => l.threadId === threadId).map((l) => l.thoughtId),
      );
      return thoughts
        .filter((t) => linkedIds.has(t.id))
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
    },
    [links, thoughts],
  );

  return (
    <ThoughtsContext.Provider
      value={{
        thoughts,
        threads,
        links,
        loading,
        addThought,
        getThoughtsForThread,
      }}
    >
      {children}
    </ThoughtsContext.Provider>
  );
}

export const useThoughts = () => useContext(ThoughtsContext);
