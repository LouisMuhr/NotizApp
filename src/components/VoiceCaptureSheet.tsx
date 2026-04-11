// VoiceCaptureSheet — Bottom-Sheet Modal für die Gedanken-Erfassung.
//
// Zwei Modi:
//   • voice  → Mikrofon-Button + Live-Transkript via expo-speech-recognition
//   • text   → TextInput-Fallback (Long-Press auf FAB, oder "Lieber tippen")
//
// Benötigt Custom Dev Build (EAS) für Spracherkennung. Im Expo Go läuft
// der Text-Modus; beim Tippen auf Mikrofon zeigt sich ein Hinweis.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  Animated,
  Easing,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// expo-speech-recognition benötigt einen Custom Dev Build (EAS).
// In Expo Go ist das native Modul nicht verfügbar → wir laden es lazy
// und fallen auf reinen Text-Modus zurück, wenn es fehlt.
let ExpoSpeechRecognitionModule: any = null;
let useSpeechRecognitionEvent: (event: string, handler: (e: any) => void) => void =
  () => {};
let AVAudioSessionCategory: any = {};
let speechAvailable = false;

try {
  const mod = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = mod.useSpeechRecognitionEvent;
  AVAudioSessionCategory = mod.AVAudioSessionCategory;
  speechAvailable = true;
} catch {
  // Expo Go oder kein Custom Build → nur Text-Modus
  speechAvailable = false;
}
import { useThoughts } from '../context/ThoughtsContext';
import { Gradients, Radii, Shadows } from '../theme/gradients';
import * as haptics from '../utils/haptics';

interface Props {
  visible: boolean;
  initialMode?: 'voice' | 'text';
  onClose: () => void;
}

