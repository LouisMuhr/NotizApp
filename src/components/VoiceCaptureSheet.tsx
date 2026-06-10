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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  speechAvailable = false;
}
import { useNotes } from '../context/NotesContext';
import { Radii, Shadows, Insets } from '../theme/gradients';
import { Tokens } from '../theme/theme';
import * as haptics from '../utils/haptics';
import { useLanguage } from '../context/LanguageContext';

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
  const { addNote } = useNotes();
  const { t, locale } = useLanguage();

  const [mode, setMode] = useState<'voice' | 'text'>(
    speechAvailable ? initialMode : 'text',
  );
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isListening) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.12,
            duration: 750,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 750,
            easing: Easing.inOut(Easing.sin),
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
      lang: locale === 'en' ? 'en-US' : 'de-DE',
      continuous: true,
      interimResults: true,
      iosCategory: {
        category: AVAudioSessionCategory.playAndRecord,
        categoryOptions: [],
        mode: 'default',
      },
    });
  }, [locale]);

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
      await addNote({
        title: '',
        content,
        category: 'Allgemein',
        isPinned: false,
        checklist: [],
        reminderAt: null,
        reminderRecurrence: 'once',
        reminderWeekday: null,
        reminderDayOfMonth: null,
        feedsThreads: false,
      });
      onClose();
    } catch (e) {
      console.warn('[capture] addNote fehlgeschlagen', e);
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
        <Pressable style={styles.backdrop} onPress={() => {
          if (isListening) stopListening();
          onClose();
        }} />

        <View
          style={[
            styles.sheet,
            Shadows.softWarm,
            Insets.cardBorder,
            {
              backgroundColor: Tokens.paper,
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          {/* Drag-Handle */}
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: Tokens.rule }]} />
          </View>

          {/* Titel */}
          <Text
            variant="headlineSmall"
            style={[styles.title, { color: Tokens.ink }]}
          >
            {mode === 'voice' ? t('voiceCapture.titleVoice') : t('voiceCapture.titleText')}
          </Text>

          {mode === 'voice' ? (
            <>
              {/* Transkript-Anzeige */}
              <View
                style={[
                  styles.transcriptBox,
                  {
                    backgroundColor: Tokens.paperDeep,
                    borderColor: Tokens.paperEdge,
                  },
                ]}
              >
                {displayText ? (
                  <Text style={[styles.transcriptText, { color: Tokens.ink }]}>
                    {displayText}
                    {isListening && (
                      <Text style={{ color: Tokens.amber }}> |</Text>
                    )}
                  </Text>
                ) : (
                  <Text
                    style={[
                      styles.transcriptText,
                      { color: Tokens.inkFaint, fontStyle: 'italic' },
                    ]}
                  >
                    {isListening
                      ? t('voiceCapture.listening')
                      : t('voiceCapture.tapToSpeak')}
                  </Text>
                )}
              </View>

              {/* Mikrofon-Button */}
              <View style={styles.micRow}>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <Pressable
                    onPress={toggleListening}
                    style={[
                      styles.micButton,
                      isListening
                        ? { backgroundColor: '#B14A3D', ...Shadows.glow('#B14A3D') }
                        : { backgroundColor: Tokens.ink, ...Shadows.softWarm },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={isListening ? 'stop' : 'microphone'}
                      size={34}
                      color={Tokens.paper}
                    />
                  </Pressable>
                </Animated.View>
                <Text style={[styles.micLabel, { color: Tokens.inkDim }]}>
                  {isListening ? t('voiceCapture.micStop') : t('voiceCapture.micStart')}
                </Text>
              </View>

              {!speechAvailable && (
                <Text style={[styles.hintText, { color: Tokens.inkFaint }]}>
                  {t('voiceCapture.speechUnavailable')}
                </Text>
              )}
              {speechAvailable && permissionGranted === false && (
                <Text style={[styles.hintText, { color: '#B14A3D' }]}>
                  {t('voiceCapture.micDenied')}
                </Text>
              )}

              <Pressable onPress={() => setMode('text')} style={styles.switchRow}>
                <MaterialCommunityIcons
                  name="keyboard-outline"
                  size={16}
                  color={Tokens.inkDim}
                />
                <Text style={[styles.switchText, { color: Tokens.inkDim }]}>
                  {t('voiceCapture.switchToText')}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <TextInput
                autoFocus
                multiline
                value={transcript}
                onChangeText={setTranscript}
                placeholder={t('voiceCapture.textPlaceholder')}
                placeholderTextColor={Tokens.inkFaint}
                style={[
                  styles.textInput,
                  {
                    color: Tokens.ink,
                    backgroundColor: Tokens.paperDeep,
                    borderColor: Tokens.paperEdge,
                  },
                ]}
              />
              <Pressable onPress={() => setMode('voice')} style={styles.switchRow}>
                <MaterialCommunityIcons
                  name="microphone-outline"
                  size={16}
                  color={Tokens.inkDim}
                />
                <Text style={[styles.switchText, { color: Tokens.inkDim }]}>
                  {t('voiceCapture.switchToVoice')}
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
              style={[
                styles.btnCancel,
                { borderColor: Tokens.rule, backgroundColor: Tokens.paperDeep },
              ]}
            >
              <Text style={{ color: Tokens.inkDim, fontWeight: '600', fontSize: 15 }}>
                {t('voiceCapture.cancel')}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSave}
              disabled={!canSave || isSaving}
              style={[
                styles.btnSave,
                {
                  backgroundColor: canSave && !isSaving ? Tokens.ink : Tokens.paperEdge,
                },
              ]}
            >
              <Text
                style={{
                  color: canSave && !isSaving ? Tokens.paper : Tokens.inkFaint,
                  fontWeight: '700',
                  fontSize: 15,
                }}
              >
                {isSaving ? t('voiceCapture.saving') : t('voiceCapture.save')}
              </Text>
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
    backgroundColor: 'rgba(43, 36, 25, 0.45)',
  },
  sheet: {
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handleRow: {
    alignItems: 'center',
    marginBottom: 18,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  title: {
    fontFamily: 'InstrumentSerif_400Regular',
    marginBottom: 16,
    color: Tokens.ink,
  },
  transcriptBox: {
    borderRadius: Radii.md,
    borderWidth: 1,
    padding: 16,
    minHeight: 110,
    justifyContent: 'flex-start',
    marginBottom: 24,
  },
  transcriptText: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Inter_400Regular',
  },
  micRow: {
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  micButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    letterSpacing: 0.2,
  },
  hintText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'Inter_400Regular',
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
    fontFamily: 'Inter_400Regular',
  },
  textInput: {
    borderRadius: Radii.md,
    borderWidth: 1,
    padding: 16,
    minHeight: 120,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Inter_400Regular',
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnCancel: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSave: {
    flex: 2,
    borderRadius: Radii.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
