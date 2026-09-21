import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Animated,
  TouchableOpacity,
  TextInput as RNTextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme, Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getSupabase } from '../sync/supabaseClient';
import { clearUserIdCache } from '../sync/userId';
import {
  AccountState, resolveAccountState, savePendingEmail, clearPendingEmail,
} from '../sync/accountState';
import { useNotes } from '../context/NotesContext';
import { useThoughts } from '../context/ThoughtsContext';
import { Tokens } from '../theme/theme';
import { Fonts } from '../theme/typography';
import { useLanguage } from '../context/LanguageContext';

type LocalTab = 'signup' | 'signin';

/** Supabase-Default fuer Auth-Mails an dieselbe Adresse. */
const RESEND_COOLDOWN_SECONDS = 60;

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type }: { message: string; type: 'error' | 'success' | 'info' }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    if (!message) return;
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -12, duration: 200, useNativeDriver: true }),
      ]).start();
    }, 3200);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  const bg =
    type === 'error' ? '#B14A3D' :
    type === 'success' ? '#3D7A4A' :
    Tokens.ink;

  const icon =
    type === 'error' ? 'alert-circle-outline' :
    type === 'success' ? 'check-circle-outline' :
    'information-outline';

  return (
    <Animated.View style={[styles.toast, { backgroundColor: bg, opacity, transform: [{ translateY }] }]}>
      <MaterialCommunityIcons name={icon} size={15} color={Tokens.paper} />
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

// ─── Eingabefeld ──────────────────────────────────────────────────────────────
function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secure,
  keyboardType,
  autoCapitalize,
  onSubmit,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: 'email-address' | 'default' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences';
  onSubmit?: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const [showPw, setShowPw] = useState(false);

  return (
    <View style={fieldStyles.wrap}>
      <Text style={[fieldStyles.label, focused && { color: Tokens.amberDeep }]}>{label}</Text>
      <View style={[
        fieldStyles.inputRow,
        { borderColor: focused ? Tokens.amberDeep : Tokens.rule },
      ]}>
        <RNTextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Tokens.inkFaint}
          secureTextEntry={secure && !showPw}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={autoCapitalize ?? 'sentences'}
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmit}
          returnKeyType={onSubmit ? 'done' : 'next'}
          style={[fieldStyles.input, { color: Tokens.ink }]}
        />
        {secure && (
          <TouchableOpacity onPress={() => setShowPw((v) => !v)} style={fieldStyles.eyeBtn}>
            <MaterialCommunityIcons
              name={showPw ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={Tokens.inkFaint}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    fontFamily: Fonts.sansSemibold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Tokens.inkDim,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    backgroundColor: Tokens.paperDeep,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 15,
    paddingVertical: 11,
  },
  eyeBtn: { padding: 4 },
});

/**
 * Welche Aktion gerade laeuft — nicht nur *ob* eine laeuft. Ein blosses Boolean
 * liess jeden sichtbaren Button gleichzeitig den Spinner zeigen (beim Abmelden
 * drehte auch "Passwort aendern" und umgekehrt).
 */
type BusyAction =
  | 'retry-upload'
  | 'sign-out'
  | 'sign-in'
  | 'upgrade'
  | 'resend-confirmation'
  | 'forgot-password'
  | 'change-password'
  | 'reset-with-code'
  | 'confirm-with-code';

