// ShareHandler — reagiert auf eingehende Share-Intents.
// Android: liest ACTION_SEND Intent-Extras via react-native-receive-sharing-intent
// iOS:     liest Daten aus der Share Extension (expo-share-extension Plugin)
//
// Rendert kein UI — rein logische Komponente.

import { useEffect } from 'react';
import { NativeModules } from 'react-native';
import ReceiveSharingIntent from 'react-native-receive-sharing-intent';
import { useNotes } from '../context/NotesContext';

interface SharedFile {
  text?: string | null;
  weblink?: string | null;
  subject?: string | null;
  mimeType?: string | null;
}

export default function ShareHandler() {
  const { addNote } = useNotes();

  useEffect(() => {
    if (!NativeModules.ReceiveSharingIntent) {
      return;
    }

    const handleFiles = (files: SharedFile[]) => {
      for (const file of files) {
        const text = (file.text ?? file.weblink ?? file.subject ?? '').trim();
        if (text) {
          addNote({
            title: '',
            content: text,
            category: 'Allgemein',
            isPinned: false,
            checklist: [],
            reminderAt: null,
            reminderRecurrence: 'once',
            reminderWeekday: null,
            reminderDayOfMonth: null,
            feedsThreads: false,
          }).catch((e: unknown) => console.warn('[share] addNote failed', e));
        }
      }
      ReceiveSharingIntent.clearReceivedFiles();
    };

    ReceiveSharingIntent.getReceivedFiles(
      handleFiles,
      (_error: unknown) => { /* no-op: fires on normal launch without a share intent */ },
    );
  }, []);

  return null;
}
