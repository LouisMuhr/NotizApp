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
}

export interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'thread' | 'note';
  data: Thread | Note;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}