// ─── Primärer Button ──────────────────────────────────────────────────────────
function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  danger,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  const bg = danger ? '#F4DAD3' : Tokens.amberDeep;
  const fg = danger ? '#B14A3D' : Tokens.paper;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[
        btnStyles.btn,
        { backgroundColor: bg, opacity: (disabled || loading) ? 0.5 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size={18} color={fg} />
      ) : (
        <Text style={[btnStyles.label, { color: fg }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const btnStyles = StyleSheet.create({
  btn: {
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: Fonts.sansSemibold,
    fontSize: 14,
  },
});

// ─── Haupt-Screen ─────────────────────────────────────────────────────────────
export default function SettingsKontoScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const {
    resyncForUser, refreshSubscription, flushPending,
    uploadLocalNotes, initialUploadPending, detachSync,
  } = useNotes();
  const {
    resyncForUser: resyncThreadsForUser,
    detachSync: detachThreadsSync,
  } = useThoughts();
  const { t, locale } = useLanguage();

  const [accountState, setAccountState] = useState<AccountState>('loading');
  const [localTab, setLocalTab] = useState<LocalTab>('signup');
  const [email, setEmail] = useState('');
  /** UID einer bestaetigten Registrierung, deren Erstupload noch offen ist. */
  const [uploadRetryUid, setUploadRetryUid] = useState<string | null>(null);

  // Felder
  const [inputEmail, setInputEmail] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [inputPasswordConfirm, setInputPasswordConfirm] = useState('');
  /**
   * Reset per Code statt per Deep Link: Supabase schickt mit dem Link auch
   * einen 6-stelligen OTP mit. `verifyOtp({type:'recovery'})` erzeugt damit
   * eine echte Session IN DER APP — erst dadurch kann `updateUser()` das
   * Passwort setzen. Ueber den Browser-Link entstuende die Session nur dort.
   */
  const [resetCodeSentTo, setResetCodeSentTo] = useState<string | null>(null);
  const [inputResetCode, setInputResetCode] = useState('');
  /**
   * Bestaetigung per Code statt per Link: der Link fuehrt in den Browser und
   * laesst den Nutzer dort stehen — die App muesste den Status danach separat
   * abfragen. `verifyOtp({type:'signup'})` bestaetigt und liefert die Session
   * in einem Schritt. Der Passwort-Weg bleibt als Fallback fuer Mails, die
   * noch ohne Code im Postfach liegen.
   */
  const [inputConfirmCode, setInputConfirmCode] = useState('');
  /**
   * Supabase laesst pro Adresse nur alle 60s eine Mail zu und meldet sonst
   * einen Fehler. Statt das erst beim Druck als Toast zu zeigen, laeuft die
   * Sperre sichtbar am Button ab.
   */
  const [resendCooldown, setResendCooldown] = useState(0);
  /**
   * Waehrend eine Aktion laeuft, sind alle Buttons gesperrt — den Spinner zeigt
   * aber nur der gedrueckte (`busyAction`).
   */
  const [busyAction, setBusyAction] = useState<BusyAction | null>(null);
  const loading = busyAction !== null;
  const setLoading = (action: BusyAction | false) =>
    setBusyAction(action === false ? null : action);

  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' }>({
    message: '',
    type: 'info',
  });
  const toastKey = useRef(0);

  const showToast = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
    toastKey.current += 1;
    setToast({ message, type });
  };

  // Sekundengenauer Countdown; laeuft nur, solange wirklich gesperrt ist.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const clearFields = () => {
    setInputEmail('');
    setInputPassword('');
    setInputPasswordConfirm('');
    setInputResetCode('');
    setInputConfirmCode('');
  };

  const switchTab = (tab: LocalTab) => {
    setLocalTab(tab);
    clearFields();
  };

  // ── Konto-Zustand laden ──
  // Strikt aus `email_confirmed_at` abgeleitet (siehe accountState.ts), nie aus
  // einem lokal gesetzten Status-Flag.
  useEffect(() => {
    (async () => {
      const snapshot = await resolveAccountState();
      setAccountState(snapshot.state);
      setEmail(snapshot.email ?? '');
      if (snapshot.state === 'secured' && snapshot.userId && initialUploadPending) {
        setUploadRetryUid(snapshot.userId);
      }
    })();
  }, [initialUploadPending]);

  /**
   * Erneut pruefen, ob die Bestaetigung inzwischen erfolgt ist.
   *
   * Zwei Faelle, weil Supabase nach `signUp()` je nach Projekteinstellung eine
   * Session ausgibt oder nicht:
   *
   * - MIT Session: `refreshSession()` holt den aktualisierten
   *   `email_confirmed_at`-Wert, danach entscheidet `resolveAccountState()`.
   * - OHNE Session: der Status laesst sich ueberhaupt nicht abfragen (es gibt
   *   keinen anonymen Endpunkt dafuer). Der einzige Weg an eine Session ist
   *   eine Anmeldung — deshalb wird hier nach dem Passwort gefragt.
   */
  /**
   * Registrierung per Code aus der Bestaetigungsmail abschliessen.
   *
   * `verifyOtp({type:'signup'})` setzt `email_confirmed_at` UND gibt die
   * Session zurueck — damit entfaellt der Umweg ueber den Browser-Link und
   * die anschliessende Passwort-Abfrage.
   */
  const handleConfirmWithCode = async () => {
    const code = inputConfirmCode.trim();
    if (!code) {
      showToast(t('settingsKonto.toastEnterConfirmCode'), 'error');
      return;
    }
    const supabase = getSupabase();
    if (!supabase || !email) {
      showToast(t('settingsKonto.toastSyncNotConfigured'), 'error');
      return;
    }
    setLoading('confirm-with-code');
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'signup',
      });
      if (error || !data.session?.user) {
        showToast(t('settingsKonto.toastConfirmCodeInvalid'), 'error');
        return;
      }
      const user = data.session.user;
      clearUserIdCache();
      // Gleicher Abschluss wie beim Link-Weg: Erstupload, Threads, Tier.
      await finishSecuring(user.id, user.email ?? email);
    } catch (e: any) {
      showToast(t('settingsKonto.toastErrorPrefix') + (e?.message ?? 'Unbekannter Fehler'), 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Uebergang nach `secured`: einmaliger Upload der lokalen Notizen, dann Sync.
   *
   * Schlaegt der Upload fehl, bleibt der Zustand `secured` (die Bestaetigung
   * liegt ja vor — die UI darf nichts anderes behaupten) und es erscheint ein
   * dauerhaft sichtbarer Retry statt eines verschwindenden Toasts.
   */
  const finishSecuring = async (uid: string, userEmail: string) => {
    await clearPendingEmail();
    setEmail(userEmail);
    setAccountState('secured');
    clearFields();
    // SOFORT raus aus dem Konto-Screen: der Erstupload laeuft ueber Netz und
    // kann dauern — darauf zu warten liesse den Nutzer ohne Grund hier stehen.
    navigation.navigate('Home', { screen: 'Threads' });
    try {
      await uploadLocalNotes(uid);
      setUploadRetryUid(null);
      await resyncThreadsForUser(uid);
      await refreshSubscription();
      showToast(t('settingsKonto.toastAccountSecured'), 'success');
    } catch (e: any) {
      console.warn('[account] initial upload failed', e);
      setUploadRetryUid(uid);
      showToast(t('settingsKonto.toastUploadFailed') + ' ' + (e?.message ?? ''), 'error');
      // Der Retry geht nicht verloren: `uploadLocalNotes()` setzt den Merker
      // VOR dem Versuch in AsyncStorage, und der Konto-Screen leitet daraus
      // beim naechsten Oeffnen wieder `uploadRetryUid` ab (siehe useEffect).
    }
  };

  /** Sichtbarer Retry fuer einen fehlgeschlagenen Erstupload. */
  const handleRetryUpload = async () => {
    if (!uploadRetryUid) return;
    setLoading('retry-upload');
    try {
      await uploadLocalNotes(uploadRetryUid);
      setUploadRetryUid(null);
      await resyncThreadsForUser(uploadRetryUid);
      await refreshSubscription();
      showToast(t('settingsKonto.toastUploadDone'), 'success');
    } catch (e: any) {
      showToast(t('settingsKonto.toastUploadFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Actions ──
  const handleSignOut = async () => {
    const supabase = getSupabase();
    if (!supabase) {
      showToast(t('settingsKonto.toastSyncNotConfigured'), 'error');
      return;
    }
    setLoading('sign-out');
    try {
      // Unbestaetigte lokale Aenderungen gehoeren noch in dieses Konto — erst hochladen.
      try {
        await flushPending();
      } catch {
        showToast(t('settingsKonto.toastSignOutPending'), 'error');
        return;
      }
      // A3: signOut() wirft nicht, sondern liefert { error } (z. B. offline). Dann
      // lebt die Session weiter und es darf NICHTS umgestellt werden.
      const { error } = await supabase.auth.signOut();
      if (error) {
        showToast(t('settingsKonto.toastSignOutFailed') + error.message, 'error');
        return;
      }
      clearUserIdCache();
      await clearPendingEmail();
      // Zurueck nach `local`: Sync abschalten, lokalen Notiz-Bestand behalten.
      // Es wird KEIN neuer (anonymer) User erzeugt.
      await detachSync();
      await detachThreadsSync();
      await refreshSubscription();
      setEmail('');
      setUploadRetryUid(null);
      setAccountState('local');
      navigation.navigate('Home', { screen: 'Threads' });
    } catch (e: any) {
      showToast(t('settingsKonto.toastSignOutFailed') + (e?.message ?? 'Unbekannter Fehler'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!inputEmail.trim() || !inputPassword) {
      showToast(t('settingsKonto.toastEnterEmailPassword'), 'error');
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      showToast(t('settingsKonto.toastSyncNotConfigured'), 'error');
      return;
    }
    setLoading('sign-in');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: inputEmail.trim(),
        password: inputPassword,
      });
      if (error) {
        showToast(t('settingsKonto.toastSignInFailed') + error.message, 'error');
        return;
      }
      const newUser = data.user;
      if (!newUser) {
        showToast(t('settingsKonto.toastConfirmEmail'), 'error');
        return;
      }
      // Anmeldung ohne bestaetigte E-Mail: kein Sync, Zustand bleibt sichtbar
      // `pending-confirmation` statt faelschlich "Angemeldet".
      if (!newUser.email_confirmed_at) {
        await savePendingEmail(newUser.email ?? inputEmail.trim());
        setEmail(newUser.email ?? inputEmail.trim());
        clearFields();
        setAccountState('pending-confirmation');
        showToast(t('settingsKonto.toastConfirmEmail'), 'info');
        return;
      }
      clearUserIdCache();
      await clearPendingEmail();
      setEmail(newUser.email ?? '');
      clearFields();
      setAccountState('secured');
      // Wie beim Sichern: erst raus, dann syncen. Ein grosser Kontostand
      // liesse den Nutzer sonst vor dem Konto-Screen warten.
      navigation.navigate('Home', { screen: 'Threads' });
      // 'replace': eine Anmeldung ist typischerweise ein Zweitgeraet — der
      // Kontostand gilt. Lokale Notizen wandern nur beim einmaligen Erstupload
      // nach der Registrierung ins Konto.
      // Ab hier ist die Anmeldung durch — ein Sync-Fehler darf nicht als
      // "Anmeldung fehlgeschlagen" erscheinen. Der Sync holt sich beim
      // naechsten Start ohnehin, was liegengeblieben ist.
      try {
        await resyncForUser(newUser.id, 'replace');
        await resyncThreadsForUser(newUser.id);
        // Tier-Anzeige (Free/Basic/Pro) für den angemeldeten User aktualisieren.
        await refreshSubscription();
      } catch (syncError) {
        console.warn('[account] post-signin sync failed', syncError);
      }
    } catch (e: any) {
      showToast(t('settingsKonto.toastSignInFailed') + (e?.message ?? 'Unbekannter Fehler'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    if (!inputEmail.trim() || !inputPassword) {
      showToast(t('settingsKonto.toastEnterEmailPassword'), 'error');
      return;
    }
    if (inputPassword !== inputPasswordConfirm) {
      showToast(t('settingsKonto.toastPasswordsMismatch'), 'error');
      return;
    }
    if (inputPassword.length < 6) {
      showToast(t('settingsKonto.toastPasswordTooShort'), 'error');
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      showToast(t('settingsKonto.toastSyncNotConfigured'), 'error');
      return;
    }
    setLoading('upgrade');
    try {
      const address = inputEmail.trim();
      const { data, error } = await supabase.auth.signUp({
        email: address,
        password: inputPassword,
        // Sprache am User hinterlegen: die Mail-Templates lesen sie als
        // {{ .Data.locale }} aus. Ohne das waeren alle Mails einsprachig.
        options: { data: { locale } },
      });
      if (error) {
        showToast(t('settingsKonto.toastErrorPrefix') + error.message, 'error');
        return;
      }
      // NICHT optimistisch auf `secured` setzen: erst wenn die Bestaetigung
      // tatsaechlich vorliegt, wird synchronisiert. Ist die Bestaetigungspflicht
      // im Projekt deaktiviert, liefert signUp() direkt `email_confirmed_at`.
      const user = data.user;
      if (user?.email_confirmed_at && data.session) {
        await finishSecuring(user.id, user.email ?? address);
        return;
      }
      // Ohne Session gaebe es beim naechsten Kaltstart keinen User, aus dem
      // sich `pending-confirmation` ableiten liesse — daher die Adresse merken.
      await savePendingEmail(address);
      setEmail(address);
      clearFields();
      setAccountState('pending-confirmation');
      showToast(t('settingsKonto.toastConfirmationSent'), 'success');
    } catch (e: any) {
      showToast(t('settingsKonto.toastErrorPrefix') + (e?.message ?? 'Unbekannter Fehler'), 'error');
    } finally {
      setLoading(false);
    }
  };

  /** Bestaetigungsmail erneut anfordern. */
  const handleResendConfirmation = async () => {
    const supabase = getSupabase();
    if (!supabase || !email) {
      showToast(t('settingsKonto.toastSyncNotConfigured'), 'error');
      return;
    }
    setLoading('resend-confirmation');
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) {
        // Rate Limit: Supabase nennt die Restzeit im Text ("after 47 seconds").
        // Die wandert in den Countdown, statt als Toast zu verpuffen.
        const wait = Number(/(\d+)\s*seconds?/i.exec(error.message)?.[1]);
        if (Number.isFinite(wait) && wait > 0) {
          setResendCooldown(wait);
          return;
        }
        showToast(t('settingsKonto.toastErrorPrefix') + error.message, 'error');
        return;
      }
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      showToast(t('settingsKonto.toastConfirmationSent'), 'success');
    } catch (e: any) {
      showToast(t('settingsKonto.toastErrorPrefix') + (e?.message ?? 'Unbekannter Fehler'), 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Passwort vergessen: Supabase schickt einen Reset-Link. Aus
   * Datenschutzgruenden wird nicht verraten, ob die Adresse existiert.
   */
  const handleForgotPassword = async () => {
    const address = inputEmail.trim();
    if (!address) {
      showToast(t('settingsKonto.toastEnterEmailForReset'), 'error');
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      showToast(t('settingsKonto.toastSyncNotConfigured'), 'error');
      return;
    }
    setLoading('forgot-password');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(address);
      if (error) {
        showToast(t('settingsKonto.toastErrorPrefix') + error.message, 'error');
        return;
      }
      // Adresse merken: `verifyOtp()` braucht sie zusammen mit dem Code.
      setResetCodeSentTo(address);
      setInputResetCode('');
      setInputPassword('');
      setInputPasswordConfirm('');
      showToast(t('settingsKonto.toastResetSent'), 'success');
    } catch (e: any) {
      showToast(t('settingsKonto.toastErrorPrefix') + (e?.message ?? 'Unbekannter Fehler'), 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Passwort per Code aus der Reset-Mail neu setzen.
   *
   * Bewusst OTP statt Deep Link: der Link in der Mail wuerde die
   * Recovery-Session im Browser anlegen, wo die App nicht herankommt. Ein
   * Deep Link zurueck in die App braeuchte ein `scheme` in app.json und damit
   * einen neuen Native Build. `verifyOtp()` liefert die Session direkt hier.
   */
  const handleResetWithCode = async () => {
    const code = inputResetCode.trim();
    if (!code) {
      showToast(t('settingsKonto.toastEnterResetCode'), 'error');
      return;
    }
    if (!inputPassword) {
      showToast(t('settingsKonto.toastEnterNewPassword'), 'error');
      return;
    }
    if (inputPassword !== inputPasswordConfirm) {
      showToast(t('settingsKonto.toastPasswordsMismatch'), 'error');
      return;
    }
    if (inputPassword.length < 6) {
      showToast(t('settingsKonto.toastPasswordTooShort'), 'error');
      return;
    }
    const supabase = getSupabase();
    if (!supabase || !resetCodeSentTo) {
      showToast(t('settingsKonto.toastSyncNotConfigured'), 'error');
      return;
    }
    setLoading('reset-with-code');
    try {
      // Schritt 1: Code einloesen -> Session in der App.
      const { data, error: otpError } = await supabase.auth.verifyOtp({
        email: resetCodeSentTo,
        token: code,
        type: 'recovery',
      });
      if (otpError || !data.session) {
        showToast(t('settingsKonto.toastResetCodeInvalid'), 'error');
        return;
      }
      // Schritt 2: erst mit dieser Session laesst sich das Passwort setzen.
      const { error: updateError } = await supabase.auth.updateUser({
        password: inputPassword,
      });
      if (updateError) {
        showToast(t('settingsKonto.toastErrorPrefix') + updateError.message, 'error');
        return;
      }
      // Ein Reset bestaetigt die Adresse implizit — der Status kommt aber wie
      // ueberall aus resolveAccountState(), nie aus einem lokalen Flag.
      const user = data.session.user;
      await clearPendingEmail().catch(() => {});
      setResetCodeSentTo(null);
      clearFields();
      const snapshot = await resolveAccountState();
      setAccountState(snapshot.state);
      setEmail(snapshot.email ?? user.email ?? '');
      if (snapshot.state === 'secured' && snapshot.userId) {
        clearUserIdCache();
        // 'replace' wie bei der Anmeldung: wer sein Passwort zuruecksetzt,
        // sitzt typischerweise an einem Zweitgeraet — der Kontostand gilt.
        await resyncForUser(snapshot.userId, 'replace').catch(() => {});
        await resyncThreadsForUser(snapshot.userId).catch(() => {});
        await refreshSubscription().catch(() => {});
      }
      showToast(t('settingsKonto.toastResetSuccess'), 'success');
    } catch (e: any) {
      showToast(t('settingsKonto.toastErrorPrefix') + (e?.message ?? 'Unbekannter Fehler'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!inputPassword) {
      showToast(t('settingsKonto.toastEnterNewPassword'), 'error');
      return;
    }
    if (inputPassword !== inputPasswordConfirm) {
      showToast(t('settingsKonto.toastPasswordsMismatch'), 'error');
      return;
    }
    if (inputPassword.length < 6) {
      showToast(t('settingsKonto.toastPasswordTooShort'), 'error');
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      showToast(t('settingsKonto.toastSyncNotConfigured'), 'error');
      return;
    }
    setLoading('change-password');
    try {
      const { error } = await supabase.auth.updateUser({ password: inputPassword });
      if (error) {
        showToast(t('settingsKonto.toastErrorPrefix') + error.message, 'error');
        return;
      }
      clearFields();
      showToast(t('settingsKonto.toastPasswordChanged'), 'success');
    } catch (e: any) {
      showToast(t('settingsKonto.toastErrorPrefix') + (e?.message ?? 'Unbekannter Fehler'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Loading ──
  if (accountState === 'loading') {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Toast key={toastKey.current} message={toast.message} type={toast.type} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ══════════════════════════════════════════
            ANONYM  — Konto sichern / Anmelden
        ══════════════════════════════════════════ */}
        {accountState === 'local' && (
          <>
            {/* Warnbanner: normaler Zustand fuer `local`, nicht nur im Signup-Tab */}
            <View style={styles.warningBanner}>
              <View style={styles.warningIcon}>
                <MaterialCommunityIcons name="shield-alert-outline" size={20} color={Tokens.amberDeep} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.warningTitle}>{t('settingsKonto.warningTitle')}</Text>
                <Text style={styles.warningText}>
                  {t('settingsKonto.warningBody')}
                </Text>
              </View>
            </View>

            {/* Tab-Umschalter */}
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabBtn, localTab === 'signup' && styles.tabBtnActive]}
                onPress={() => switchTab('signup')}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabLabel, localTab === 'signup' && styles.tabLabelActive]}>
                  {t('settingsKonto.tabSecure')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, localTab === 'signin' && styles.tabBtnActive]}
                onPress={() => switchTab('signin')}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabLabel, localTab === 'signin' && styles.tabLabelActive]}>
                  {t('settingsKonto.tabSignIn')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Konto sichern */}
            {localTab === 'signup' && (
              <>
                {/* Formular */}
                <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
                  <Field
                    label={t('settingsKonto.emailLabel')}
                    value={inputEmail}
                    onChangeText={setInputEmail}
                    placeholder={t('settingsKonto.emailPlaceholder')}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <Field
                    label={t('settingsKonto.passwordLabel')}
                    value={inputPassword}
                    onChangeText={setInputPassword}
                    placeholder={t('settingsKonto.passwordPlaceholder')}
                    secure
                  />
                  <Field
                    label={t('settingsKonto.confirmPasswordLabel')}
                    value={inputPasswordConfirm}
                    onChangeText={setInputPasswordConfirm}
                    placeholder={t('settingsKonto.confirmPasswordPlaceholder')}
                    secure
                    onSubmit={handleUpgrade}
                  />
                  <PrimaryButton
                    label={t('settingsKonto.secureNowButton')}
                    onPress={handleUpgrade}
                    loading={busyAction === 'upgrade'}
                    disabled={loading || !inputEmail.trim() || !inputPassword || !inputPasswordConfirm}
                  />
                </View>
              </>
            )}

            {/* Anmelden */}
            {localTab === 'signin' && resetCodeSentTo && (
              <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
                <Text style={styles.cardTitle}>{t('settingsKonto.resetCodeTitle')}</Text>
                <Text style={styles.hintText}>
                  {t('settingsKonto.resetCodeBody', { email: resetCodeSentTo })}
                </Text>
                <Field
                  label={t('settingsKonto.resetCodeLabel')}
                  value={inputResetCode}
                  onChangeText={setInputResetCode}
                  placeholder={t('settingsKonto.resetCodePlaceholder')}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                />
                <Field
                  label={t('settingsKonto.newPasswordLabel')}
                  value={inputPassword}
                  onChangeText={setInputPassword}
                  placeholder={t('settingsKonto.newPasswordPlaceholder')}
                  secure
                />
                <Field
                  label={t('settingsKonto.confirmPasswordLabel')}
                  value={inputPasswordConfirm}
                  onChangeText={setInputPasswordConfirm}
                  placeholder={t('settingsKonto.confirmPasswordPlaceholder')}
                  secure
                  onSubmit={handleResetWithCode}
                />
                <PrimaryButton
                  label={t('settingsKonto.resetSubmitButton')}
                  onPress={handleResetWithCode}
                  loading={busyAction === 'reset-with-code'}
                  disabled={loading || !inputResetCode.trim() || !inputPassword || !inputPasswordConfirm}
                />
                <TouchableOpacity
                  onPress={() => { setResetCodeSentTo(null); clearFields(); }}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Text style={styles.linkText}>{t('settingsKonto.resetCancelLink')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {localTab === 'signin' && !resetCodeSentTo && (
              <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
                <Field
                  label={t('settingsKonto.emailLabel')}
                  value={inputEmail}
                  onChangeText={setInputEmail}
                  placeholder={t('settingsKonto.emailPlaceholder')}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Field
                  label={t('settingsKonto.passwordLabel')}
                  value={inputPassword}
                  onChangeText={setInputPassword}
                  placeholder={t('settingsKonto.passwordPlaceholderGeneric')}
                  secure
                  onSubmit={handleSignIn}
                />
                <PrimaryButton
                  label={t('settingsKonto.signInButton')}
                  onPress={handleSignIn}
                  loading={busyAction === 'sign-in'}
                  disabled={loading || !inputEmail.trim() || !inputPassword}
                />
                <TouchableOpacity onPress={handleForgotPassword} disabled={loading} activeOpacity={0.7}>
                  <Text style={styles.linkText}>{t('settingsKonto.forgotPassword')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════
            BESTÄTIGUNG AUSSTEHEND
        ══════════════════════════════════════════ */}
        {accountState === 'pending-confirmation' && (
          <>
            <View style={styles.warningBanner}>
              <View style={styles.warningIcon}>
                <MaterialCommunityIcons name="email-alert-outline" size={20} color={Tokens.amberDeep} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.warningTitle}>{t('settingsKonto.pendingTitle')}</Text>
                <Text style={styles.warningText}>
                  {t('settingsKonto.pendingBody', { email })}
                </Text>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
              {/* Der Code aus der Mail ist der einzige Weg: die Templates
                  enthalten keinen Link mehr, es gibt also nichts zu "pruefen". */}
              <Text style={styles.hintText}>{t('settingsKonto.confirmCodeHint')}</Text>
              <Field
                label={t('settingsKonto.confirmCodeLabel')}
                value={inputConfirmCode}
                onChangeText={setInputConfirmCode}
                placeholder={t('settingsKonto.confirmCodePlaceholder')}
                keyboardType="number-pad"
                autoCapitalize="none"
                onSubmit={handleConfirmWithCode}
              />
              <PrimaryButton
                label={t('settingsKonto.confirmCodeButton')}
                onPress={handleConfirmWithCode}
                loading={busyAction === 'confirm-with-code'}
                disabled={loading || !inputConfirmCode.trim()}
              />
              <TouchableOpacity
                onPress={handleResendConfirmation}
                disabled={loading || resendCooldown > 0}
                activeOpacity={0.7}
              >
                <Text style={[styles.linkText, resendCooldown > 0 && styles.linkTextDisabled]}>
                  {resendCooldown > 0
                    ? t('settingsKonto.resendCooldown', { seconds: resendCooldown })
                    : t('settingsKonto.resendConfirmation')}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.eyebrow, { color: theme.colors.onSurfaceVariant }]}>
              {t('settingsKonto.sessionLabel')}
            </Text>
            <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
              <PrimaryButton
                label={t('settingsKonto.cancelRegistrationButton')}
                onPress={handleSignOut}
                loading={busyAction === 'sign-out'}
                disabled={loading}
                danger
              />
            </View>
          </>
        )}

        {/* ══════════════════════════════════════════
            ANGEMELDET
        ══════════════════════════════════════════ */}
        {accountState === 'secured' && (
          <>
            {/* Erstupload fehlgeschlagen: dauerhaft sichtbarer Retry statt Toast */}
            {uploadRetryUid && (
              <View style={styles.warningBanner}>
                <View style={styles.warningIcon}>
                  <MaterialCommunityIcons name="cloud-alert" size={20} color={Tokens.amberDeep} />
                </View>
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={{ gap: 2 }}>
                    <Text style={styles.warningTitle}>{t('settingsKonto.uploadPendingTitle')}</Text>
                    <Text style={styles.warningText}>{t('settingsKonto.uploadPendingBody')}</Text>
                  </View>
                  <PrimaryButton
                    label={t('settingsKonto.retryUploadButton')}
                    onPress={handleRetryUpload}
                    loading={busyAction === 'retry-upload'}
                    disabled={loading}
                  />
                </View>
              </View>
            )}

            {/* Konto-Info */}
            <Text style={[styles.eyebrow, { color: theme.colors.onSurfaceVariant }]}>{t('settingsKonto.accountSection')}</Text>
            <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.accountRow}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarLetter}>
                    {email.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accountEmail}>{email}</Text>
                  <View style={styles.verifiedBadge}>
                    <MaterialCommunityIcons name="check-circle" size={12} color="#3D7A4A" />
                    <Text style={styles.verifiedText}>{t('settingsKonto.signedInBadge')}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Passwort ändern */}
            <Text style={[styles.eyebrow, { color: theme.colors.onSurfaceVariant }]}>
              {t('settingsKonto.changePassword')}
            </Text>
            <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
              <Field
                label={t('settingsKonto.newPasswordLabel')}
                value={inputPassword}
                onChangeText={setInputPassword}
                placeholder={t('settingsKonto.passwordPlaceholder')}
                secure
              />
              <Field
                label={t('settingsKonto.confirmPasswordLabel')}
                value={inputPasswordConfirm}
                onChangeText={setInputPasswordConfirm}
                placeholder={t('settingsKonto.confirmPasswordPlaceholder')}
                secure
                onSubmit={handleChangePassword}
              />
              <PrimaryButton
                label={t('settingsKonto.updatePasswordButton')}
                onPress={handleChangePassword}
                loading={busyAction === 'change-password'}
                disabled={loading || !inputPassword || !inputPasswordConfirm}
              />
            </View>

            {/* Sync beenden */}
            <Text style={[styles.eyebrow, { color: theme.colors.onSurfaceVariant }]}>{t('settingsKonto.sessionLabel')}</Text>
            <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
              {/* Erwartung vorher setzen: im Lokal-first-Modell bleibt der
                  Notiz-Bestand auf dem Geraet. Wer alles loswerden will, nutzt
                  Einstellungen → Datenschutz → Alle Daten loeschen. */}
              <Text style={styles.hintText}>{t('settingsKonto.signOutHint')}</Text>
              <PrimaryButton
                label={t('settingsKonto.signOutButton')}
                onPress={handleSignOut}
                loading={busyAction === 'sign-out'}
                disabled={loading}
                danger
              />
            </View>
          </>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 100,
    gap: 10,
  },

  // ── Toast ──
  toast: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    zIndex: 100,
    elevation: 6,
    shadowColor: Tokens.warmShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  toastText: {
    color: Tokens.paper,
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
  },

  // ── Tabs ──
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Tokens.paperDeep,
    borderRadius: 14,
    padding: 4,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Tokens.paperEdge,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: Tokens.paper,
    shadowColor: Tokens.warmShadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13.5,
    color: Tokens.inkFaint,
  },
  tabLabelActive: {
    fontFamily: Fonts.sansSemibold,
    color: Tokens.ink,
  },

  // ── Karten ──
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Tokens.paperEdge,
    padding: 16,
    gap: 14,
  },

  // ── Eyebrow ──
  eyebrow: {
    fontFamily: Fonts.sansSemibold,
    fontSize: 10.5,
    letterSpacing: 0.84,
    textTransform: 'uppercase',
    marginTop: 6,
    marginLeft: 4,
  },

  // ── Warnbanner ──
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Tokens.amberSoft,
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Tokens.amber + '80',
  },
  warningIcon: {
    marginTop: 1,
  },
  warningTitle: {
    fontFamily: Fonts.sansSemibold,
    fontSize: 13.5,
    color: Tokens.amberDeep,
  },
  warningText: {
    fontFamily: Fonts.sans,
    fontSize: 12.5,
    lineHeight: 18,
    color: Tokens.ink,
  },

  // ── Karten-Ueberschrift ──
  cardTitle: {
    fontFamily: Fonts.serif,
    fontSize: 18,
    lineHeight: 22,
    color: Tokens.ink,
  },

  // ── Erklaerender Hinweistext ──
  hintText: {
    fontFamily: Fonts.sans,
    fontSize: 12.5,
    lineHeight: 18,
    color: Tokens.inkDim,
  },

  // ── Gesperrter Textlink (Cooldown) ──
  linkTextDisabled: {
    color: Tokens.inkFaint,
  },

  // ── Sekundaerer Textlink ──
  linkText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: Tokens.amberDeep,
    textAlign: 'center',
    paddingVertical: 4,
  },

  // ── Account-Row ──
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: Tokens.amberSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: Fonts.sansSemibold,
    fontSize: 20,
    color: Tokens.amberDeep,
  },
  accountEmail: {
    fontFamily: Fonts.sansMedium,
    fontSize: 15,
    color: Tokens.ink,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  verifiedText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11.5,
    color: '#3D7A4A',
  },
});