export default function VoiceCaptureSheet({
  visible,
  initialMode = 'voice',
  onClose,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { addThought } = useThoughts();

  // Wenn das native Modul fehlt (Expo Go), erzwinge Text-Modus
  const [mode, setMode] = useState<'voice' | 'text'>(
    speechAvailable ? initialMode : 'text',
  );
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  // Pulsierende Mikrofon-Animation während der Aufnahme
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isListening) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 700,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
  }, [isListening, pulseAnim]);

  // Spracherkennungs-Events
  useSpeechRecognitionEvent('start', () => setIsListening(true));
  useSpeechRecognitionEvent('end', () => setIsListening(false));
  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript ?? '';
    if (event.isFinal) {
      setTranscript((prev) => (prev ? `${prev} ${text}` : text).trim());
      setPartialTranscript('');
    } else {
      setPartialTranscript(text);
    }
  });
  useSpeechRecognitionEvent('error', (event) => {
    console.warn('[voice] Fehler:', event.error, event.message);
    setIsListening(false);
  });

  // Reset beim Schließen
  useEffect(() => {
    if (!visible) {
      if (isListening) {
        ExpoSpeechRecognitionModule.stop();
      }
      setTranscript('');
      setPartialTranscript('');
      setIsListening(false);
      setMode(initialMode);
    }
  }, [visible, initialMode]);

  const requestPermissionAndStart = useCallback(async () => {
    if (!speechAvailable || !ExpoSpeechRecognitionModule) return;
    haptics.medium();
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    setPermissionGranted(granted);
    if (!granted) return;

    ExpoSpeechRecognitionModule.start({
      lang: 'de-DE',
      continuous: true,
      interimResults: true,
      iosCategory: {
        category: AVAudioSessionCategory.playAndRecord,
        categoryOptions: [],
        mode: 'default',
      },
    });
  }, []);

  const stopListening = useCallback(() => {
    if (speechAvailable && ExpoSpeechRecognitionModule) {
      ExpoSpeechRecognitionModule.stop();
    }
    setIsListening(false);
  }, []);

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      requestPermissionAndStart();
    }
  };

  const handleSave = async () => {
    const content = (transcript + (partialTranscript ? ` ${partialTranscript}` : '')).trim();
    if (!content) return;
    setIsSaving(true);
    haptics.success();
    try {
      await addThought(content, mode === 'voice' ? 'voice' : 'app');
      onClose();
    } catch (e) {
      console.warn('[capture] addThought fehlgeschlagen', e);
    } finally {
      setIsSaving(false);
    }
  };

  const displayText = transcript + (partialTranscript ? (transcript ? ' ' : '') + partialTranscript : '');
  const canSave = displayText.trim().length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => {
        if (isListening) stopListening();
        onClose();
      }}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Hintergrund-Tap schließt das Sheet */}
        <Pressable style={styles.backdrop} onPress={() => {
          if (isListening) stopListening();
          onClose();
        }} />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: '#181B23',
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          {/* Drag-Handle */}
          <View style={styles.handleRow}>
            <View
              style={[
                styles.handle,
                { backgroundColor: theme.colors.onSurfaceVariant + '50' },
              ]}
            />
          </View>

          {/* Titel */}
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            {mode === 'voice' ? 'Gedanke sprechen' : 'Gedanke tippen'}
          </Text>

          {mode === 'voice' ? (
            <>
              {/* Transkript-Anzeige */}
              <View
                style={[
                  styles.transcriptBox,
                  { backgroundColor: theme.colors.surfaceVariant },
                ]}
              >
                {displayText ? (
                  <Text style={[styles.transcriptText, { color: theme.colors.onSurface }]}>
                    {displayText}
                    {isListening && (
                      <Text style={{ color: theme.colors.primary }}> |</Text>
                    )}
                  </Text>
                ) : (
                  <Text
                    style={[
                      styles.transcriptText,
                      {
                        color: theme.colors.onSurfaceVariant,
                        fontStyle: 'italic',
                      },
                    ]}
                  >
                    {isListening
                      ? 'Höre zu…'
                      : 'Tippe auf das Mikrofon um zu sprechen'}
                  </Text>
                )}
              </View>

              {/* Mikrofon-Button */}
              <View style={styles.micRow}>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <Pressable onPress={toggleListening}>
                    <LinearGradient
                      colors={isListening ? Gradients.danger : Gradients.secondary}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[
                        styles.micButton,
                        isListening
                          ? Shadows.glow(Gradients.danger[0])
                          : Shadows.glow(Gradients.secondary[0]),
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={isListening ? 'stop' : 'microphone'}
                        size={38}
                        color="#FFFFFF"
                      />
                    </LinearGradient>
                  </Pressable>
                </Animated.View>
                <Text
                  style={[styles.micLabel, { color: theme.colors.onSurfaceVariant }]}
                >
                  {isListening ? 'Tippen zum Stoppen' : 'Tippen zum Sprechen'}
                </Text>
              </View>

              {!speechAvailable && (
                <Text style={[styles.hintText, { color: theme.colors.onSurfaceVariant }]}>
                  Spracherkennung benötigt einen Custom Dev Build.{'\n'}
                  Bitte Text-Modus verwenden.
                </Text>
              )}
              {speechAvailable && permissionGranted === false && (
                <Text style={[styles.hintText, { color: Gradients.danger[0] }]}>
                  Mikrofon-Zugriff verweigert — bitte in den Einstellungen erlauben.
                </Text>
              )}

              {/* Wechsel zu Text */}
              <Pressable onPress={() => setMode('text')} style={styles.switchRow}>
                <MaterialCommunityIcons
                  name="keyboard-outline"
                  size={16}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text style={[styles.switchText, { color: theme.colors.onSurfaceVariant }]}>
                  Lieber tippen
                </Text>
              </Pressable>
            </>
          ) : (
            /* Text-Modus */
            <>
              <TextInput
                autoFocus
                multiline
                value={transcript}
                onChangeText={setTranscript}
                placeholder="Gedanke eingeben…"
                placeholderTextColor={theme.colors.onSurfaceVariant}
                style={[
                  styles.textInput,
                  {
                    color: theme.colors.onSurface,
                    backgroundColor: theme.colors.surfaceVariant,
                  },
                ]}
              />
              <Pressable onPress={() => setMode('voice')} style={styles.switchRow}>
                <MaterialCommunityIcons
                  name="microphone-outline"
                  size={16}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text style={[styles.switchText, { color: theme.colors.onSurfaceVariant }]}>
                  Lieber sprechen
                </Text>
              </Pressable>
            </>
          )}

          {/* Action-Buttons */}
          <View style={styles.buttonRow}>
            <Pressable
              onPress={() => {
                if (isListening) stopListening();
                onClose();
              }}
              style={[styles.btnCancel, { borderColor: theme.colors.outline }]}
            >
              <Text style={{ color: theme.colors.onSurfaceVariant, fontWeight: '600' }}>
                Abbrechen
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSave}
              disabled={!canSave || isSaving}
              style={styles.btnSaveWrap}
            >
              <LinearGradient
                colors={canSave && !isSaving ? Gradients.secondary : Gradients.surface}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.btnSaveGradient}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>
                  {isSaving ? 'Speichere…' : 'Speichern'}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#00000088',
  },
  sheet: {
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handleRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 16,
  },
  transcriptBox: {
    borderRadius: Radii.md,
    padding: 16,
    minHeight: 110,
    justifyContent: 'flex-start',
    marginBottom: 24,
  },
  transcriptText: {
    fontSize: 16,
    lineHeight: 24,
  },
  micRow: {
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  hintText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
    paddingVertical: 4,
  },
  switchText: {
    fontSize: 13,
    opacity: 0.7,
  },
  textInput: {
    borderRadius: Radii.md,
    padding: 16,
    minHeight: 120,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  btnCancel: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnSaveWrap: {
    flex: 2,
    borderRadius: Radii.md,
    overflow: 'hidden',
  },
  btnSaveGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: Radii.md,
  },
});
