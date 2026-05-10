import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Note } from '../models/Note';
import { Thread } from '../models/Thought';

export async function exportNotesAsJson(notes: Note[], archivedNotes: Note[], threads: Thread[]): Promise<void> {
  const payload = {
    exportedAt: new Date().toISOString(),
    notes,
    archivedNotes,
    threads,
  };

  const json = JSON.stringify(payload, null, 2);
  const path = FileSystem.cacheDirectory + 'notizapp-export.json';
  await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Teilen wird auf diesem Gerät nicht unterstützt.');
  }

  await Sharing.shareAsync(path, {
    mimeType: 'application/json',
    dialogTitle: 'Notizen exportieren',
    UTI: 'public.json',
  });
}
