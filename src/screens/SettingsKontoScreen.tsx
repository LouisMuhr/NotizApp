import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useTheme, Text, TextInput, Button, Snackbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase } from '../sync/supabaseClient';
import { clearUserIdCache } from '../sync/userId';
import { deleteAnonUser } from '../sync/deleteAnonUser';
import { Tokens } from '../theme/theme';
import { Fonts } from '../theme/typography';

const SIGNED_OUT_KEY = '@notizapp_signed_out_uid';

type AccountState = 'loading' | 'anonymous' | 'signed-in' | 'signed-out';

export default function SettingsKontoScreen() {
  const theme = useTheme();
  const [accountState, setAccountState] = useState<AccountState>('loading');
  const [email, setEmail] = useState('');
  const [inputEmail, setInputEmail] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [inputPasswordConfirm, setInputPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState('');

  useEffect(() => {
    (async () => {
      const supabase = getSupabase();
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.is_anonymous) {
        const signedOutUid = await AsyncStorage.getItem(SIGNED_OUT_KEY);
        if (signedOutUid && user && signedOutUid === user.id) {
          // gleicher anonymer User wie beim Abmelden → Anmelde-Formular zeigen
          setAccountState('signed-out');
        } else {
          // neuer anonymer User oder kein Flag → Konto sichern zeigen
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
  };

  const handleSignIn = async () => {
    if (!inputEmail.trim() || !inputPassword) {
      setSnack('Bitte E-Mail und Passwort eingeben.');
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
    setLoading(false);
    if (error) {
      setSnack('Fehler: ' + error.message);
    } else {
      clearUserIdCache();
      await AsyncStorage.removeItem(SIGNED_OUT_KEY);
      setEmail(data.user?.email ?? '');
      setInputEmail('');
      setInputPassword('');
      setAccountState('signed-in');
      if (anonUid) deleteAnonUser(anonUid);
    }
  };

  const handleUpgrade = async () => {
    if (!inputEmail.trim() || !inputPassword) {
      setSnack('Bitte E-Mail und Passwort eingeben.');
      return;
    }
    if (inputPassword !== inputPasswordConfirm) {
      setSnack('Passwörter stimmen nicht überein.');
      return;
    }
    if (inputPassword.length < 6) {
      setSnack('Passwort muss mindestens 6 Zeichen haben.');
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
      setSnack('Fehler: ' + error.message);
    } else {
      setAccountState('signed-in');
      setEmail(inputEmail.trim());
      setInputEmail('');
      setInputPassword('');
      setInputPasswordConfirm('');
      setSnack('Konto gesichert! Bitte E-Mail bestätigen.');
    }
  };

  const handleChangePassword = async () => {
    if (!inputPassword) {
      setSnack('Bitte neues Passwort eingeben.');
      return;
    }
    if (inputPassword !== inputPasswordConfirm) {
      setSnack('Passwörter stimmen nicht überein.');
      return;
    }
    if (inputPassword.length < 6) {
      setSnack('Passwort muss mindestens 6 Zeichen haben.');
      return;
    }
    setLoading(true);
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.auth.updateUser({ password: inputPassword });
    setLoading(false);
    if (error) {
      setSnack('Fehler: ' + error.message);
    } else {
      setInputPassword('');
      setInputPasswordConfirm('');
      setSnack('Passwort geändert.');
    }
  };

  if (accountState === 'loading') {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {accountState === 'anonymous' && (
        <>
          <View style={[styles.banner, { backgroundColor: Tokens.amberDeep + '22', borderColor: Tokens.amberDeep + '55' }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color={Tokens.amberDeep} />
            <Text style={[styles.bannerText, { color: Tokens.ink }]}>
              Dein Konto ist noch nicht gesichert. Bei einer Neu-Installation gehen alle Sync-Daten verloren.
            </Text>
          </View>

          <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
            Konto sichern
          </Text>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <TextInput
              label="E-Mail"
              value={inputEmail}
              onChangeText={setInputEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label="Passwort"
              value={inputPassword}
              onChangeText={setInputPassword}
              secureTextEntry
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label="Passwort wiederholen"
              value={inputPasswordConfirm}
              onChangeText={setInputPasswordConfirm}
              secureTextEntry
              mode="outlined"
              style={styles.input}
            />
            <Button
              mode="contained"
              onPress={handleUpgrade}
              loading={loading}
              disabled={loading}
              style={styles.button}
            >
              Konto sichern
            </Button>
          </View>

          <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
            Bereits ein Konto?
          </Text>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <TextInput
              label="E-Mail"
              value={inputEmail}
              onChangeText={setInputEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label="Passwort"
              value={inputPassword}
              onChangeText={setInputPassword}
              secureTextEntry
              mode="outlined"
              style={styles.input}
            />
            <Button
              mode="outlined"
              onPress={handleSignIn}
              loading={loading}
              disabled={loading}
              style={styles.button}
            >
              Anmelden
            </Button>
          </View>
        </>
      )}

      {accountState === 'signed-in' && (
        <>
          <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
            Konto
          </Text>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: Tokens.amberDeep }]}>
                <MaterialCommunityIcons name="account-outline" size={19} color={Tokens.paper} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 11, fontFamily: Fonts.sansMedium }}>
                  Angemeldet als
                </Text>
                <Text style={{ color: theme.colors.onSurface, fontSize: 14, fontFamily: Fonts.sansMedium }}>
                  {email}
                </Text>
              </View>
            </View>
          </View>

          <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
            Passwort ändern
          </Text>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <TextInput
              label="Neues Passwort"
              value={inputPassword}
              onChangeText={setInputPassword}
              secureTextEntry
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label="Passwort wiederholen"
              value={inputPasswordConfirm}
              onChangeText={setInputPasswordConfirm}
              secureTextEntry
              mode="outlined"
              style={styles.input}
            />
            <Button
              mode="contained"
              onPress={handleChangePassword}
              loading={loading}
              disabled={loading}
              style={styles.button}
            >
              Passwort ändern
            </Button>
          </View>

          <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
            Sitzung
          </Text>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <Button
              mode="outlined"
              onPress={handleSignOut}
              loading={loading}
              disabled={loading}
              textColor={theme.colors.error}
              style={[styles.button, { borderColor: theme.colors.error + '55' }]}
            >
              Abmelden
            </Button>
          </View>
        </>
      )}

      {accountState === 'signed-out' && (
        <>
          <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
            Anmelden
          </Text>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <TextInput
              label="E-Mail"
              value={inputEmail}
              onChangeText={setInputEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label="Passwort"
              value={inputPassword}
              onChangeText={setInputPassword}
              secureTextEntry
              mode="outlined"
              style={styles.input}
            />
            <Button
              mode="contained"
              onPress={handleSignIn}
              loading={loading}
              disabled={loading}
              style={styles.button}
            >
              Anmelden
            </Button>
          </View>
        </>
      )}

      <Snackbar visible={!!snack} onDismiss={() => setSnack('')} duration={3000}>
        {snack}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100, gap: 6 },
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
