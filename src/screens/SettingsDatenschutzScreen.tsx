import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNotes } from '../context/NotesContext';
import { useThoughts } from '../context/ThoughtsContext';
import { exportNotesAsJson } from '../utils/exportNotes';
import { getSupabase } from '../sync/supabaseClient';
import { getUserId, clearUserIdCache } from '../sync/userId';
import { deleteAccountCompletely } from '../sync/deleteAnonUser';
import { Tokens } from '../theme/theme';
import { Fonts } from '../theme/typography';

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

export default function SettingsDatenschutzScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { notes, archivedNotes, deleteAllData } = useNotes();
  const { threads, clearAllThreads } = useThoughts();
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' }>({ message: '', type: 'info' });
  const toastKey = useRef(0);

  const showToast = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
    toastKey.current += 1;
    setToast({ message, type });
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      await exportNotesAsJson(notes, archivedNotes, threads);
    } catch (e: any) {
      showToast(e?.message ?? 'Export fehlgeschlagen.', 'error');
    } finally {
      setExportLoading(false);
    }
  };

  // DSGVO-Komplettlöschung: lokale Daten + alle Server-Daten + Auth-Account
  // (inkl. E-Mail) werden unwiderruflich entfernt. Danach frischer anonymer User.
  const handleDeleteAll = async () => {
    setConfirmVisible(false);
    setDeleteLoading(true);
    try {
      const supabase = getSupabase();

      // UID des aktuell angemeldeten Users ermitteln (vor dem Sign-Out).
      let uid: string | null = null;
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        uid = user?.id ?? null;
      }

      // 1. Lokale Daten + per-Tabelle Remote-Daten löschen.
      clearAllThreads();
      await deleteAllData();

      // 2. Auth-User (auth.users) inkl. E-Mail löschen — Cascade räumt den Rest.
      if (uid) {
        await deleteAccountCompletely(uid);
      }

      // 3. Session beenden und frischen anonymen User holen, damit die App
      //    nicht mit einem gelöschten Account weiterläuft.
      if (supabase) {
        await supabase.auth.signOut().catch(() => {});
        clearUserIdCache();
        await getUserId().catch(() => {});
      }

      showToast('Konto und alle Daten wurden gelöscht.', 'success');
      navigation.navigate('Home', { screen: 'Threads' });
    } catch (e: any) {
      showToast(e?.message ?? 'Fehler beim Löschen.', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Toast key={toastKey.current} message={toast.message} type={toast.type} />

      <ScrollView contentContainerStyle={styles.content}>

        {/* Info-Karte */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>Deine Daten</Text>
          <Text style={[styles.cardBody, { color: theme.colors.onSurfaceVariant }]}>
            Velm speichert deine Notizen lokal auf diesem Gerät. Optional werden sie
            verschlüsselt über Supabase synchronisiert. Es werden keine Daten an Dritte weitergegeben.
          </Text>
        </View>

        {/* Export */}
        <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
          Datenportabilität
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: Tokens.amberDeep }]}>
              <MaterialCommunityIcons name="download-outline" size={19} color={Tokens.paper} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.onSurface, fontSize: 15, fontFamily: Fonts.sansMedium }}>
                Notizen exportieren
              </Text>
              <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12, marginTop: 1 }}>
                Alle Notizen & Threads als JSON
              </Text>
            </View>
          </View>
          <Button
            mode="outlined"
            onPress={handleExport}
            loading={exportLoading}
            disabled={exportLoading}
            style={styles.button}
          >
            Exportieren
          </Button>
        </View>

        {/* Löschen */}
        <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
          Datenlöschung
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.banner, { backgroundColor: theme.colors.errorContainer, borderColor: theme.colors.error + '44' }]}>
            <MaterialCommunityIcons name="alert-outline" size={18} color={theme.colors.error} />
            <Text style={[styles.bannerText, { color: theme.colors.onErrorContainer }]}>
              Löscht dein Konto und alle Daten (inkl. E-Mail-Adresse) endgültig —
              lokal und auf dem Server. Nicht rückgängig zu machen. Sichere deine
              Daten vorher per Export.
            </Text>
          </View>
          <Button
            mode="contained"
            buttonColor={theme.colors.error}
            textColor="#fff"
            onPress={() => setConfirmVisible(true)}
            loading={deleteLoading}
            disabled={deleteLoading}
            style={styles.button}
            icon="delete-outline"
          >
            Konto & alle Daten löschen
          </Button>
        </View>

      </ScrollView>

      {/* DSGVO-Bestätigung — Custom-Modal im App-Design */}
      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setConfirmVisible(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.modalIcon, { backgroundColor: theme.colors.error }]}>
              <MaterialCommunityIcons name="delete-alert-outline" size={26} color="#fff" />
            </View>
            <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
              Wirklich alles löschen?
            </Text>
            <Text style={[styles.modalBody, { color: theme.colors.onSurfaceVariant }]}>
              Dein Konto wird vollständig gelöscht: alle Notizen, Archive, Threads
              und deine E-Mail-Adresse werden unwiderruflich von diesem Gerät und
              vom Server entfernt. Diese Aktion kann nicht rückgängig gemacht werden.
            </Text>
            <View style={styles.modalActions}>
              <Button
                mode="text"
                textColor={theme.colors.onSurfaceVariant}
                onPress={() => setConfirmVisible(false)}
                style={styles.modalBtn}
              >
                Abbrechen
              </Button>
              <Button
                mode="contained"
                buttonColor={theme.colors.error}
                textColor="#fff"
                onPress={handleDeleteAll}
                style={styles.modalBtn}
              >
                Endgültig löschen
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100, gap: 6 },
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
  toastText: { color: '#fff', fontSize: 13, fontFamily: Fonts.sansMedium },
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
    gap: 12,
  },
  cardTitle: {
    fontFamily: Fonts.sansSemibold,
    fontSize: 15,
  },
  cardBody: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    lineHeight: 19,
  },
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
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.sansMedium,
  },
  button: { marginTop: 2 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Tokens.paperEdge,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 10,
  },
  modalIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  modalTitle: {
    fontFamily: Fonts.serif,
    fontSize: 21,
    textAlign: 'center',
  },
  modalBody: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    alignSelf: 'stretch',
  },
  modalBtn: { flex: 1 },
});
