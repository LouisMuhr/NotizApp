import AsyncStorage from '@react-native-async-storage/async-storage';
import { Note } from '../models/Note';

const NOTES_KEY = '@notizapp_notes';
const CATEGORIES_KEY = '@notizapp_categories';

export async function loadNotes(): Promise<Note[]> {
  const json = await AsyncStorage.getItem(NOTES_KEY);
  return json ? JSON.parse(json) : [];
}

export async function saveNotes(notes: Note[]): Promise<void> {
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

export async function loadCategories(): Promise<string[]> {
  const json = await AsyncStorage.getItem(CATEGORIES_KEY);
  return json ? JSON.parse(json) : [];
}

export async function saveCategories(categories: string[]): Promise<void> {
  await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
}
