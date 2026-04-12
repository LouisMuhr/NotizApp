// Thread-Modell für den Brainstorm-Tab.
// Thoughts wurden als eigenständiges Konzept entfernt — Notizen mit
// feedsThreads=true dienen jetzt als Input für den brainstorm-worker.

export type ThreadStatus = 'active' | 'archived';

export interface Thread {
  id: string;
  title: string;
  summary: string;
  status: ThreadStatus;
  isPinned: boolean;
  noteCount: number;
  lastSynthesizedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
