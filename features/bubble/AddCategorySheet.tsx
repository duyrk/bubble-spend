// Floating "+" button to add a new category — shows a quick-pick sheet of presets

import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { SIZES } from '@/constants/theme';
import type { BubbleColorKey } from '@/types';

const COLOR_KEYS: BubbleColorKey[] = ['frost', 'mist', 'dusk', 'slate', 'ash', 'haze', 'veil', 'smoke'];

const PRESETS: { emoji: string; name: string }[] = [
  { emoji: '🍔', name: 'Snacks' },
  { emoji: '🍱', name: 'Lunch' },
  { emoji: '🥤', name: 'Drinks' },
  { emoji: '⛽', name: 'Fuel' },
  { emoji: '🎮', name: 'Games' },
  { emoji: '📚', name: 'Books' },
  { emoji: '✈️', name: 'Travel' },
  { emoji: '🏥', name: 'Health' },
  { emoji: '🎁', name: 'Gifts' },
  { emoji: '🐾', name: 'Pets' },
  { emoji: '🏠', name: 'Home' },
  { emoji: '💄', name: 'Beauty' },
];

export function AddCategorySheet() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { t } = useTranslation();
  const categories = useCategoryStore((s) => s.categories);
  const addCategory = useCategoryStore((s) => s.addCategory);

  const [open, setOpen] = useState(false);

  const atLimit = categories.length >= SIZES.BUBBLES_LIMIT;

  const handleAdd = useCallback(
    (preset: { emoji: string; name: string }) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const colorKey = COLOR_KEYS[categories.length % COLOR_KEYS.length];
      addCategory({
        name: preset.name,
        emoji: preset.emoji,
        colorKey,
        positionX: 30 + Math.random() * 40,
        positionY: 35 + Math.random() * 35,
      });
      setOpen(false);
    },
    [addCategory, categories.length],
  );

  if (atLimit) return null;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[
          styles.fab,
          {
            bottom: insets.bottom + 84,
            backgroundColor: colors.glass.base,
            borderColor: colors.glass.border,
          },
        ]}
        hitSlop={8}
      >
        <Text style={[styles.fabIcon, { color: colors.text.secondary }]}>+</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: colors.bg.elevated, borderColor: colors.glass.border }]}>
            <View style={[styles.handle, { backgroundColor: colors.glass.border }]} />
            <Text style={[styles.title, { color: colors.text.primary }]}>{t('addCategory')}</Text>
            <ScrollView contentContainerStyle={styles.grid}>
              {PRESETS.map((p) => (
                <Pressable
                  key={p.emoji}
                  onPress={() => handleAdd(p)}
                  style={({ pressed }) => [
                    styles.cell,
                    { backgroundColor: colors.glass.base, borderColor: colors.glass.border },
                    pressed && { backgroundColor: colors.glass.borderStrong, transform: [{ scale: 0.95 }] },
                  ]}
                >
                  <Text style={styles.cellEmoji}>{p.emoji}</Text>
                  <Text style={[styles.cellName, { color: colors.text.primary }]}>{p.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  fabIcon: {
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 26,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 32,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '70%',
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cell: {
    width: '31%',
    aspectRatio: 1.1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  cellEmoji: {
    fontSize: 26,
  },
  cellName: {
    fontSize: 11,
    fontWeight: '600',
  },
});
