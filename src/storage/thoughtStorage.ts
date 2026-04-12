// AsyncStorage-Helper für Threads.
// Thoughts wurden entfernt — Threads sind jetzt reine AI-Output-Entitäten.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Thread } from '../models/Thought';

const THREADS_KEY = '@brainstorm_threads';

export async function loadThreads(): Promise<Thread[]> {
  const json = await AsyncStorage.getItem(THREADS_KEY);
  return json ? JSON.parse(json) : [];
}

export async function saveThreads(threads: Thread[]): Promise<void> {
  await AsyncStorage.setItem(THREADS_KEY, JSON.stringify(threads));
}
