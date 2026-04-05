import React, { useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Chip, Searchbar, Menu, IconButton, useTheme } from 'react-native-paper';
import { FilterOptions, SortField, SortOrder } from '../models/Note';
import { getCategoryColor, withAlpha } from '../utils/categoryColors';

interface Props {
  filters: FilterOptions;
  categories: string[];
  onFiltersChange: (filters: FilterOptions) => void;
}

const SORT_OPTIONS: { label: string; field: SortField; order: SortOrder }[] = [
  { label: 'Neueste zuerst', field: 'updatedAt', order: 'desc' },
  { label: 'Älteste zuerst', field: 'updatedAt', order: 'asc' },
  { label: 'A → Z', field: 'title', order: 'asc' },
  { label: 'Z → A', field: 'title', order: 'desc' },
  { label: 'Kategorie A → Z', field: 'category', order: 'asc' },
];

export default function FilterBar({ filters, categories, onFiltersChange }: Props) {
  const theme = useTheme();
  const [sortMenuVisible, setSortMenuVisible] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <Searchbar
          placeholder="Suchen..."
          value={filters.searchQuery}
          onChangeText={(q) => onFiltersChange({ ...filters, searchQuery: q })}
          style={[styles.searchbar, { backgroundColor: theme.colors.surfaceVariant }]}
          inputStyle={{ fontSize: 14, color: theme.colors.onSurface }}
          iconColor={theme.colors.onSurfaceVariant}
          placeholderTextColor={theme.colors.onSurfaceVariant}
          elevation={0}
        />
        <Menu
          visible={sortMenuVisible}
          onDismiss={() => setSortMenuVisible(false)}
          anchor={
            <IconButton
              icon="swap-vertical"
              mode="contained"
              containerColor={theme.colors.surfaceVariant}
              iconColor={theme.colors.primary}
              size={20}
              onPress={() => setSortMenuVisible(true)}
              style={styles.sortBtn}
            />
          }
        >
          {SORT_OPTIONS.map((opt) => (
            <Menu.Item
              key={`${opt.field}-${opt.order}`}
              title={opt.label}
              leadingIcon={
                opt.field === filters.sortField && opt.order === filters.sortOrder
                  ? 'check'
                  : undefined
              }
              onPress={() => {
                onFiltersChange({ ...filters, sortField: opt.field, sortOrder: opt.order });
                setSortMenuVisible(false);
              }}
            />
          ))}
        </Menu>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        <Chip
          selected={filters.category === null}
          onPress={() => onFiltersChange({ ...filters, category: null })}
          compact
          style={[
            styles.chip,
            filters.category === null
              ? { backgroundColor: theme.colors.primaryContainer }
              : { backgroundColor: 'transparent' },
          ]}
          textStyle={[
            styles.chipText,
            { color: filters.category === null ? theme.colors.primary : theme.colors.onSurfaceVariant },
          ]}
        >
          Alle
        </Chip>

        {categories.map((cat) => {
          const isActive = filters.category === cat;
          const color = getCategoryColor(cat);
          return (
            <Chip
              key={cat}
              selected={isActive}
              onPress={() =>
                onFiltersChange({
                  ...filters,
                  category: isActive ? null : cat,
                })
              }
              compact
              style={[
                styles.chip,
                isActive
                  ? { backgroundColor: withAlpha(color, 0.15) }
                  : { backgroundColor: 'transparent' },
              ]}
              textStyle={[
                styles.chipText,
                { color: isActive ? color : theme.colors.onSurfaceVariant },
              ]}
            >
              {cat}
            </Chip>
          );
        })}
      </ScrollView>
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
    borderRadius: 24,
    height: 44,
  },
  sortBtn: {
    borderRadius: 22,
    width: 44,
    height: 44,
  },
  chipRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    borderRadius: 20,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
