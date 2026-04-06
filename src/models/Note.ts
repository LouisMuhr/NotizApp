export type ReminderRecurrence = 'once' | 'daily' | 'weekly' | 'monthly';

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  isPinned: boolean;
  checklist: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
  reminderAt: string | null;
  reminderRecurrence: ReminderRecurrence;
  reminderWeekday: number | null;
  reminderDayOfMonth: number | null;
  notificationId: string | null;
}

export type SortField = 'updatedAt' | 'createdAt' | 'title' | 'category';
export type SortOrder = 'asc' | 'desc';

export interface FilterOptions {
  category: string | null;
  searchQuery: string;
  sortField: SortField;
  sortOrder: SortOrder;
}

export const DEFAULT_CATEGORIES = [
  'Allgemein',
  'Arbeit',
  'Privat',
  'Ideen',
  'Einkauf',
];

export const WEEKDAY_LABELS: Record<number, string> = {
  2: 'Montag',
  3: 'Dienstag',
  4: 'Mittwoch',
  5: 'Donnerstag',
  6: 'Freitag',
  7: 'Samstag',
  1: 'Sonntag',
};

export const WEEKDAY_ORDER = [2, 3, 4, 5, 6, 7, 1];
