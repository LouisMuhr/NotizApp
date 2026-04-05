import React, { useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
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

export default function SettingsScreen() {
  const theme = useTheme();
  const { categories, addCategory, deleteCategory } = useNotes();

  const [newCatDialog, setNewCatDialog] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [deleteCat, setDeleteCat] = useState<string | null>(null);

  const handleAddCategory = async () => {
    const name = newCatName.trim();
    if (name) {
      await addCategory(name);
      setNewCatName('');
      setNewCatDialog(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (deleteCat) {
      await deleteCategory(deleteCat);
      setDeleteCat(null);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Categories */}
      <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
          KATEGORIEN
        </Text>

        {categories.map((cat, index) => {
          const color = getCategoryColor(cat);
          return (
            <View key={cat}>
              <View style={styles.categoryRow}>
                <View style={[styles.avatar, { backgroundColor: withAlpha(color, 0.15) }]}>
                  <Text style={{ color, fontSize: 14, fontWeight: '700' }}>
                    {cat.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.categoryName, { color: theme.colors.onSurface }]}>
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
                <View style={[styles.rowDivider, { backgroundColor: theme.colors.outline }]} />
              )}
            </View>
          );
        })}

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

      {/* Info */}
      <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
          INFO
        </Text>
        <View style={styles.infoRow}>
          <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 14 }}>Version</Text>
          <Text style={{ color: theme.colors.onSurface, fontSize: 14, fontWeight: '600' }}>1.0.0</Text>
        </View>
      </View>

      {/* Add Category Dialog */}
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
            <Button onPress={handleAddCategory} mode="contained" style={{ borderRadius: 12 }}>
              Hinzufügen
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Delete Category Dialog */}
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
              onPress={handleDeleteCategory}
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
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
    gap: 12,
  },
  section: {
    borderRadius: 20,
    padding: 16,
  },
  sectionLabel: {
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryName: {
    flex: 1,
    fontWeight: '500',
    fontSize: 15,
  },
  removeBtn: {
    opacity: 0.4,
    margin: -4,
  },
  rowDivider: {
    height: 1,
    marginLeft: 46,
    opacity: 0.4,
  },
  addBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dialog: {
    borderRadius: 24,
  },
});
