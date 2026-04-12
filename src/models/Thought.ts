// BrainstormApp models
//
// Thought  = atomarer, unveränderlicher Gedanke (Voice/Quick-Add eingegeben)
// Thread   = vom Brainstorm-Worker gebildete Gruppe verwandter Thoughts
// ThoughtThreadLink = M:N-Verknüpfung zwischen Thought und Thread

export type ThoughtSource = 'app' | 'voice' | 'share' | 'bridge';
export type ThreadStatus = 'active' | 'archived';

export interface Thought {
  id: string;
  content: string;
  source: ThoughtSource;
  rawAudioUrl: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface Thread {
  id: string;
  title: string;
  summary: string;
  status: ThreadStatus;
  isPinned: boolean;
  thoughtCount: number;
  lastSynthesizedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ThoughtThreadLink {
  thoughtId: string;
  threadId: string;
  relevance: number;
  createdAt: string;
}

// Bequemlichkeit für die Detail-Ansicht: ein Thread mit allen verknüpften Thoughts
export interface ThreadWithThoughts extends Thread {
  thoughts: Thought[];
}
