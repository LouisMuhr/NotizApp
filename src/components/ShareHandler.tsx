// ShareHandler — reagiert auf eingehende Share-Intents.
// Android: liest ACTION_SEND Intent-Extras via react-native-receive-sharing-intent
// iOS:     liest Daten aus der Share Extension (expo-share-extension Plugin)
//
// Muss innerhalb von <ThoughtsProvider> gerendert werden.
// Rendert kein UI — rein logische Komponente.

import { useEffect } from 'react';
import { NativeModules } from 'react-native';
import ReceiveSharingIntent from 'react-native-receive-sharing-intent';
import { useThoughts } from '../context/ThoughtsContext';

interface SharedFile {
  text?: string | null;
  weblink?: string | null;
  subject?: string | null;
  mimeType?: string | null;
}

export default function ShareHandler() {
  const { addThought } = useThoughts();

  useEffect(() => {
    if (!NativeModules.ReceiveSharingIntent) {
      // Natives Modul nicht verfügbar (Expo Go / kein nativer Build) — still überspringen
      return;
    }

    const handleFiles = (files: SharedFile[]) => {
      for (const file of files) {
        const text = (file.text ?? file.weblink ?? file.subject ?? '').trim();
        if (text) {
          addThought(text, 'share').catch((e) =>
            console.warn('[share] addThought failed', e),
          );
        }
      }
      ReceiveSharingIntent.clearReceivedFiles();
    };

    ReceiveSharingIntent.getReceivedFiles(
      handleFiles,
      (error: unknown) => console.warn('[share] getReceivedFiles error', error),
    );
  }, []);

  return null;
}
