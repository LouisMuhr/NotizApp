// VoiceCaptureSheet — Bottom-Sheet Modal für die Gedanken-Erfassung.
//
// Zwei Modi:
//   • voice  → Mikrofon-Button + Live-Transkript via expo-speech-recognition
//   • text   → TextInput-Fallback (Long-Press auf FAB, oder "Lieber tippen")
//
// Titel: Knopf „Titel diktieren“ (alle User, sprachunabhängig). Pro: diktierte
// Notizen strukturiert Claude beim Speichern (Checkliste, Kategorie, Erinnerung)
// über /api/parse-note — schlägt das fehl, wird das Diktat unverändert gespeichert.
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
  Keyboard,
  Animated,
  Easing,
} from 'react-native';
import { Text, Switch, Portal, Dialog, Button, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
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
import { isVoiceAiEnabled } from '../utils/voiceAiPref';
import { isProbablyOnline } from '../utils/connectivity';
import { enqueuePendingParse, MAX_TRANSCRIPT_CHARS } from '../sync/pendingParse';
import { structuredToNote } from '../utils/structuredNote';
import { parseNoteRemote } from '../sync/parseNote';
import { isSyncConfigured } from '../sync/supabaseClient';
import { resolveAccountState } from '../sync/accountState';

type Target = 'title' | 'content';

interface Props {
  visible: boolean;
  initialMode?: 'voice' | 'text';
  onClose: () => void;
}

const join = (a: string, b: string) => (a && b ? `${a} ${b}` : a || b);

// Normale Ausgaenge einer Sitzung (Stille, Abbruch durch uns) — kein Fehler fuer den User.
const QUIET_ERRORS = ['aborted', 'no-speech', 'speech-timeout', 'interrupted'];

const supportsOnDevice = (): boolean =>
  !!ExpoSpeechRecognitionModule?.supportsOnDeviceRecognition?.();

export default function VoiceCaptureSheet({
  visible,
  initialMode = 'voice',
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { addNote, tier, categories } = useNotes();
  const { t, locale } = useLanguage();

  const [mode, setMode] = useState<'voice' | 'text'>(
    speechAvailable ? initialMode : 'text',
  );
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [titleText, setTitleText] = useState('');
  const [titlePartial, setTitlePartial] = useState('');
  // Wohin die laufende Erkennung schreibt. Gewechselt wird nur zwischen zwei
  // Sitzungen (Stop → Neustart), weil iOS im Dauerbetrieb erst beim Stoppen ein
  // finales Ergebnis liefert — ein Wechsel mitten in der Sitzung würde Text
  // zwischen Titel und Inhalt verschieben.
  const [target, setTarget] = useState<Target>('content');
  const sessionTargetRef = useRef<Target>('content');
  const pendingRestartRef = useRef<Target | null>(null);
  // Vom User (oder beim Schließen) gestoppt: das nachlaufende finale Ergebnis
  // darf die Erkennung nicht automatisch neu starten.
  const stoppedRef = useRef(false);
  // Erkennung laeuft auf dem Geraet statt ueber den Netz-Dienst (offline oder nach Online-Fehler).
  const onDeviceRef = useRef(false);
  const [onDevice, setOnDevice] = useState(false);
  const [voiceError, setVoiceError] = useState<null | 'generic' | 'offlineModelMissing'>(null);
  // Pro Aufnahme: darf die KI diese Notiz (auch nachtraeglich) ueberarbeiten? Standard ja,
  // jede neue Aufnahme startet wieder mit ja.
  const [aiAllowed, setAiAllowed] = useState(true);
  // Rueckfragen und Hinweise als Paper-Dialog im Sheet (kein Alert.alert, siehe CLAUDE.md).
  const [aiOffDialog, setAiOffDialog] = useState(false);
  const [offlineModelDialog, setOfflineModelDialog] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Whether speech recognition contributed any text — decides source 'voice' vs 'app'
  // (switching to "Lieber tippen" and typing everything is not a voice note).
  const [dictated, setDictated] = useState(false);
  const [saving, setSaving] = useState<null | 'saving' | 'structuring'>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const keyboardShift = useRef(new Animated.Value(0)).current;
  const overlayRef = useRef<View>(null);

  // Neither platform resizes the Modal for the keyboard: iOS never does, and with
  // edgeToEdgeEnabled the Android dialog window is edge-to-edge too, so adjustResize
  // is a no-op there. We lift the sheet by how far the keyboard overlaps the overlay
  // (measured, not the raw keyboard height) — should a system ever resize the window
  // itself, the overlap is 0 and we don't add a second gap.
  useEffect(() => {
    const animateTo = (value: number, duration?: number) => {
      setKeyboardOffset(value);
      Animated.timing(keyboardShift, {
        toValue: -value,
        duration: duration && duration > 0 ? duration : 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    };
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      const keyboardTop = e.endCoordinates?.screenY;
      const fallback = e.endCoordinates?.height ?? 0;
      const overlay = overlayRef.current;
      if (keyboardTop == null || !overlay) {
        animateTo(fallback, e.duration);
        return;
      }
      overlay.measureInWindow((_x, y, _w, h) => {
        const overlap = h > 0 ? y + h - keyboardTop : fallback;
        animateTo(Math.max(0, overlap), e.duration);
      });
    });
    const hideSub = Keyboard.addListener(hideEvent, (e) => animateTo(0, e?.duration));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardShift]);

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

  const startRecognition = useCallback(async (into: Target) => {
    sessionTargetRef.current = into;
    stoppedRef.current = false;
    setTarget(into);
    setVoiceError(null);
    // Ohne Netz erkennt das Geraet selbst (bleibt fuer die Sheet-Laufzeit gesetzt). Der
    // Online-Weg bleibt Standard — er ist genauer; schlaegt er fehl, greift der Error-Handler.
    if (!onDeviceRef.current && supportsOnDevice() && !(await isProbablyOnline())) {
      onDeviceRef.current = true;
    }
    if (stoppedRef.current) return; // waehrend des Checks gestoppt/geschlossen
    setOnDevice(onDeviceRef.current);
    ExpoSpeechRecognitionModule.start({
      lang: locale === 'en' ? 'en-US' : 'de-DE',
      continuous: true,
      interimResults: true,
      requiresOnDeviceRecognition: onDeviceRef.current,
      // Satzzeichen + Großschreibung durch die Erkennung (iOS 16+, Android 13+;
      // ältere Systeme ignorieren die Option).
      addsPunctuation: true,
      iosCategory: {
        category: AVAudioSessionCategory.playAndRecord,
        categoryOptions: [],
        mode: 'default',
      },
    });
  }, [locale]);

  useSpeechRecognitionEvent('start', () => setIsListening(true));
  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    const next = pendingRestartRef.current;
    pendingRestartRef.current = null;
    if (next) startRecognition(next);
  });
  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript ?? '';
    if (text.trim()) setDictated(true);
    const intoTitle = sessionTargetRef.current === 'title';
    if (event.isFinal) {
      if (intoTitle) {
        setTitleText((prev) => join(prev, text).trim());
        setTitlePartial('');
        // Titel steht — zurück auf Inhalt, ohne dass der User nochmal tippt.
        if (!pendingRestartRef.current && !stoppedRef.current) {
          pendingRestartRef.current = 'content';
          ExpoSpeechRecognitionModule.stop();
        }
      } else {
        setTranscript((prev) => join(prev, text).trim());
        setPartialTranscript('');
      }
    } else if (intoTitle) {
      setTitlePartial(text);
    } else {
      setPartialTranscript(text);
    }
  });
  useSpeechRecognitionEvent('error', (event) => {
    console.warn('[voice] Fehler:', event.error, event.message);
    const pending = pendingRestartRef.current;
    pendingRestartRef.current = null;
    setIsListening(false);
    if (stoppedRef.current || QUIET_ERRORS.includes(event.error)) return;

    // Online-Erkennung fehlgeschlagen (kein Netz, Dienst gesperrt …): einmal auf dem Geraet
    // versuchen. Der Neustart laeuft ueber 'end', das auf den Fehler folgt.
    if (!onDeviceRef.current && supportsOnDevice() && event.error !== 'not-allowed') {
      onDeviceRef.current = true;
      pendingRestartRef.current = pending ?? sessionTargetRef.current;
      return;
    }

    if (event.error === 'not-allowed') {
      setPermissionGranted(false);
    } else if (onDeviceRef.current && event.error === 'language-not-supported') {
      setVoiceError('offlineModelMissing');
      if (Platform.OS === 'android') setOfflineModelDialog(true);
    } else {
      setVoiceError('generic');
    }
  });

  const downloadOfflineModel = () => {
    setOfflineModelDialog(false);
    ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload?.({
      locale: locale === 'en' ? 'en-US' : 'de-DE',
    })?.catch?.((e: unknown) => console.warn('[voice] Modell-Download fehlgeschlagen', e));
  };

  useEffect(() => {
    if (!visible) {
      pendingRestartRef.current = null;
      onDeviceRef.current = false;
      stoppedRef.current = true;
      setVoiceError(null);
      setOnDevice(false);
      setAiAllowed(true);
      setAiOffDialog(false);
      setOfflineModelDialog(false);
      setNotice(null);
      if (isListening) {
        ExpoSpeechRecognitionModule.stop();
      }
      Keyboard.dismiss();
      keyboardShift.setValue(0);
      setKeyboardOffset(0);
      setTranscript('');
      setPartialTranscript('');
      setTitleText('');
      setTitlePartial('');
      setTarget('content');
      sessionTargetRef.current = 'content';
      setDictated(false);
      setIsListening(false);
      setMode(initialMode);
    }
  }, [visible, initialMode]);

  const requestPermissionAndStart = useCallback(async (into: Target) => {
    if (!speechAvailable || !ExpoSpeechRecognitionModule) return;
    haptics.medium();
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    setPermissionGranted(granted);
    if (!granted) return;
    startRecognition(into);
  }, [startRecognition]);

  const stopListening = useCallback(() => {
    pendingRestartRef.current = null;
    stoppedRef.current = true;
    if (speechAvailable && ExpoSpeechRecognitionModule) {
      ExpoSpeechRecognitionModule.stop();
    }
    setIsListening(false);
  }, []);

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      requestPermissionAndStart(target);
    }
  };

  // Titel-Knopf: schaltet das Ziel um. Läuft die Erkennung, wird die Sitzung
  // beendet (ihr Text landet noch im alten Ziel) und ins neue Ziel neu gestartet.
  const toggleTitleTarget = () => {
    const next: Target = target === 'title' ? 'content' : 'title';
    haptics.tap();
    if (isListening) {
      pendingRestartRef.current = next;
      setTarget(next);
      ExpoSpeechRecognitionModule.stop();
    } else if (next === 'title' && speechAvailable) {
      requestPermissionAndStart('title');
    } else {
      setTarget(next);
    }
  };

  // Switching to voice must dismiss the keyboard. On Android, unmounting the focused
  // TextInput alone doesn't reliably close it, so no hide event fires and the sheet
  // would stay lifted above a keyboard that is no longer needed.
  const switchMode = useCallback((next: 'voice' | 'text') => {
    if (next === 'voice') Keyboard.dismiss();
    setMode(next);
  }, []);

  const displayText = join(transcript, partialTranscript);
  const displayTitle = join(titleText, titlePartial);
  const canSave = displayText.trim().length > 0 || displayTitle.trim().length > 0;
  const tierKnown = tier !== null;
  const showProHint = speechAvailable && tierKnown && tier !== 'pro';
  const showAiSwitch = speechAvailable && tier === 'pro' && isVoiceAiEnabled() && isSyncConfigured();

  // Ausschalten braucht eine Bestaetigung (ohne KI bleibt das Diktat roh); Einschalten nicht.
  const toggleAiAllowed = (next: boolean) => {
    if (next) {
      setAiAllowed(true);
      return;
    }
    setAiOffDialog(true);
  };

  const closeNotice = () => {
    setNotice(null);
    onClose();
  };

  const handleSave = async () => {
    if (!canSave || saving) return;
    if (isListening) stopListening();
    const title = displayTitle.trim();
    const content = displayText.trim();
    const plainNote = {
      title,
      content,
      category: 'Allgemein',
      isPinned: false,
      checklist: [],
      reminderAt: null,
      reminderRecurrence: 'once' as const,
      reminderWeekday: null,
      reminderDayOfMonth: null,
      feedsThreads: false,
      source: dictated ? ('voice' as const) : ('app' as const),
    };

    let aiNotice: string | null = null;
    let queueForLater = false;
    const recordedAt = new Date();
    let note: Parameters<typeof addNote>[0] = plainNote;

    const canUseAi = dictated && !!content && tier === 'pro' && aiAllowed && isVoiceAiEnabled() && isSyncConfigured();
    // Die Bridge lehnt lange Diktate ab: gar nicht erst senden oder vormerken.
    const tooLong = content.length > MAX_TRANSCRIPT_CHARS;
    if (canUseAi && tooLong) aiNotice = t('voiceCapture.aiTooLong');
    const wantsAi = canUseAi && !tooLong;
    if (wantsAi) {
      setSaving('structuring');
      const account = await resolveAccountState().catch(() => null);
      if (!account) {
        // Zustand nicht lesbar (z. B. offline): speichern, Strukturierung spaeter nachholen.
        queueForLater = true;
        aiNotice = t('voiceCapture.aiQueued');
      } else if (account.state === 'secured') {
        const res = await parseNoteRemote({ transcript: content, title, categories, locale });
        if ('result' in res) {
          note = structuredToNote(res.result);
        } else if (res.error === 'limit_reached' || res.error === 'unavailable') {
          queueForLater = true;
          aiNotice = t(res.error === 'limit_reached' ? 'voiceCapture.aiLimit' : 'voiceCapture.aiQueued');
        }
      }
    }

    setSaving('saving');
    haptics.success();
    try {
      const saved = await addNote(note);
      if (queueForLater) {
        await enqueuePendingParse({
          noteId: saved.id,
          title,
          transcript: content,
          locale,
          noteUpdatedAt: saved.updatedAt,
          recordedAt: recordedAt.toISOString(),
        });
      }
      // Hinweis zuerst im Sheet bestaetigen lassen, geschlossen wird danach.
      if (aiNotice) setNotice(aiNotice);
      else onClose();
    } catch (e) {
      console.warn('[capture] addNote fehlgeschlagen', e);
    } finally {
      setSaving(null);
    }
  };

  const titleActive = target === 'title';
  const listeningInto = isListening ? target : null;

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
      {/* Portal.Host: Paper-Dialoge rendern sonst hinter dem nativen Modal. */}
      <Portal.Host>
      <View ref={overlayRef} style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={() => {
          if (isListening) stopListening();
          onClose();
        }} />

        <Animated.View
          style={[
            styles.sheet,
            Shadows.softWarm,
            Insets.cardBorder,
            {
              backgroundColor: Tokens.paper,
              // With the keyboard up the home indicator / nav bar sits behind it.
              paddingBottom: keyboardOffset > 0 ? 16 : Math.max(insets.bottom, 20),
              transform: [{ translateY: keyboardShift }],
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
              {/* Transkript-Anzeige: Titelzeile + Inhalt */}
              <View
                style={[
                  styles.transcriptBox,
                  {
                    backgroundColor: Tokens.paperDeep,
                    borderColor: Tokens.paperEdge,
                  },
                ]}
              >
                {displayTitle || titleActive ? (
                  <Text
                    style={[
                      styles.transcriptTitle,
                      { color: displayTitle ? Tokens.ink : Tokens.inkFaint },
                    ]}
                  >
                    {displayTitle || t('voiceCapture.titlePlaceholder')}
                    {listeningInto === 'title' && (
                      <Text style={{ color: Tokens.amber }}> |</Text>
                    )}
                  </Text>
                ) : null}
                {displayText ? (
                  <Text style={[styles.transcriptText, { color: Tokens.ink }]}>
                    {displayText}
                    {listeningInto === 'content' && (
                      <Text style={{ color: Tokens.amber }}> |</Text>
                    )}
                  </Text>
                ) : !titleActive ? (
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
                ) : null}
              </View>

              {/* Titel-Knopf */}
              {speechAvailable && (
                <View style={styles.chipRow}>
                  <Pressable
                    onPress={toggleTitleTarget}
                    accessibilityRole="button"
                    accessibilityState={{ selected: titleActive }}
                    style={[
                      styles.chip,
                      titleActive
                        ? { backgroundColor: Tokens.amber, borderColor: Tokens.amber }
                        : { backgroundColor: Tokens.paperDeep, borderColor: Tokens.rule },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="format-title"
                      size={16}
                      color={titleActive ? Tokens.paper : Tokens.inkDim}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        { color: titleActive ? Tokens.paper : Tokens.inkDim },
                      ]}
                    >
                      {titleActive ? t('voiceCapture.titleChipActive') : t('voiceCapture.titleChip')}
                    </Text>
                  </Pressable>
                </View>
              )}

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
              {showAiSwitch && (
                <View style={styles.aiSwitchRow}>
                  <Text style={[styles.switchText, { color: Tokens.inkDim, flex: 1 }]}>
                    {t('voiceCapture.aiSwitchLabel')}
                  </Text>
                  <Switch
                    value={aiAllowed}
                    onValueChange={toggleAiAllowed}
                    color={theme.colors.primary}
                    accessibilityLabel={t('voiceCapture.aiSwitchLabel')}
                  />
                </View>
              )}
              {speechAvailable && voiceError && (
                <Text style={[styles.hintText, { color: '#B14A3D' }]}>
                  {t(voiceError === 'offlineModelMissing' ? 'voiceCapture.offlineModelMissing' : 'voiceCapture.voiceError')}
                </Text>
              )}
              {speechAvailable && onDevice && !voiceError && (
                <Text style={[styles.hintText, { color: Tokens.inkFaint }]}>
                  {t('voiceCapture.offlineHint')}
                </Text>
              )}
              {showProHint && (
                <Pressable
                  onPress={() => {
                    if (isListening) stopListening();
                    onClose();
                    navigation.navigate('SettingsAbo');
                  }}
                >
                  <Text style={[styles.hintText, { color: Tokens.inkFaint }]}>
                    {t('voiceCapture.proHint')}
                  </Text>
                </Pressable>
              )}

              <Pressable onPress={() => switchMode('text')} style={styles.switchRow}>
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
                value={titleText}
                onChangeText={setTitleText}
                placeholder={t('voiceCapture.titlePlaceholder')}
                placeholderTextColor={Tokens.inkFaint}
                returnKeyType="next"
                style={[
                  styles.titleInput,
                  {
                    color: Tokens.ink,
                    backgroundColor: Tokens.paperDeep,
                    borderColor: Tokens.paperEdge,
                  },
                ]}
              />
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
              <Pressable onPress={() => switchMode('voice')} style={styles.switchRow}>
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
              disabled={!canSave || !!saving}
              style={[
                styles.btnSave,
                {
                  backgroundColor: canSave && !saving ? Tokens.ink : Tokens.paperEdge,
                },
              ]}
            >
              <Text
                style={{
                  color: canSave && !saving ? Tokens.paper : Tokens.inkFaint,
                  fontWeight: '700',
                  fontSize: 15,
                }}
              >
                {saving === 'structuring'
                  ? t('voiceCapture.structuring')
                  : saving
                    ? t('voiceCapture.saving')
                    : t('voiceCapture.save')}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>

      <Portal>
        <Dialog
          visible={aiOffDialog}
          onDismiss={() => setAiOffDialog(false)}
          style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={{ color: theme.colors.onSurface }}>{t('voiceCapture.aiOffTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>{t('voiceCapture.aiOffBody')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAiOffDialog(false)} textColor={theme.colors.onSurfaceVariant}>
              {t('voiceCapture.cancel')}
            </Button>
            <Button
              mode="contained"
              onPress={() => { setAiAllowed(false); setAiOffDialog(false); }}
              style={{ borderRadius: 12 }}
            >
              {t('voiceCapture.aiOffConfirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={offlineModelDialog}
          onDismiss={() => setOfflineModelDialog(false)}
          style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={{ color: theme.colors.onSurface }}>{t('voiceCapture.offlineModelTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>{t('voiceCapture.offlineModelBody')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setOfflineModelDialog(false)} textColor={theme.colors.onSurfaceVariant}>
              {t('voiceCapture.cancel')}
            </Button>
            <Button mode="contained" onPress={downloadOfflineModel} style={{ borderRadius: 12 }}>
              {t('voiceCapture.offlineModelDownload')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={notice !== null}
          onDismiss={closeNotice}
          style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={{ color: theme.colors.onSurface }}>{t('voiceCapture.aiFallbackTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>{notice}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button mode="contained" onPress={closeNotice} style={{ borderRadius: 12 }}>
              {t('voiceCapture.aiOffConfirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      </Portal.Host>
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
    marginBottom: 14,
  },
  transcriptTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: 'InstrumentSerif_400Regular',
    marginBottom: 6,
  },
  transcriptText: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Inter_400Regular',
  },
  chipRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    fontWeight: '600',
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
  dialog: { borderRadius: 24 },
  aiSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  switchText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  titleInput: {
    borderRadius: Radii.md,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    fontFamily: 'InstrumentSerif_400Regular',
    marginBottom: 10,
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
