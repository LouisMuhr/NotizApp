// AsyncStorage-Helper für die BrainstormApp-Entitäten.
// Spiegelt das Pattern aus noteStorage.ts: dünner Wrapper, kein State,
// kein Merge-Logic — die liegt im ThoughtsContext.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Thought, Thread, ThoughtThreadLink } from '../models/Thought';

const THOUGHTS_KEY = '@brainstorm_thoughts';
const THREADS_KEY = '@brainstorm_threads';
const LINKS_KEY = '@brainstorm_thought_threads';

export async function loadThoughts(): Promise<Thought[]> {
  const json = await AsyncStorage.getItem(THOUGHTS_KEY);
  return json ? JSON.parse(json) : [];
}

export async function saveThoughts(thoughts: Thought[]): Promise<void> {
  await AsyncStorage.setItem(THOUGHTS_KEY, JSON.stringify(thoughts));
}

export async function loadThreads(): Promise<Thread[]> {
  const json = await AsyncStorage.getItem(THREADS_KEY);
  return json ? JSON.parse(json) : [];
}

export async function saveThreads(threads: Thread[]): Promise<void> {
  await AsyncStorage.setItem(THREADS_KEY, JSON.stringify(threads));
}

export async function loadThoughtThreadLinks(): Promise<ThoughtThreadLink[]> {
  const json = await AsyncStorage.getItem(LINKS_KEY);
  return json ? JSON.parse(json) : [];
}

export async function saveThoughtThreadLinks(
  links: ThoughtThreadLink[],
): Promise<void> {
  await AsyncStorage.setItem(LINKS_KEY, JSON.stringify(links));
}
