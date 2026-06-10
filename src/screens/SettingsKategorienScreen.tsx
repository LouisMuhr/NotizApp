import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput as RNTextInput,
} from 'react-native';
import { useTheme, Text, Portal, Dialog, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNotes } from '../context/NotesContext';
import { getCategoryAccent } from '../theme/categoryAccents';
import { Tokens } from '../theme/theme';
import { Fonts, Type } from '../theme/typography';
import { useLanguage } from '../context/LanguageContext';

export default function SettingsKategorienScreen() {
  const theme = useTheme();
  const { categories, addCategory, deleteCategory } = useNotes();
  const { t } = useLanguage();

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
      {/* ── Liste ── */}
      {categories.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="tag-off-outline" size={36} color={Tokens.inkFaint} />
          <Text style={styles.emptyTitle}>{t('settingsKategorien.emptyTitle')}</Text>
          <Text style={styles.emptySubtitle}>
            {t('settingsKategorien.emptyHint')}
          </Text>
        </View>
      ) : (
        <>
          <Text style={[styles.eyebrow, { color: theme.colors.onSurfaceVariant }]}>
            {t('settingsKategorien.countLabel', { count: categories.length })}
          </Text>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            {categories.map((cat, index) => {
              const accent = getCategoryAccent(cat);
              const isLast = index === categories.length - 1;
              return (
                <View key={cat}>
                  <View style={styles.row}>
                    {/* Farbiger Pill-Badge */}
                    <View style={[styles.badge, { backgroundColor: accent.soft }]}>
                      <Text style={[styles.badgeLetter, { color: accent.deep }]}>
                        {cat.charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    {/* Name + Farbpunkt */}
                    <View style={styles.rowContent}>
                      <Text style={[styles.catName, { color: theme.colors.onSurface }]}>
                        {cat}
                      </Text>
                      <View style={[styles.colorDot, { backgroundColor: accent.deep }]} />
                    </View>

                    {/* Löschen-Button */}
                    <TouchableOpacity
                      onPress={() => setDeleteCat(cat)}
                      style={[styles.deleteBtn, { backgroundColor: Tokens.paperEdge }]}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="close" size={14} color={Tokens.inkDim} />
                    </TouchableOpacity>
                  </View>

                  {!isLast && (
                    <View style={[styles.divider, { backgroundColor: Tokens.rule }]} />
                  )}
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* ── Hinzufügen-Button ── */}
      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: Tokens.amberSoft }]}
        onPress={() => setNewCatDialog(true)}
        activeOpacity={0.75}
      >
        <MaterialCommunityIcons name="plus" size={18} color={Tokens.amberDeep} />
        <Text style={styles.addButtonLabel}>{t('settingsKategorien.addButton')}</Text>
      </TouchableOpacity>

      {/* ── Dialog: Neue Kategorie ── */}
      <Portal>
        <Dialog
          visible={newCatDialog}
          onDismiss={() => { setNewCatDialog(false); setNewCatName(''); }}
          style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={styles.dialogTitle}>{t('settingsKategorien.newCategoryTitle')}</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <RNTextInput
              value={newCatName}
              onChangeText={setNewCatName}
              placeholder={t('settingsKategorien.placeholder')}
              placeholderTextColor={Tokens.inkFaint}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleAdd}
              style={[styles.textInput, {
                color: theme.colors.onSurface,
                borderColor: newCatName.trim() ? Tokens.amberDeep : Tokens.rule,
                backgroundColor: Tokens.paperDeep,
              }]}
            />
            {/* Vorschau-Badge */}
            {newCatName.trim().length > 0 && (() => {
              const accent = getCategoryAccent(newCatName.trim());
              return (
                <View style={styles.previewRow}>
                  <Text style={[styles.previewLabel, { color: Tokens.inkFaint }]}>{t('settingsKategorien.preview')}</Text>
                  <View style={[styles.previewChip, { backgroundColor: accent.soft }]}>
                    <Text style={[styles.previewChipText, { color: accent.deep }]}>
                      {newCatName.trim()}
                    </Text>
                  </View>
                </View>
              );
            })()}
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button
              onPress={() => { setNewCatDialog(false); setNewCatName(''); }}
              textColor={Tokens.inkDim}
            >
              {t('settingsKategorien.cancel')}
            </Button>
            <Button
              onPress={handleAdd}
              mode="contained"
              disabled={!newCatName.trim()}
              style={styles.confirmBtn}
              labelStyle={{ fontFamily: Fonts.sansSemibold, fontSize: 13 }}
            >
              {t('settingsKategorien.add')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* ── Dialog: Löschen bestätigen ── */}
      <Portal>
        <Dialog
          visible={!!deleteCat}
          onDismiss={() => setDeleteCat(null)}
          style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={styles.dialogTitle}>{t('settingsKategorien.removeDialogTitle')}</Dialog.Title>
          <Dialog.Content>
            {deleteCat && (() => {
              const accent = getCategoryAccent(deleteCat);
              return (
                <View style={styles.deletePreview}>
                  <View style={[styles.badge, { backgroundColor: accent.soft }]}>
                    <Text style={[styles.badgeLetter, { color: accent.deep }]}>
                      {deleteCat.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={[styles.catName, { color: theme.colors.onSurface }]}>
                      {deleteCat}
                    </Text>
                    <Text style={styles.deleteHint}>
                      {t('settingsKategorien.removeDialogBody')}
                    </Text>
                  </View>
                </View>
              );
            })()}
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setDeleteCat(null)} textColor={Tokens.inkDim}>
              {t('settingsKategorien.cancel')}
            </Button>
            <Button
              onPress={handleDelete}
              mode="contained"
              buttonColor={theme.colors.errorContainer}
              textColor={theme.colors.error}
              style={styles.confirmBtn}
              labelStyle={{ fontFamily: Fonts.sansSemibold, fontSize: 13 }}
            >
              {t('settingsKategorien.remove')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100, gap: 12 },

  eyebrow: {
    ...Type.eyebrow,
    marginLeft: 4,
    marginBottom: -4,
  },

  // ── Karten-Liste ──
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Tokens.paperEdge,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLetter: {
    fontFamily: Fonts.sansSemibold,
    fontSize: 16,
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catName: {
    fontFamily: Fonts.sansMedium,
    fontSize: 15,
  },
  colorDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    opacity: 0.6,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 66,
    opacity: 0.8,
  },

  // ── Empty State ──
  emptyState: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 24,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: Fonts.sansSemibold,
    fontSize: 16,
    color: Tokens.inkDim,
    marginTop: 8,
  },
  emptySubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13.5,
    color: Tokens.inkFaint,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
  },

  // ── Add-Button ──
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
  },
  addButtonLabel: {
    fontFamily: Fonts.sansSemibold,
    fontSize: 14,
    color: Tokens.amberDeep,
  },

  // ── Dialoge ──
  dialog: {
    borderRadius: 24,
    marginHorizontal: 24,
  },
  dialogTitle: {
    fontFamily: Fonts.sansSemibold,
    fontSize: 17,
    color: Tokens.ink,
  },
  dialogContent: {
    gap: 12,
  },
  dialogActions: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 4,
  },
  textInput: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  previewLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
  },
  previewChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  previewChipText: {
    fontFamily: Fonts.sansSemibold,
    fontSize: 11.5,
    letterSpacing: 0.3,
  },
  confirmBtn: {
    borderRadius: 12,
  },

  // ── Delete-Dialog ──
  deletePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  deleteHint: {
    fontFamily: Fonts.sans,
    fontSize: 12.5,
    color: Tokens.inkFaint,
    marginTop: 2,
  },
});
