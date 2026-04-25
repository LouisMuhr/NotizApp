import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  useTheme,
  Text,
  IconButton,
  Portal,
  Dialog,
  Button,
  TextInput,
} from 'react-native-paper';
import { useNotes } from '../context/NotesContext';
import { getCategoryColor, withAlpha } from '../utils/categoryColors';

export default function SettingsKategorienScreen() {
  const theme = useTheme();
  const { categories, addCategory, deleteCategory } = useNotes();

  const [newCatDialog, setNewCatDialog] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [deleteCat, setDeleteCat] = useState<string | null>(null);

  const handleAdd = async () => {
    const name = newCatName.trim();
    if (name) {
      await addCategory(name);
      setNewCatName('');
      setNewCatDialog(false);
    }
  };

  const handleDelete = async () => {
    if (deleteCat) {
      await deleteCategory(deleteCat);
      setDeleteCat(null);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}>
        Meine Kategorien
      </Text>

      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        {categories.length === 0 && (
          <View style={styles.emptyRow}>
            <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 14 }}>
              Noch keine Kategorien vorhanden.
            </Text>
          </View>
        )}

        {categories.map((cat, index) => {
          const color = getCategoryColor(cat);
          return (
            <View key={cat}>
              <View style={styles.row}>
                <View style={[styles.avatar, { backgroundColor: withAlpha(color, 0.15) }]}>
                  <Text style={{ color, fontSize: 13, fontWeight: '700' }}>
                    {cat.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.catName, { color: theme.colors.onSurface }]}>
                  {cat}
                </Text>
                <IconButton
                  icon="close"
                  iconColor={theme.colors.onSurfaceVariant}
                  size={16}
                  onPress={() => setDeleteCat(cat)}
                  style={styles.removeBtn}
                />
              </View>
              {index < categories.length - 1 && (
                <View style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
              )}
            </View>
          );
        })}

        {categories.length > 0 && (
          <View style={[styles.divider, { backgroundColor: theme.colors.outline, marginLeft: 0 }]} />
        )}

        <Button
          mode="text"
          icon="plus"
          onPress={() => setNewCatDialog(true)}
          style={styles.addBtn}
          labelStyle={{ color: theme.colors.primary, fontWeight: '600', fontSize: 13 }}
        >
          Kategorie hinzufügen
        </Button>
      </View>

      <Portal>
        <Dialog
          visible={newCatDialog}
          onDismiss={() => setNewCatDialog(false)}
          style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={{ color: theme.colors.onSurface }}>Neue Kategorie</Dialog.Title>
          <Dialog.Content>
            <TextInput
              value={newCatName}
              onChangeText={setNewCatName}
              placeholder="Name..."
              mode="outlined"
              dense
              outlineStyle={{ borderRadius: 12, borderWidth: 1 }}
              outlineColor={theme.colors.outline}
              activeOutlineColor={theme.colors.primary}
              textColor={theme.colors.onSurface}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setNewCatDialog(false)} textColor={theme.colors.onSurfaceVariant}>
              Abbrechen
            </Button>
            <Button onPress={handleAdd} mode="contained" style={{ borderRadius: 12 }}>
              Hinzufügen
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog
          visible={!!deleteCat}
          onDismiss={() => setDeleteCat(null)}
          style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={{ color: theme.colors.onSurface }}>Kategorie löschen?</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
              „{deleteCat}" wird entfernt. Notizen behalten ihre bisherige Kategorie.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteCat(null)} textColor={theme.colors.onSurfaceVariant}>
              Abbrechen
            </Button>
            <Button
              onPress={handleDelete}
              mode="contained"
              buttonColor={theme.colors.errorContainer}
              textColor={theme.colors.error}
              style={{ borderRadius: 12 }}
            >
              Löschen
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100, gap: 6 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginTop: 10,
    marginBottom: 4,
    marginLeft: 4,
  },
  card: { borderRadius: 20, overflow: 'hidden' },
  emptyRow: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catName: { flex: 1, fontWeight: '500', fontSize: 15 },
  removeBtn: { opacity: 0.4, margin: -4 },
  divider: { height: 1, marginLeft: 60, opacity: 0.35 },
  addBtn: { alignSelf: 'flex-start', marginLeft: 8, marginBottom: 4 },
  dialog: { borderRadius: 24 },
});
