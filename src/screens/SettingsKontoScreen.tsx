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
import { useTheme, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { getSupabase } from '../sync/supabaseClient';
import { clearUserIdCache, getUserId } from '../sync/userId';
import { migrateAndDeleteAnonUser } from '../sync/deleteAnonUser';
import { useNotes } from '../context/NotesContext';
import { useThoughts } from '../context/ThoughtsContext';
import { Tokens } from '../theme/theme';
import { Fonts, Type } from '../theme/typography';

const SIGNED_OUT_KEY = '@notizapp_signed_out_uid';

type AccountState = 'loading' | 'anonymous' | 'signed-in' | 'signed-out';
type AnonTab = 'signup' | 'signin';

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
  keyboardType?: 'email-address' | 'default';
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
        <MaterialCommunityIcons name="loading" size={18} color={fg} />
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
  const { resyncForUser } = useNotes();
  const { resyncForUser: resyncThreadsForUser } = useThoughts();

  const [accountState, setAccountState] = useState<AccountState>('loading');
  const [anonTab, setAnonTab] = useState<AnonTab>('signup');
  const [email, setEmail] = useState('');

  // Felder
  const [inputEmail, setInputEmail] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [inputPasswordConfirm, setInputPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' }>({
    message: '',
    type: 'info',
  });
  const toastKey = useRef(0);

  const showToast = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
    toastKey.current += 1;
    setToast({ message, type });
  };

  const clearFields = () => {
    setInputEmail('');
    setInputPassword('');
    setInputPasswordConfirm('');
  };

  const switchTab = (tab: AnonTab) => {
    setAnonTab(tab);
    clearFields();
  };

  // ── Auth-State laden ──
  useEffect(() => {
    (async () => {
      const supabase = getSupabase();
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.is_anonymous) {
        const signedOutUid = await AsyncStorage.getItem(SIGNED_OUT_KEY);
        if (signedOutUid && user && signedOutUid === user.id) {
          setAccountState('signed-out');
        } else {
          if (signedOutUid) await AsyncStorage.removeItem(SIGNED_OUT_KEY);
          setAccountState('anonymous');
        }
      } else {
        setAccountState('signed-in');
        setEmail(user.email ?? '');
      }
    })();
  }, []);

  // ── Actions ──
  const handleSignOut = async () => {
    const supabase = getSupabase();
    if (!supabase) {
      showToast('Sync ist nicht konfiguriert.', 'error');
      return;
    }
    setLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      await supabase.auth.signOut();
      clearUserIdCache();
      if (currentUser) await AsyncStorage.setItem(SIGNED_OUT_KEY, currentUser.id);
      // Neuen (anonymen) User holen und beide Contexts darauf umstellen, damit
      // die Notizen/Threads des abgemeldeten Kontos nicht mehr angezeigt werden.
      const newUid = await getUserId();
      if (newUid) {
        await resyncForUser(newUid);
        await resyncThreadsForUser(newUid);
      }
      setEmail('');
      setAccountState('signed-out');
      navigation.navigate('Home', { screen: 'Threads' });
    } catch (e: any) {
      showToast('Abmeldung fehlgeschlagen: ' + (e?.message ?? 'Unbekannter Fehler'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!inputEmail.trim() || !inputPassword) {
      showToast('Bitte E-Mail und Passwort eingeben.', 'error');
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      showToast('Sync ist nicht konfiguriert.', 'error');
      return;
    }
    setLoading(true);
    try {
      const { data: { user: anonUser } } = await supabase.auth.getUser();
      const anonUid = anonUser?.is_anonymous ? anonUser.id : null;
      const { data, error } = await supabase.auth.signInWithPassword({
        email: inputEmail.trim(),
        password: inputPassword,
      });
      if (error) {
        showToast('Anmeldung fehlgeschlagen: ' + error.message, 'error');
        return;
      }
      const newUser = data.user;
      if (!newUser) {
        showToast('Anmeldung unvollständig. Bitte E-Mail bestätigen.', 'error');
        return;
      }
      if (anonUid && anonUid !== newUser.id) {
        await migrateAndDeleteAnonUser(anonUid, newUser.id);
      }
      await resyncForUser(newUser.id);
      await resyncThreadsForUser(newUser.id);
      await AsyncStorage.removeItem(SIGNED_OUT_KEY);
      setEmail(newUser.email ?? '');
      clearFields();
      setAccountState('signed-in');
      navigation.navigate('Home', { screen: 'Threads' });
    } catch (e: any) {
      showToast('Anmeldung fehlgeschlagen: ' + (e?.message ?? 'Unbekannter Fehler'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    if (!inputEmail.trim() || !inputPassword) {
      showToast('Bitte E-Mail und Passwort eingeben.', 'error');
      return;
    }
    if (inputPassword !== inputPasswordConfirm) {
      showToast('Passwörter stimmen nicht überein.', 'error');
      return;
    }
    if (inputPassword.length < 6) {
      showToast('Passwort muss mindestens 6 Zeichen haben.', 'error');
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      showToast('Sync ist nicht konfiguriert.', 'error');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: inputEmail.trim(),
        password: inputPassword,
      });
      if (error) {
        showToast('Fehler: ' + error.message, 'error');
        return;
      }
      setAccountState('signed-in');
      setEmail(inputEmail.trim());
      clearFields();
      showToast('Konto gesichert! Bitte E-Mail bestätigen.', 'success');
    } catch (e: any) {
      showToast('Fehler: ' + (e?.message ?? 'Unbekannter Fehler'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!inputPassword) {
      showToast('Bitte neues Passwort eingeben.', 'error');
      return;
    }
    if (inputPassword !== inputPasswordConfirm) {
      showToast('Passwörter stimmen nicht überein.', 'error');
      return;
    }
    if (inputPassword.length < 6) {
      showToast('Passwort muss mindestens 6 Zeichen haben.', 'error');
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      showToast('Sync ist nicht konfiguriert.', 'error');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: inputPassword });
      if (error) {
        showToast('Fehler: ' + error.message, 'error');
        return;
      }
      clearFields();
      showToast('Passwort erfolgreich geändert.', 'success');
    } catch (e: any) {
      showToast('Fehler: ' + (e?.message ?? 'Unbekannter Fehler'), 'error');
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
        {accountState === 'anonymous' && (
          <>
            {/* Tab-Umschalter */}
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabBtn, anonTab === 'signup' && styles.tabBtnActive]}
                onPress={() => switchTab('signup')}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabLabel, anonTab === 'signup' && styles.tabLabelActive]}>
                  Konto sichern
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, anonTab === 'signin' && styles.tabBtnActive]}
                onPress={() => switchTab('signin')}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabLabel, anonTab === 'signin' && styles.tabLabelActive]}>
                  Anmelden
                </Text>
              </TouchableOpacity>
            </View>

            {/* Konto sichern */}
            {anonTab === 'signup' && (
              <>
                {/* Warnbanner */}
                <View style={styles.warningBanner}>
                  <View style={styles.warningIcon}>
                    <MaterialCommunityIcons name="shield-alert-outline" size={20} color={Tokens.amberDeep} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.warningTitle}>Konto nicht gesichert</Text>
                    <Text style={styles.warningText}>
                      Bei einer Neu-Installation oder einem Gerätewechsel gehen alle Sync-Daten verloren.
                    </Text>
                  </View>
                </View>

                {/* Formular */}
                <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
                  <Field
                    label="E-Mail-Adresse"
                    value={inputEmail}
                    onChangeText={setInputEmail}
                    placeholder="deine@email.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <Field
                    label="Passwort"
                    value={inputPassword}
                    onChangeText={setInputPassword}
                    placeholder="Mindestens 6 Zeichen"
                    secure
                  />
                  <Field
                    label="Passwort bestätigen"
                    value={inputPasswordConfirm}
                    onChangeText={setInputPasswordConfirm}
                    placeholder="Nochmals eingeben"
                    secure
                    onSubmit={handleUpgrade}
                  />
                  <PrimaryButton
                    label="Konto jetzt sichern"
                    onPress={handleUpgrade}
                    loading={loading}
                    disabled={!inputEmail.trim() || !inputPassword || !inputPasswordConfirm}
                  />
                </View>
              </>
            )}

            {/* Anmelden */}
            {anonTab === 'signin' && (
              <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
                <Field
                  label="E-Mail-Adresse"
                  value={inputEmail}
                  onChangeText={setInputEmail}
                  placeholder="deine@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Field
                  label="Passwort"
                  value={inputPassword}
                  onChangeText={setInputPassword}
                  placeholder="Dein Passwort"
                  secure
                  onSubmit={handleSignIn}
                />
                <PrimaryButton
                  label="Anmelden"
                  onPress={handleSignIn}
                  loading={loading}
                  disabled={!inputEmail.trim() || !inputPassword}
                />
              </View>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════
            ANGEMELDET
        ══════════════════════════════════════════ */}
        {accountState === 'signed-in' && (
          <>
            {/* Konto-Info */}
            <Text style={[styles.eyebrow, { color: theme.colors.onSurfaceVariant }]}>Konto</Text>
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
                    <Text style={styles.verifiedText}>Angemeldet</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Passwort ändern */}
            <Text style={[styles.eyebrow, { color: theme.colors.onSurfaceVariant }]}>
              Passwort ändern
            </Text>
            <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
              <Field
                label="Neues Passwort"
                value={inputPassword}
                onChangeText={setInputPassword}
                placeholder="Mindestens 6 Zeichen"
                secure
              />
              <Field
                label="Passwort bestätigen"
                value={inputPasswordConfirm}
                onChangeText={setInputPasswordConfirm}
                placeholder="Nochmals eingeben"
                secure
                onSubmit={handleChangePassword}
              />
              <PrimaryButton
                label="Passwort aktualisieren"
                onPress={handleChangePassword}
                loading={loading}
                disabled={!inputPassword || !inputPasswordConfirm}
              />
            </View>

            {/* Abmelden */}
            <Text style={[styles.eyebrow, { color: theme.colors.onSurfaceVariant }]}>Sitzung</Text>
            <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
              <PrimaryButton
                label="Abmelden"
                onPress={handleSignOut}
                loading={loading}
                danger
              />
            </View>
          </>
        )}

        {/* ══════════════════════════════════════════
            ABGEMELDET — wieder anmelden
        ══════════════════════════════════════════ */}
        {accountState === 'signed-out' && (
          <>
            {/* Info-Banner */}
            <View style={styles.infoBanner}>
              <MaterialCommunityIcons name="account-off-outline" size={20} color={Tokens.inkDim} />
              <Text style={styles.infoText}>Du bist abgemeldet. Melde dich an, um deine Notizen zu synchronisieren.</Text>
            </View>

            <Text style={[styles.eyebrow, { color: theme.colors.onSurfaceVariant }]}>Anmelden</Text>
            <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
              <Field
                label="E-Mail-Adresse"
                value={inputEmail}
                onChangeText={setInputEmail}
                placeholder="deine@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Field
                label="Passwort"
                value={inputPassword}
                onChangeText={setInputPassword}
                placeholder="Dein Passwort"
                secure
                onSubmit={handleSignIn}
              />
              <PrimaryButton
                label="Anmelden"
                onPress={handleSignIn}
                loading={loading}
                disabled={!inputEmail.trim() || !inputPassword}
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

  // ── Info-Banner ──
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Tokens.paperDeep,
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Tokens.paperEdge,
  },
  infoText: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: Tokens.inkDim,
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
