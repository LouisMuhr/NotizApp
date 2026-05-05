import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, ScrollView, Animated } from 'react-native';
import { useTheme, Text, TextInput, Button, SegmentedButtons } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { getSupabase } from '../sync/supabaseClient';
import { clearUserIdCache } from '../sync/userId';
import { migrateAndDeleteAnonUser } from '../sync/deleteAnonUser';
import { useNotes } from '../context/NotesContext';
import { Tokens } from '../theme/theme';
import { Fonts } from '../theme/typography';

const SIGNED_OUT_KEY = '@notizapp_signed_out_uid';

type AccountState = 'loading' | 'anonymous' | 'signed-in' | 'signed-out';
type AnonTab = 'signup' | 'signin';

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
    }, 3000);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  const bg = type === 'error' ? '#c0392b' : type === 'success' ? '#27ae60' : Tokens.ink;

  return (
    <Animated.View style={[styles.toast, { backgroundColor: bg, opacity, transform: [{ translateY }] }]}>
      <MaterialCommunityIcons
        name={type === 'error' ? 'alert-circle-outline' : type === 'success' ? 'check-circle-outline' : 'information-outline'}
        size={16}
        color="#fff"
      />
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

export default function SettingsKontoScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { resyncForUser } = useNotes();
  const [accountState, setAccountState] = useState<AccountState>('loading');
  const [anonTab, setAnonTab] = useState<AnonTab>('signup');
  const [email, setEmail] = useState('');
  const [inputEmail, setInputEmail] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [inputPasswordConfirm, setInputPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' }>({ message: '', type: 'info' });
  const toastKey = useRef(0);

  const showToast = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
    toastKey.current += 1;
    setToast({ message, type });
  };

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

  const handleSignOut = async () => {
    setLoading(true);
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    await supabase.auth.signOut();
    clearUserIdCache();
    if (currentUser) await AsyncStorage.setItem(SIGNED_OUT_KEY, currentUser.id);
    setLoading(false);
    setEmail('');
    setAccountState('signed-out');
    navigation.navigate('Home', { screen: 'Threads' });
  };

  const handleSignIn = async () => {
    if (!inputEmail.trim() || !inputPassword) {
      showToast('Bitte E-Mail und Passwort eingeben.', 'error');
      return;
    }
    setLoading(true);
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: { user: anonUser } } = await supabase.auth.getUser();
    const anonUid = anonUser?.is_anonymous ? anonUser.id : null;
    const { data, error } = await supabase.auth.signInWithPassword({
      email: inputEmail.trim(),
      password: inputPassword,
    });
    if (error) {
      setLoading(false);
      showToast('Fehler: ' + error.message, 'error');
    } else {
      if (anonUid) await migrateAndDeleteAnonUser(anonUid, data.user.id);
      await resyncForUser(data.user.id);
      await AsyncStorage.removeItem(SIGNED_OUT_KEY);
      setLoading(false);
      setEmail(data.user?.email ?? '');
      setInputEmail('');
      setInputPassword('');
      setAccountState('signed-in');
      navigation.navigate('Home', { screen: 'Threads' });
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
    setLoading(true);
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.auth.updateUser({
      email: inputEmail.trim(),
      password: inputPassword,
    });
    setLoading(false);
    if (error) {
      showToast('Fehler: ' + error.message, 'error');
    } else {
      setAccountState('signed-in');
      setEmail(inputEmail.trim());
      setInputEmail('');
      setInputPassword('');
      setInputPasswordConfirm('');
      showToast('Konto gesichert! Bitte E-Mail bestätigen.', 'success');
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
    setLoading(true);
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.auth.updateUser({ password: inputPassword });
    setLoading(false);
    if (error) {
      showToast('Fehler: ' + error.message, 'error');
    } else {
      setInputPassword('');
      setInputPasswordConfirm('');
      showToast('Passwort geändert.', 'success');
    }
  };

  if (accountState === 'loading') {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Toast key={toastKey.current} message={toast.message} type={toast.type} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {accountState === 'anonymous' && (
          <>
            <SegmentedButtons
              value={anonTab}
              onValueChange={(v) => { setAnonTab(v as AnonTab); setInputEmail(''); setInputPassword(''); setInputPasswordConfirm(''); }}
              buttons={[
                { value: 'signup', label: 'Konto sichern' },
                { value: 'signin', label: 'Anmelden' },
              ]}
              style={styles.tabs}
            />

            {anonTab === 'signup' && (
              <>
                <View style={[styles.banner, { backgroundColor: Tokens.amberDeep + '22', borderColor: Tokens.amberDeep + '55' }]}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={20} color={Tokens.amberDeep} />
                  <Text style={[styles.bannerText, { color: Tokens.ink }]}>
                    Dein Konto ist noch nicht gesichert. Bei einer Neu-Installation gehen alle Sync-Daten verloren.
                  </Text>
                </View>
                <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
                  <TextInput label="E-Mail" value={inputEmail} onChangeText={setInputEmail} keyboardType="email-address" autoCapitalize="none" mode="outlined" style={styles.input} />
                  <TextInput label="Passwort" value={inputPassword} onChangeText={setInputPassword} secureTextEntry mode="outlined" style={styles.input} />
                  <TextInput label="Passwort wiederholen" value={inputPasswordConfirm} onChangeText={setInputPasswordConfirm} secureTextEntry mode="outlined" style={styles.input} />
                  <Button mode="contained" onPress={handleUpgrade} loading={loading} disabled={loading} style={styles.button}>
                    Konto sichern
                  </Button>
                </View>
              </>
            )}

            {anonTab === 'signin' && (
              <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
                <TextInput label="E-Mail" value={inputEmail} onChangeText={setInputEmail} keyboardType="email-address" autoCapitalize="none" mode="outlined" style={styles.input} />
                <TextInput label="Passwort" value={inputPassword} onChangeText={setInputPassword} secureTextEntry mode="outlined" style={styles.input} />
                <Button mode="contained" onPress={handleSignIn} loading={loading} disabled={loading} style={styles.button}>
                  Anmelden
                </Button>
              </View>
            )}
          </>
        )}

        {accountState === 'signed-in' && (
          <>
            <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>Konto</Text>
            <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.row}>
                <View style={[styles.rowIcon, { backgroundColor: Tokens.amberDeep }]}>
                  <MaterialCommunityIcons name="account-outline" size={19} color={Tokens.paper} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 11, fontFamily: Fonts.sansMedium }}>Angemeldet als</Text>
                  <Text style={{ color: theme.colors.onSurface, fontSize: 14, fontFamily: Fonts.sansMedium }}>{email}</Text>
                </View>
              </View>
            </View>

            <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>Passwort ändern</Text>
            <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
              <TextInput label="Neues Passwort" value={inputPassword} onChangeText={setInputPassword} secureTextEntry mode="outlined" style={styles.input} />
              <TextInput label="Passwort wiederholen" value={inputPasswordConfirm} onChangeText={setInputPasswordConfirm} secureTextEntry mode="outlined" style={styles.input} />
              <Button mode="contained" onPress={handleChangePassword} loading={loading} disabled={loading} style={styles.button}>
                Passwort ändern
              </Button>
            </View>

            <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>Sitzung</Text>
            <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
              <Button mode="outlined" onPress={handleSignOut} loading={loading} disabled={loading} textColor={theme.colors.error} style={[styles.button, { borderColor: theme.colors.error + '55' }]}>
                Abmelden
              </Button>
            </View>
          </>
        )}

        {accountState === 'signed-out' && (
          <>
            <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>Anmelden</Text>
            <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
              <TextInput label="E-Mail" value={inputEmail} onChangeText={setInputEmail} keyboardType="email-address" autoCapitalize="none" mode="outlined" style={styles.input} />
              <TextInput label="Passwort" value={inputPassword} onChangeText={setInputPassword} secureTextEntry mode="outlined" style={styles.input} />
              <Button mode="contained" onPress={handleSignIn} loading={loading} disabled={loading} style={styles.button}>
                Anmelden
              </Button>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100, gap: 6 },
  tabs: { marginBottom: 8 },
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  toastText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: Fonts.sansMedium,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.sansMedium,
  },
  sectionHeader: {
    fontFamily: Fonts.sansSemibold,
    fontSize: 10.5,
    letterSpacing: 0.84,
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 4,
    marginLeft: 4,
  },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Tokens.paperEdge,
    padding: 16,
    gap: 10,
  },
  input: { backgroundColor: 'transparent' },
  button: { marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
