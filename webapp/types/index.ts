export interface Thread {
  id: string;
  title: string;
  summary: string;
  status: 'active' | 'archived';
  isPinned: boolean;
  noteCount: number;
  noteIds: string[];
  lastSynthesizedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Fractional position [0,1] within the canvas area */
  xf?: number;
  yf?: number;
}

export interface Note {
  id: string;
  threadId: string;
  title: string;
  content: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  /** Fractional position [0,1] within the canvas area */
  xf?: number;
  yf?: number;
}

export interface Similarity {
  id: string;
  threadId1: string;
  threadId2: string;
  label: string;
  explanation?: string;
  /** Fractional position [0,1] – computed as mid-point with perpendicular offset */
  xf?: number;
  yf?: number;
}

export interface GraphData {
  threads: Thread[];
  notes: Note[];
  similarities: Similarity[];
}

/** Legacy node/link shape kept for backward compatibility with the API route */
export interface GraphNode {
  id: string;
  label: string;
  type: 'thread' | 'note' | 'category' | 'similarity';
  data?: Thread | Note | Similarity;
}

export interface GraphLink {
  source: string;
  target: string;
  type?: 'note-thread' | 'category' | 'similarity';
  label?: string;
}
