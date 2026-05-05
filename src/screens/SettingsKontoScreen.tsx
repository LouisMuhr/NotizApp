import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useTheme, Text, TextInput, Button, Snackbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getSupabase } from '../sync/supabaseClient';
import { Tokens } from '../theme/theme';
import { Fonts } from '../theme/typography';

export default function SettingsKontoScreen() {
  const theme = useTheme();
  const [isAnonymous, setIsAnonymous] = useState<boolean | null>(null);
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
      setIsAnonymous(user?.is_anonymous ?? true);
      setEmail(user?.email ?? '');
    })();
  }, []);

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
      setIsAnonymous(false);
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

  if (isAnonymous === null) {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {isAnonymous ? (
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
        </>
      ) : (
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
