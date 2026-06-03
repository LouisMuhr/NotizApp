import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import { Text, Searchbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FilterOptions, SortField, SortOrder } from '../models/Note';
import { getCategoryAccent } from '../theme/categoryAccents';
import { Tokens } from '../theme/theme';
import { Radii, Shadows, Insets } from '../theme/gradients';
import * as haptics from '../utils/haptics';

interface Props {
  filters: FilterOptions;
  categories: string[];
  onFiltersChange: (filters: FilterOptions) => void;
}

const SORT_OPTIONS: { label: string; description: string; field: SortField; order: SortOrder; icon: string }[] = [
  { label: 'Neueste zuerst', description: 'Zuletzt bearbeitet oben', field: 'updatedAt', order: 'desc', icon: 'clock-outline' },
  { label: 'Älteste zuerst', description: 'Älteste Notizen oben', field: 'updatedAt', order: 'asc',  icon: 'clock-check-outline' },
  { label: 'A → Z',          description: 'Alphabetisch aufsteigend', field: 'title',     order: 'asc',  icon: 'sort-alphabetical-ascending' },
  { label: 'Z → A',          description: 'Alphabetisch absteigend', field: 'title',     order: 'desc', icon: 'sort-alphabetical-descending' },
  { label: 'Kategorie',      description: 'Nach Kategorie gruppiert', field: 'category',  order: 'asc',  icon: 'tag-outline' },
];

export default function FilterBar({ filters, categories, onFiltersChange }: Props) {
  const insets = useSafeAreaInsets();
  const [sheetVisible, setSheetVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const activeSort = SORT_OPTIONS.find(
    (o) => o.field === filters.sortField && o.order === filters.sortOrder,
  ) ?? SORT_OPTIONS[0];

  const openSheet = () => {
    haptics.tap();
    setSheetVisible(true);
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const closeSheet = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setSheetVisible(false));
  };

  const selectSort = (opt: (typeof SORT_OPTIONS)[0]) => {
    haptics.tap();
    onFiltersChange({ ...filters, sortField: opt.field, sortOrder: opt.order });
    closeSheet();
  };

  const sheetTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [320, 0],
  });
  const backdropOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={styles.container}>
      {/* Suchzeile */}
      <View style={styles.searchRow}>
        <Searchbar
          placeholder="Suchen..."
          value={filters.searchQuery}
          onChangeText={(q) => onFiltersChange({ ...filters, searchQuery: q })}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          iconColor={Tokens.inkFaint}
          placeholderTextColor={Tokens.inkFaint}
          elevation={0}
        />

        {/* Sort-Trigger */}
        <Pressable onPress={openSheet} style={styles.sortTrigger}>
          <MaterialCommunityIcons name={activeSort.icon as any} size={13} color={Tokens.inkDim} />
          <Text style={styles.sortLabel} numberOfLines={1}>
            {activeSort.label}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={12} color={Tokens.inkFaint} />
        </Pressable>
      </View>

      {/* Kategorie-Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillRow}
      >
        <Pressable
          onPress={() => { haptics.tap(); onFiltersChange({ ...filters, category: null }); }}
          style={[
            styles.pill,
            filters.category === null
              ? { backgroundColor: Tokens.ink }
              : { backgroundColor: Tokens.paperDeep, borderColor: Tokens.paperEdge, borderWidth: 1 },
          ]}
        >
          <Text
            style={[
              styles.pillText,
              { color: filters.category === null ? Tokens.paper : Tokens.inkDim },
            ]}
          >
            Alle
          </Text>
        </Pressable>

        {categories.map((cat) => {
          const isActive = filters.category === cat;
          const accent = getCategoryAccent(cat);
          return (
            <Pressable
              key={cat}
              onPress={() => { haptics.tap(); onFiltersChange({ ...filters, category: isActive ? null : cat }); }}
              style={[
                styles.pill,
                isActive
                  ? { backgroundColor: accent.deep }
                  : { backgroundColor: Tokens.paperDeep, borderColor: Tokens.paperEdge, borderWidth: 1 },
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: isActive ? Tokens.paper : Tokens.inkDim },
                ]}
              >
                {cat}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Sort-Sheet */}
      <Modal visible={sheetVisible} transparent animationType="none" onRequestClose={closeSheet}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
        </Animated.View>

        <View style={styles.sheetContainer} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.sheet,
              Shadows.softWarm,
              Insets.cardBorder,
              { paddingBottom: Math.max(insets.bottom, 16), transform: [{ translateY: sheetTranslateY }] },
            ]}
          >
            {/* Handle */}
            <View style={styles.handleRow}>
              <View style={styles.handle} />
            </View>

            <Text style={styles.sheetTitle}>Sortierung</Text>

            {SORT_OPTIONS.map((opt) => {
              const isActive = opt.field === filters.sortField && opt.order === filters.sortOrder;
              return (
                <Pressable
                  key={`${opt.field}-${opt.order}`}
                  onPress={() => selectSort(opt)}
                  style={[
                    styles.optionRow,
                    isActive && { backgroundColor: Tokens.amberSoft },
                  ]}
                >
                  <View
                    style={[
                      styles.optionIcon,
                      { backgroundColor: isActive ? Tokens.amber + '22' : Tokens.paperDeep },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={opt.icon as any}
                      size={18}
                      color={isActive ? Tokens.amberDeep : Tokens.inkDim}
                    />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, { color: isActive ? Tokens.amberDeep : Tokens.ink }]}>
                      {opt.label}
                    </Text>
                    <Text style={styles.optionDesc}>{opt.description}</Text>
                  </View>
                  {isActive && (
                    <MaterialCommunityIcons name="check" size={18} color={Tokens.amberDeep} />
                  )}
                </Pressable>
              );
            })}
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  searchbar: {
    flex: 1,
    borderRadius: Radii.pill,
    height: 44,
    backgroundColor: Tokens.paperDeep,
  },
  searchInput: {
    fontSize: 14,
    color: Tokens.ink,
  },
  sortTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Tokens.paperDeep,
    borderRadius: Radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: Tokens.paperEdge,
  },
  sortLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Tokens.inkDim,
    flexShrink: 1,
  },
  pillRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 7,
  },
  pill: {
    borderRadius: Radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  pillText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(43, 36, 25, 0.4)',
  },
  sheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Tokens.paper,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  handleRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Tokens.rule,
  },
  sheetTitle: {
    fontFamily: 'InstrumentSerif_400Regular',
    fontSize: 18,
    color: Tokens.ink,
    marginBottom: 12,
    marginLeft: 4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: Radii.md,
    marginBottom: 4,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  optionDesc: {
    fontSize: 11.5,
    fontFamily: 'Inter_400Regular',
    color: Tokens.inkFaint,
    marginTop: 1,
  },
});
